import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const migration = "202611230030_barangay_sk_seed.sql";
const migrationSQL = readFileSync(`supabase/migrations/${migration}`, "utf8");
const names = [
  "Anislag",
  "Anopog",
  "Binabag",
  "Buhingtubig",
  "Busay",
  "Butong",
  "Cabiangon",
  "Camugao",
  "Duangan",
  "Guimbawian",
  "Lamac",
  "Lut-od",
  "Mangoto",
  "Opao",
  "Pandacan",
  "Poblacion",
  "Punod",
  "Rizal",
  "Sacsac",
  "Sambagon",
  "Sibago",
  "Tajao",
  "Tangub",
  "Tanibag",
  "Tupas",
  "Tutay",
];
const ids = {
  anislag: "10000000-0000-4000-8000-000000000001",
  busay: "10000000-0000-4000-8000-000000000002",
  anislagSK: "20000000-0000-4000-8000-000000000001",
};
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  admin: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
const rich = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Preserved profile" }],
    },
  ],
};
let db: PGlite;
async function as(user: keyof typeof users | "anon", run: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user === "anon" ? "" : users[user],
  ]);
  await db.exec(`set role ${user === "anon" ? "anon" : "authenticated"}`);
  try {
    await run();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
  }
}
async function rows(table: string) {
  return (
    await db.query(
      `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
    )
  ).rows;
}
async function policySnapshot() {
  return (
    await db.query(`select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
    where tablename in('barangays','sk_profiles','objects') order by schemaname,tablename,policyname`)
  ).rows;
}
async function expectMigrationFailure(message: string) {
  const before = await Promise.all([
    rows("barangays"),
    rows("sk_profiles"),
    policySnapshot(),
  ]);
  await expect(db.exec(migrationSQL)).rejects.toThrow(message);
  await db.exec("rollback");
  expect(
    await Promise.all([
      rows("barangays"),
      rows("sk_profiles"),
      policySnapshot(),
    ]),
  ).toEqual(before);
}

test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema auth to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz not null);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create schema storage;grant usage on schema storage to anon,authenticated;
    create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create policy public_media_read on storage.objects for select to anon,authenticated using(bucket_id='municipal-media');`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql") && f < migration)
    .sort()) {
    if (file === "202609300002_media.sql") continue;
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file === "202610010005_legislative_modules.sql")
      await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  }
  for (const [role, id] of Object.entries(users)) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      `${role}@test.local`,
    ]);
    await db.query(
      "update staff_accounts set role=$1,active=true where user_id=$2",
      [role, id],
    );
  }
  await db.query(
    `insert into barangays(id,name,slug,captain_name,body,rich_body,image_url,published,sort_order) values
    ($1,'  aNiSlAg  ','anislag-established','Existing Captain','Preserved profile',$3::jsonb,
     'https://fixture.supabase.test/storage/v1/object/public/municipal-media/barangays/preserved/image.webp',false,91),
    ($2,'Busay','busay','Busay Captain','Existing Busay body',null,null,true,92)`,
    [ids.anislag, ids.busay, JSON.stringify(rich)],
  );
  await db.query(
    `insert into sk_profiles(id,barangay_id,slug,chairperson_name,body,rich_body,image_url,published,sort_order)
    values($1,$2,'anislag-youth-established','Existing Chairperson','Preserved profile',$3::jsonb,
    'https://fixture.supabase.test/storage/v1/object/public/municipal-media/sk/preserved/image.webp',false,93)`,
    [ids.anislagSK, ids.anislag, JSON.stringify(rich)],
  );
  await db.exec(`insert into storage.objects values
    ('municipal-media','barangays/preserved/image.webp'),('municipal-media','sk/preserved/image.webp')`);
});
test.afterAll(async () => {
  await db.close();
});

test("ambiguous normalized names fail before seed mutations", async () => {
  await db.exec(
    "insert into barangays(name,slug,captain_name,body) values('ANISLAG','anislag-ambiguous','Captain','Body')",
  );
  await expectMigrationFailure("Ambiguous barangay name: Anislag");
  expect(
    (
      await db.query(
        "select column_default from information_schema.columns where table_name='barangays' and column_name='captain_name'",
      )
    ).rows,
  ).toEqual([{ column_default: null }]);
  await db.exec("delete from barangays where slug='anislag-ambiguous'");
});

test("unrelated canonical Barangay and SK slug conflicts abort without modifying content", async () => {
  await db.exec(
    "insert into barangays(name,slug,captain_name,body) values('Unrelated Place','anopog','Captain','Body')",
  );
  await expectMigrationFailure("Conflicting barangay page address: anopog");
  await db.exec("delete from barangays where slug='anopog'");
  await db.exec(
    "insert into barangays(name,slug,captain_name,body) values('Unrelated Place','unrelated-place','Captain','Body')",
  );
  await db.exec(
    "insert into sk_profiles(barangay_id,slug,chairperson_name,body) select id,'anopog','Chairperson','Body' from barangays where slug='unrelated-place'",
  );
  await expectMigrationFailure("Conflicting SK page address: anopog");
  await db.exec("update sk_profiles set slug='anislag' where slug='anopog'");
  await expectMigrationFailure("Conflicting SK page address: anislag");
  await db.exec(
    "delete from sk_profiles where slug='anislag';delete from barangays where slug='unrelated-place'",
  );
});

