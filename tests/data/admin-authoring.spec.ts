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

let preserved: unknown[];
let historical: unknown[];
test.beforeAll(async () => {
  historical = (
    await db.query(
      "select content_scope,office_id,array_agg(id order by sort_order,id) ids from news where published group by content_scope,office_id order by content_scope,office_id",
    )
  ).rows;
  preserved = (
    await db.query("select id,slug,image,content from news order by id")
  ).rows;
  await db.exec(
    readFileSync(
      "supabase/migrations/202610100012_admin_authoring.sql",
      "utf8",
    ),
  );
});
test("migration preserves legacy content and assigns positive unique positions", async () => {
  expect(
    (await db.query("select id,slug,image,content from news order by id")).rows,
  ).toEqual(preserved);
  expect(
    (
      await db.query(
        "select content_scope,office_id,array_agg(id order by sort_order,id) ids from news where published group by content_scope,office_id order by content_scope,office_id",
      )
    ).rows,
  ).toEqual(historical);
  for (const t of ["officials", "departments", "news", "programs"]) {
    expect(
      (
        await db.query(
          `select count(*)::int n from ${t} where (published and sort_order<1) or (not published and sort_order<>0)`,
        )
      ).rows,
    ).toEqual([{ n: 0 }]);
    expect(
      (
        await db.query(
          `select count(*)::int n from (select public.portal_sort_scope('${t}',to_jsonb(x)),sort_order from ${t} x where published group by 1,2 having count(*)>1) q`,
        )
      ).rows,
    ).toEqual([{ n: 0 }]);
  }
});
test("positions shift safely, unpublished uses zero and cross-office writes fail", async () => {
  const office = offices["municipal-health"];
  await as("mho", async () => {
    for (const [id, pos] of [
      ["sort-one", 1],
      ["sort-two", 1],
      ["sort-three", 2],
    ] as const)
      await db.query(
        "insert into programs(id,slug,name,description,category,status,office_id,content_scope,published,sort_order) values($1,$1,$1,'Body','Test','Active',$2,'executive',true,$3)",
        [id, office, pos],
      );
    expect(
      (
        await db.query<{ id: string }>(
          "select id from programs where office_id=$1 and published order by sort_order",
          [office],
        )
      ).rows.map((r) => r.id),
    ).toEqual(["sort-two", "sort-three", "sort-one"]);
    await db.query(
      "update programs set published=false,sort_order=99 where id='sort-three'",
    );
    expect(
      (await db.query("select sort_order from programs where id='sort-three'"))
        .rows,
    ).toEqual([{ sort_order: 0 }]);
    await expect(
      db.query(
        "update programs set published=true,sort_order=0 where id='sort-three'",
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update programs set published=true,sort_order=99 where id='sort-three'",
      ),
    ).rejects.toThrow();
    await db.query(
      "update programs set published=true,sort_order=1 where id='sort-three'",
    );
    await db.query("delete from programs where id='sort-two'");
    expect(
      (
        await db.query(
          "select sort_order from programs where office_id=$1 and published order by sort_order",
          [office],
        )
      ).rows,
    ).toEqual([{ sort_order: 1 }, { sort_order: 2 }]);
    await expect(
      db.query("update programs set office_id=$1 where id='sort-one'", [
        offices.menro,
      ]),
    ).rejects.toThrow();
  });
});
test("database rejects malicious rich documents and retains safe formatting", async () => {
  await as("mho", async () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { size: "large" },
          content: [{ type: "text", text: "Safe", marks: [{ type: "bold" }] }],
        },
      ],
    };
    await db.query("update programs set rich_body=$1 where id='sort-one'", [
      JSON.stringify(doc),
    ]);
    expect(
      (await db.query("select rich_body from programs where id='sort-one'"))
        .rows,
    ).toEqual([{ rich_body: doc }]);
    for (const value of [
      { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
      {
        type: "doc",
        content: [{ type: "paragraph", attrs: { style: "color:red" } }],
      },
    ])
      await expect(
        db.query("update programs set rich_body=$1 where id='sort-one'", [
          JSON.stringify(value),
        ]),
      ).rejects.toThrow();
  });
});

test("reorders invalidate stale writes and retain department publication authority", async () => {
  await as("mho", async () => {
    const old = (
      await db.query<{ updated_at: string }>(
        "select updated_at::text from programs where id='sort-one'",
      )
    ).rows[0].updated_at;
    await db.query("update programs set sort_order=1 where id='sort-one'");
    const stale = await db.query(
      "update programs set description='stale overwrite' where id='sort-one' and updated_at=$1 returning id",
      [old],
    );
    expect(stale.rows).toHaveLength(0);
    await expect(
      db.query("update departments set published=not published where id=$1", [
        offices["municipal-health"],
      ]),
    ).rejects.toThrow();
  });
  await as("viewer", async () => {
    expect(
      (
        await db.query(
          "update programs set sort_order=2 where id='sort-one' returning id",
        )
      ).rows,
    ).toHaveLength(0);
  });
  await as("superadmin", async () => {
    await db.query(
      "insert into programs(id,slug,name,description,category,status,office_id,content_scope,published,sort_order) values('another-scope','another-scope','Another','Body','Test','Active',$1,'executive',true,1)",
      [offices.menro],
    );
    expect(
      (
        await db.query(
          "select sort_order from programs where id='another-scope'",
        )
      ).rows,
    ).toEqual([{ sort_order: 1 }]);
  });
});
