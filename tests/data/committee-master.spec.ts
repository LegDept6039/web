import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { parseLegislative } from "../../lib/legislative/validation";
const current = "20000000-0000-4000-8000-000000000001";
const next = "20000000-0000-4000-8000-000000000002";
let before: unknown;
let master: string;
let chair: string;
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

test.beforeAll(async () => {
  await db.exec(
    readFileSync(
      "supabase/migrations/202610100012_admin_authoring.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611060014_legislative_workspace.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611090015_legislative_pdf_uploads.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611100016_transparency.sql", "utf8"),
  );
  await db.exec(
    "grant usage on schema storage,auth to anon;grant select on storage.objects to anon",
  );
});

test.beforeAll(async () => {
  for (const file of [
    "202611100017_transparency_reports.sql",
    "202611130018_transparency_access.sql",
    "202611160019_legislative_terms.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
});

test.beforeAll(async () => {
  await as("superadmin", async () => {
    await db.query(
      "insert into legislative_terms(id,name,start_date,end_date) values($1,'Current','2025-07-01','2028-06-30'),($2,'Next','2028-07-01','2031-06-30')",
      [current, next],
    );
    await db.query(
      "update officials set term_id=$1 where content_scope='legislative'",
      [current],
    );
    chair = (
      await db.query<{ id: string }>(
        "select id from officials where content_scope='legislative' order by id limit 1",
      )
    ).rows[0].id;
    await db.query(
      "update committees set name='Committee on Finance, Budget and Appropriation',term_id=$1,chair_id=$2 where id='finance'",
      [current, chair],
    );
    for (const table of ["ordinances", "resolutions"])
      await db.query(
        `update ${table} set year=2026,date_approved='2026-11-18',author_id=$1,committee_id='finance' where id=(select id from ${table} limit 1)`,
        [chair],
      );
    await db.query(
      "insert into committees(id,name,responsibility,chair,term_id,content_scope,office_id,published,sort_order) values('ambiguous-a','Committee on Education','','',$1,'legislative',$3,false,0),('ambiguous-b','Committee on Education','','',$2,'legislative',$3,false,0),('similar','Committee on EDUCATION','','',$1,'legislative',$3,false,0)",
      [current, next, offices["legislative-access"]],
    );
  });
  before = (
    await db.query("select to_jsonb(c) row from committees c order by id")
  ).rows;
  await db.exec(
    readFileSync(
      "supabase/migrations/202611180020_committee_master.sql",
      "utf8",
    ),
  );
  master = (
    await db.query<{ master_id: string }>(
      "select master_id from committees where id='finance'",
    )
  ).rows[0].master_id;
});

test("catalog migration preserves records and links, leaving ambiguous associations for review", async () => {
  expect(
    (
      await db.query(
        "select to_jsonb(c)-'master_id' row from committees c order by id",
      )
    ).rows,
  ).toEqual(before);
  expect(master).toBeTruthy();
  expect(
    (
      await db.query(
        "select master_id from committees where id in ('ambiguous-a','ambiguous-b')",
      )
    ).rows,
  ).toEqual([{ master_id: null }, { master_id: null }]);
  expect(
    (await db.query("select master_id from committees where id='similar'"))
      .rows,
  ).toEqual([{ master_id: null }]);
  expect((await db.query("select id from committee_master")).rows).toHaveLength(
    25,
  );
  for (const table of ["ordinances", "resolutions"])
    expect(
      (await db.query(`select id from ${table} where committee_id='finance'`))
        .rows,
    ).toHaveLength(1);
});

test("catalog authority, empty compositions, term isolation, rename snapshots and RLS", async () => {
  await as("superadmin", async () => {
    await db.query(
      "update committee_master set name='Renamed master catalog',sort_order=8 where id=$1",
      [master],
    );
    await db.query(
      "select manage_staff($1,'viewer',true,'Viewer',$2::jsonb,false)",
      [
        users.viewer,
        JSON.stringify([
          {
            office_id: offices["legislative-access"],
            permission_level: "viewer",
          },
        ]),
      ],
    );
  });
  expect(
    (
      await db.query<{ name: string }>(
        "select name from committees where id='finance'",
      )
    ).rows[0].name,
  ).not.toBe("Renamed master catalog");
  await as("legislative", async () => {
    expect(
      (await db.query("select id from committee_master")).rows.length,
    ).toBeGreaterThan(0);
    await expect(
      db.exec("insert into committee_master(name) values('Forbidden')"),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update committee_master set name='Forbidden' where id=$1 returning id",
          [master],
        )
      ).rows,
    ).toHaveLength(0);
    await db.query(
      "insert into committees(id,name,responsibility,chair,master_id,term_id,content_scope,office_id,published,sort_order) values('next-composition','Forged name','','',$1,$2,'legislative',$3,false,0)",
      [master, next, offices["legislative-access"]],
    );
    expect(
      (
        await db.query<{ name: string }>(
          "select name from committees where id='next-composition'",
        )
      ).rows[0].name,
    ).toBe("Renamed master catalog");
    await expect(
      db.query(
        "insert into committees(name,responsibility,chair,master_id,term_id,content_scope,office_id,published,sort_order) values('Duplicate','','',$1,$2,'legislative',$3,false,0)",
        [master, next, offices["legislative-access"]],
      ),
    ).rejects.toThrow(/unique/);
    await expect(
      db.query(
        "update committees set chair_id=$1 where id='next-composition'",
        [chair],
      ),
    ).rejects.toThrow(/same Legislative Term/);
    await expect(
      db.exec(
        "update committees set name='Rewrite history' where id='finance'",
      ),
    ).rejects.toThrow(/Historical committee names/);
    await expect(
      db.exec("update committees set master_id=null where id='finance'"),
    ).rejects.toThrow(/retain its master/);
    const ambiguous = (
      await db.query<{ id: string }>(
        "select id from committee_master where name='Committee on Education'",
      )
    ).rows[0].id;
    await db.query(
      "update committees set master_id=$1 where id='ambiguous-a'",
      [ambiguous],
    );
    await db.query(
      "update committees set master_id=$1 where id='ambiguous-b'",
      [ambiguous],
    );
  });
  await as("viewer", async () => {
    expect(
      (await db.query("select id from committee_master")).rows.length,
    ).toBeGreaterThan(0);
    expect(
      (
        await db.query(
          "update committees set responsibility='Denied' where id='next-composition' returning id",
        )
      ).rows,
    ).toHaveLength(0);
  });
  await as("mho", async () => {
    expect(
      (await db.query("select id from committee_master")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into committees(name,responsibility,chair,master_id,term_id,content_scope,office_id,published,sort_order) values('Denied','','',$1,$2,'legislative',$3,false,0)",
        [master, next, offices["legislative-access"]],
      ),
    ).rejects.toThrow();
  });
  await db.exec("set role anon");
  try {
    expect(
      (await db.query("select id from committees where id='next-composition'"))
        .rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select id from committees where id='finance'")).rows,
    ).toHaveLength(1);
    await expect(db.exec("select * from committee_master")).rejects.toThrow();
  } finally {
    await db.exec("reset role");
  }
  await as("superadmin", async () => {
    await db.query(
      "insert into legislative_terms(name,start_date,end_date) values('Future','2031-07-01','2034-06-30')",
    );
    expect(
      (
        await db.query(
          "select id from committees where term_id=(select id from legislative_terms where name='Future')",
        )
      ).rows,
    ).toHaveLength(0);
    await expect(db.exec("delete from committee_master")).rejects.toThrow();
  });
});

test("committee parsing accepts empty positions, ignores client names and preserves identity", () => {
  const form = new FormData();
  form.set("master_id", "catalog-id");
  form.set("name", "Forged");
  const row = parseLegislative("committees", form, null);
  expect(row.name).toBe("");
  expect(row.chair_id).toBeNull();
  expect(row.vice_chair_id).toBeNull();
  const legacy = parseLegislative("committees", form, {
    id: "finance",
    name: "Historical",
    master_id: "original",
  });
  expect(legacy).toMatchObject({
    id: "finance",
    name: "Historical",
    master_id: "original",
  });
  form.set("chair_id", "one");
  form.set("member_1_id", "one");
  expect(() => parseLegislative("committees", form, null)).toThrow(
    /different official/,
  );
});