test("upgrade seeds exactly 26 linked profiles while preserving all existing details and publication", async () => {
  const tables = [
    "departments",
    "staff_accounts",
    "user_office_access",
    "services",
    "municipal_contact_settings",
    "storage.objects",
  ];
  const before = await Promise.all(tables.map(rows));
  const existingBarangays = await rows("barangays");
  const existingSK = await rows("sk_profiles");
  const existingAudits = await rows("audit_logs");
  const policies = await policySnapshot();
  await db.exec(migrationSQL);
  expect(await Promise.all(tables.map(rows))).toEqual(before);
  expect(await policySnapshot()).toEqual(policies);
  expect(await rows("barangays")).toEqual(
    expect.arrayContaining(existingBarangays),
  );
  expect(await rows("sk_profiles")).toEqual(expect.arrayContaining(existingSK));
  expect(await rows("audit_logs")).toEqual(
    expect.arrayContaining(existingAudits),
  );
  const barangays = (
    await db.query<{
      name: string;
      slug: string;
      published: boolean;
      captain_name: string;
      body: string;
      sort_order: number;
    }>("select * from barangays")
  ).rows;
  const profiles = (
    await db.query<{
      barangay_id: string;
      slug: string;
      published: boolean;
      chairperson_name: string;
      body: string;
      sort_order: number;
    }>("select * from sk_profiles")
  ).rows;
  expect(barangays).toHaveLength(26);
  expect(profiles).toHaveLength(26);
  expect(barangays.map((row) => row.name.trim().toLowerCase()).sort()).toEqual(
    names.map((name) => name.toLowerCase()).sort(),
  );
  for (const [index, name] of names.entries()) {
    const barangay = barangays.find(
      (row) => row.name.trim().toLowerCase() === name.toLowerCase(),
    )!;
    if (!["Anislag", "Busay"].includes(name))
      expect(barangay).toMatchObject({
        slug: name.toLowerCase(),
        published: true,
        captain_name: "",
        body: "",
        sort_order: index + 1,
      });
    if (name !== "Anislag")
      expect(
        profiles.find((row) => row.slug === name.toLowerCase()),
      ).toMatchObject({
        published: true,
        chairperson_name: "",
        body: "",
        sort_order: index + 1,
      });
  }
  await as("anon", async () => {
    expect((await db.query("select id from barangays")).rows).toHaveLength(25);
    expect((await db.query("select id from sk_profiles")).rows).toHaveLength(
      25,
    );
  });
});

test("rerunning the migration preserves IDs, links, content, timestamps, order and audits", async () => {
  const before = await Promise.all([
    rows("barangays"),
    rows("sk_profiles"),
    rows("audit_logs"),
    rows("storage.objects"),
  ]);
  await db.exec(migrationSQL);
  expect(
    await Promise.all([
      rows("barangays"),
      rows("sk_profiles"),
      rows("audit_logs"),
      rows("storage.objects"),
    ]),
  ).toEqual(before);
});

test("blank optional fields use defaults while required names, upper bounds and rich safety remain enforced", async () => {
  await as("superadmin", async () => {
    const barangay = (
      await db.query<{ id: string; captain_name: string; body: string }>(
        "insert into barangays(name,slug) values('Blank Fields Fixture','blank-fields-fixture') returning id,captain_name,body",
      )
    ).rows[0];
    expect(barangay).toMatchObject({ captain_name: "", body: "" });
    expect(
      (
        await db.query(
          "insert into sk_profiles(barangay_id,slug) values($1,'blank-fields-fixture') returning chairperson_name,body",
          [barangay.id],
        )
      ).rows,
    ).toEqual([{ chairperson_name: "", body: "" }]);
    for (const [table, field, value] of [
      ["barangays", "name", ""],
      ["barangays", "name", "x".repeat(161)],
      ["barangays", "captain_name", "x".repeat(201)],
      ["barangays", "body", "x".repeat(30001)],
      ["sk_profiles", "chairperson_name", "x".repeat(201)],
      ["sk_profiles", "body", "x".repeat(30001)],
    ])
      await expect(
        db.query(`update ${table} set ${field}=$1`, [value]),
      ).rejects.toMatchObject({ code: "23514" });
    for (const table of ["barangays", "sk_profiles"]) {
      await expect(
        db.query(`update ${table} set body=null`),
      ).rejects.toMatchObject({ code: "23502" });
      await expect(
        db.query(`update ${table} set rich_body=$1::jsonb`, [
          JSON.stringify({ type: "doc", content: [{ type: "script" }] }),
        ]),
      ).rejects.toMatchObject({ code: "23514" });
      await db.query(
        `update ${table} set rich_body=$1::jsonb where slug='blank-fields-fixture'`,
        [JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] })],
      );
    }
  });
});

test("optional fields do not broaden Superadmin write access and revocation remains immediate", async () => {
  for (const role of ["admin", "editor", "viewer", "anon"] as const)
    await as(role, async () => {
      await expect(
        db.query("insert into barangays(name,slug) values('Forged','forged')"),
      ).rejects.toThrow();
      if (role !== "anon") {
        expect(
          (await db.query("update barangays set captain_name='' returning id"))
            .rows,
        ).toEqual([]);
        expect(
          (
            await db.query(
              "update sk_profiles set chairperson_name='' returning id",
            )
          ).rows,
        ).toEqual([]);
      }
      await expect(db.query("delete from barangays")).rejects.toThrow();
      await expect(db.query("delete from sk_profiles")).rejects.toThrow();
    });
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.superadmin,
  ]);
  await as("superadmin", async () => {
    expect(
      (await db.query("update barangays set captain_name='' returning id"))
        .rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "update sk_profiles set chairperson_name='' returning id",
        )
      ).rows,
    ).toEqual([]);
    await expect(
      db.query("insert into barangays(name,slug) values('Revoked','revoked')"),
    ).rejects.toThrow();
  });
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.superadmin,
  ]);
});
