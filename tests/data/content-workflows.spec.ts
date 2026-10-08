import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
let offices: Record<string, string>;
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  mho: "00000000-0000-4000-8000-000000000002",
  legislative: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
async function as(user: keyof typeof users, run: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    users[user],
  ]);
  await db.exec("set role authenticated");
  try {
    await run();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
  }
}
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  for (const f of [
    "202609300001_content.sql",
    "202609300003_auth.sql",
    "202610010004_office_access.sql",
    "202610010005_legislative_modules.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(
    `create schema storage;grant usage on schema storage to authenticated;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;create policy public_media_read on storage.objects for select to authenticated using(bucket_id='municipal-media');`,
  );
  for (const f of [
    "202610010006_official_photos.sql",
    "202610010007_single_legislative_access.sql",
    "202610020008_department_scope.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  offices = Object.fromEntries(
    (
      await db.query<{ id: string; slug: string }>(
        "select id,slug from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
  for (const [name, id] of Object.entries(users))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      name + "@test.local",
    ]);
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id=$1",
    [users.superadmin],
  );
  await as("superadmin", async () => {
    for (const [user, office, role, level] of [
      ["mho", "municipal-health", "admin", "manager"],
      ["legislative", "legislative-access", "admin", "manager"],
      ["viewer", "municipal-health", "viewer", "viewer"],
    ])
      await db.query("select manage_staff($1,$2,true,$3,$4::jsonb,false)", [
        users[user as keyof typeof users],
        role,
        user,
        JSON.stringify([
          { office_id: offices[office], permission_level: level },
        ]),
      ]);
    await db.query(
      "insert into offices(name,short_name,slug,department) values('Municipal Environment Office','MENRO','menro','executive')",
    );
  });
  offices = Object.fromEntries(
    (
      await db.query<{ id: string; slug: string }>(
        "select id,slug from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
});
test.afterAll(async () => await db.close());

test.beforeAll(async () => {
  await db.exec(
    "update departments set head_name='Existing Head',head_photo='/images/existing-head.webp' where id='health'",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610020009_dynamic_departments.sql",
      "utf8",
    ),
  );
});
test.beforeAll(async () => {
  await db.exec(
    readFileSync(
      "supabase/migrations/202610050010_department_identity.sql",
      "utf8",
    ),
  );
});

test.beforeAll(async () => {
  await db.exec(
    "create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])",
  );
  const sql = readFileSync(
    "supabase/migrations/202610080011_content_workflows.sql",
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
});
test("stable identities, global slugs and content preservation", async () => {
  const before = await db.query("select slug,image,id from news");
  expect(before.rows.length).toBeGreaterThan(0);
  await as("superadmin", async () => {
    const result = await db.query<{ id: string }>(
      "insert into programs(slug,name,description,category,status,office_id) values('workflow-program','Test','Body','Services','Active',$1) returning id",
      [offices["municipal-health"]],
    );
    const id = result.rows[0].id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(
      db.query("update programs set id='changed-id' where id=$1", [id]),
    ).rejects.toThrow("Record IDs");
    await expect(
      db.query(
        "insert into programs(slug,name,description,category,status,office_id) values('workflow-program','Other','Body','Services','Active',$1)",
        [offices.menro],
      ),
    ).rejects.toThrow();
    const news = (
      await db.query<{ id: string }>(
        "insert into news(slug,title,category,date,excerpt,image,office_id) values('workflow-news','Test','Services','2026-10-08','Excerpt','/image.png',$1) returning id",
        [offices["municipal-health"]],
      )
    ).rows[0];
    await db.query("update news set slug='renamed-workflow-news' where id=$1", [
      news.id,
    ]);
    expect(
      (await db.query("select slug from news where id=$1", [news.id])).rows[0],
    ).toEqual({ slug: "renamed-workflow-news" });
    await expect(
      db.query("update news set id=gen_random_uuid() where id=$1", [news.id]),
    ).rejects.toThrow("Record IDs");
  });
});
test("unpublished departments stay editable by their members and hidden publicly", async () => {
  const id = offices["municipal-health"];
  await as("superadmin", async () => {
    await db.query("update departments set published=false where id=$1", [id]);
  });
  await db.exec("set role anon");
  try {
    expect(
      (await db.query("select id from departments where id=$1", [id])).rows,
    ).toHaveLength(0);
  } finally {
    await db.exec("reset role");
  }
  await as("mho", async () => {
    expect(
      (
        await db.query(
          "update departments set head_name='Unpublished Head' where id=$1 returning id",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update departments set published=true where id=$1", [id]),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update departments set head_name='Forged' where id=$1 returning id",
          [offices.menro],
        )
      ).rows,
    ).toHaveLength(0);
  });
});
test("news upload Storage scopes, immutable objects and reference-safe cleanup", async () => {
  const prefix = `news/${offices["municipal-health"]}/${users.mho}/`;
  await as("mho", async () => {
    await db.query(
      "insert into storage.objects values('municipal-news-staging',$1)",
      [prefix + "stage.png"],
    );
    await db.query("insert into storage.objects values('municipal-media',$1)", [
      prefix + "version/health_news_test_id.png",
    ]);
    await expect(
      db.query(
        "insert into storage.objects values('municipal-news-staging',$1)",
        [`news/${offices.menro}/${users.mho}/forged.png`],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("insert into storage.objects values('municipal-media',$1)", [
        `news/${offices["municipal-health"]}/${users.viewer}/forged.png`,
      ]),
    ).rejects.toThrow();
    await db.query(
      "update news set image_path=$1,image=$2 where slug='renamed-workflow-news'",
      [
        prefix + "version/health_news_test_id.png",
        "https://test/storage/v1/object/public/municipal-media/" +
          prefix +
          "version/health_news_test_id.png",
      ],
    );
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-media' and name=$1 returning name",
          [prefix + "version/health_news_test_id.png"],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-news-staging' and name=$1 returning name",
          [prefix + "stage.png"],
        )
      ).rows,
    ).toHaveLength(1);
  });
  await as("viewer", async () => {
    await expect(
      db.query(
        "insert into storage.objects values('municipal-news-staging',$1)",
        [`news/${offices["municipal-health"]}/${users.viewer}/stage.png`],
      ),
    ).rejects.toThrow();
  });
});
