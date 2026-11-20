import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { branchAllows } from "../../lib/offices/collections";
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
test("Executive collection availability excludes Legislative modules", () => {
  for (const c of [
    "departments",
    "news",
    "programs",
    "services",
    "contacts",
  ] as const)
    expect(branchAllows("executive", c)).toBe(true);
  for (const c of [
    "officials",
    "ordinances",
    "resolutions",
    "sessions",
    "committees",
    "hearings",
    "documents",
    "documentCategories",
  ] as const) {
    expect(branchAllows("executive", c)).toBe(false);
    expect(branchAllows("legislative", c)).toBe(true);
  }
});
test("migration preserves seeded content and provisions new office profiles", async () => {
  expect(
    (await db.query("select * from officials where id='members'")).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query("select * from departments where office_id=$1", [
        offices.menro,
      ])
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query<{ office_id: string }>(
        "select office_id from departments where id='health'",
      )
    ).rows[0].office_id,
  ).toBe(offices["municipal-health"]);
});
test("MHO edits only own profile, cannot transfer, create or delete departments", async () => {
  await as("mho", async () => {
    expect(
      (
        await db.query(
          "update departments set head_name='Dr. Test',head_title='Municipal Health Officer',slug='mho',published=true where id='health' returning id",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "update departments set head_name='Unauthorized' where office_id=$1 returning id",
          [offices.menro],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("update departments set office_id=$1 where id='health'", [
        offices.menro,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into departments(id,name,description,office_id) values('unauthorized','Bad','Bad',$1)",
        [offices["municipal-health"]],
      ),
    ).rejects.toThrow();
    expect(
      (await db.query("delete from departments where id='health' returning id"))
        .rows,
    ).toHaveLength(0);
  });
});
test("forged MENRO news write raises PostgreSQL 42501 (PostgREST HTTP 403)", async () => {
  await as("mho", async () => {
    await expect(
      db.query(
        "insert into news(slug,title,category,date,excerpt,image,content,office_id,content_scope) values('forged','Forged','Health','2026-10-02','Test','/images/test.webp',ARRAY['Test'],$1,'executive')",
        [offices.menro],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query(
      "insert into news(slug,title,category,date,excerpt,image,content,office_id,content_scope,published) values('mho-news','MHO News','Health','2026-10-02','Test','/images/test.webp',ARRAY['Test'],$1,'executive',true)",
      [offices["municipal-health"]],
    );
    await db.query(
      "insert into programs(id,name,description,category,status,office_id,content_scope,published) values('mho-program','MHO Program','Test','Health','Active',$1,'executive',true)",
      [offices["municipal-health"]],
    );
    expect(
      (
        await db.query(
          "update news set title='MHO Edited' where slug='mho-news' returning slug",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update news set office_id=$1 where slug='mho-news'", [
        offices.menro,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
test("Executive users cannot create Legislative content even under their own office", async () => {
  await as("mho", async () => {
    for (const table of [
      "officials",
      "ordinances",
      "resolutions",
      "sessions",
      "committees",
      "hearings",
      "document_categories",
      "municipal_documents",
    ])
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select can_manage_collection($1,'executive',$2,'write') ok",
            [table, offices["municipal-health"]],
          )
        ).rows[0].ok,
      ).toBe(false);
    await expect(
      db.query(
        "insert into officials(name,role,branch,description,office_id,content_scope) values('Bad','Bad','executive','Bad',$1,'executive')",
        [offices["municipal-health"]],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
test("Legislative has all branch collections; superadmin remains unrestricted", async () => {
  await as("legislative", async () => {
    for (const table of [
      "officials",
      "ordinances",
      "resolutions",
      "news",
      "sessions",
      "committees",
      "hearings",
      "document_categories",
      "municipal_documents",
    ])
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select can_manage_collection($1,'legislative',$2,'write') ok",
            [table, offices["legislative-access"]],
          )
        ).rows[0].ok,
      ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select can_manage_collection('news','executive',$1,'write') ok",
          [offices["municipal-health"]],
        )
      ).rows[0].ok,
    ).toBe(false);
  });
  await as("superadmin", async () => {
    expect(
      (
        await db.query(
          "update departments set head_name='Environment head' where office_id=$1 returning id",
          [offices.menro],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select can_manage_collection('officials','executive',$1,'write') ok",
          [offices["municipal-health"]],
        )
      ).rows[0].ok,
    ).toBe(true);
  });
});
test("department photo storage enforces user prefix, reference protection and viewer limits", async () => {
  const path = `departments/${users.mho}/head.webp`;
  await as("mho", async () => {
    await db.query("insert into storage.objects values('municipal-media',$1)", [
      path,
    ]);
    await db.query("update departments set head_photo=$1 where id='health'", [
      "https://test.local/storage/v1/object/public/municipal-media/" + path,
    ]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [path],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("insert into storage.objects values('municipal-media',$1)", [
        `departments/${users.superadmin}/bad.webp`,
      ]),
    ).rejects.toThrow();
  });
  await as("viewer", async () => {
    await expect(
      db.query("insert into storage.objects values('municipal-media',$1)", [
        `departments/${users.viewer}/bad.webp`,
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update news set title='Bad' where slug='mho-news' returning slug",
        )
      ).rows,
    ).toHaveLength(0);
  });
});
test("anonymous public projection exposes source links and no draft articles", async () => {
  await db.exec("set role anon");
  try {
    const rows = (
      await db.query<{ source: { name: string; slug: string } }>(
        "select source from published_news where slug='mho-news'",
      )
    ).rows;
    expect(rows[0].source.slug).toBe("mho");
    expect(
      (await db.query("select * from published_news where not published")).rows,
    ).toHaveLength(0);
  } finally {
    await db.exec("reset role");
  }
});
test("MHO can delete own news/programs but not another office's records", async () => {
  await as("superadmin", async () => {
    await db.query(
      "insert into programs(id,name,description,category,status,office_id,published) values('menro-program','MENRO','Test','Environment','Active',$1,true)",
      [offices.menro],
    );
  });
  await as("mho", async () => {
    expect(
      (
        await db.query(
          "delete from programs where id='menro-program' returning id",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from programs where id='mho-program' returning id",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("delete from news where slug='mho-news' returning slug"))
        .rows,
    ).toHaveLength(1);
  });
});
