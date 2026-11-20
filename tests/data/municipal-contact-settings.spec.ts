import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const migration = "202611190023_municipal_contact_settings.sql";
const suppliedMap =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d635.3927542769925!2d123.58431921186467!3d10.270176820265034!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a96f90bd4bd703%3A0x7e7ba0656a6eb073!2sPinamungajan%20Municipal%20Hall!5e1!3m2!1sen!2sph!4v1795094335905!5m2!1sen!2sph";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  admin: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
  revoked: "00000000-0000-4000-8000-000000000005",
};
let db: PGlite;
let before: unknown;

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

async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of [
    "officials",
    "ordinances",
    "resolutions",
    "news",
    "sessions",
    "services",
    "departments",
    "programs",
    "committees",
    "hearings",
    "document_categories",
    "municipal_documents",
    "department_contacts",
    "staff_accounts",
    "user_office_access",
    "department_slug_aliases",
    "legislative_terms",
    "committee_master",
    "audit_logs",
    "storage.objects",
    "storage.buckets",
  ]) {
    result[table] = (
      await db.query(
        `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
      )
    ).rows;
  }
  return result;
}

test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;create role authenticated;create schema auth;
    grant usage on schema auth to anon,authenticated;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage;grant usage on schema storage to anon,authenticated;
    create table storage.objects(bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$select string_to_array($1,'/')$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create policy public_media_read on storage.objects for select to anon,authenticated using(bucket_id='municipal-media');
  `);
  for (const file of readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql") && file < migration)
    .sort()) {
    if (file === "202609300002_media.sql") continue;
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file === "202610010005_legislative_modules.sql")
      await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  }
  for (const [name, id] of Object.entries(users))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      `${name}@test.local`,
    ]);
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id=$1",
    [users.superadmin],
  );
  const office = (
    await db.query<{ id: string }>(
      "select id from departments where department='executive' and active limit 1",
    )
  ).rows[0].id;
  await as("superadmin", async () => {
    for (const role of ["admin", "editor", "viewer"] as const)
      await db.query("select manage_staff($1,$2,true,$2,$3::jsonb)", [
        users[role],
        role,
        JSON.stringify([
          {
            office_id: office,
            permission_level: role === "admin" ? "manager" : role,
          },
        ]),
      ]);
    await db.query(
      "select manage_staff($1,'superadmin',true,'Revoked','[]'::jsonb)",
      [users.revoked],
    );
  });
  before = await snapshot();
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());

test("migration preserves existing content, contacts, access, audit history and storage", async () => {
  expect(await snapshot()).toEqual(before);
  await as("anon", async () => {
    expect(
      (await db.query("select * from municipal_contact_settings")).rows,
    ).toEqual([
      {
        id: "municipal",
        municipality_name: "Municipality of Pinamungajan",
        address: "Municipal Hall\nPinamungajan, Cebu\nPhilippines",
        telephone: null,
        email: null,
        office_hours: null,
        social_label: null,
        social_url: null,
        map_embed_url: suppliedMap,
        updated_at: expect.any(Date),
      },
    ]);
  });
});

test("only live Superadmins can update public settings; changes are audited and timestamped", async () => {
  const initial = (
    await db.query<{ updated_at: Date }>(
      "select updated_at from municipal_contact_settings",
    )
  ).rows[0].updated_at;
  await as("superadmin", async () => {
    expect(
      (
        await db.query(
          "update municipal_contact_settings set telephone='032 123 4567',email='contact@example.gov.ph',office_hours=E'Monday to Friday\\n8 AM to 5 PM',social_label='Official Facebook',social_url='https://www.facebook.com/municipality' where id='municipal' and updated_at=$1 returning id",
          [initial],
        )
      ).rows,
    ).toEqual([{ id: "municipal" }]);
    expect(
      (
        await db.query(
          "update municipal_contact_settings set telephone='Stale edit' where id='municipal' and updated_at=$1 returning id",
          [initial],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select user_id,action,entity_type,entity_id,description from audit_logs where entity_type='municipal_contact_settings'",
        )
      ).rows,
    ).toEqual([
      {
        user_id: users.superadmin,
        action: "update",
        entity_type: "municipal_contact_settings",
        entity_id: "municipal",
        description: "municipal_contact_settings update",
      },
    ]);
  });
  await as("anon", async () => {
    expect(
      (
        await db.query(
          "select telephone,email,office_hours,social_url,updated_at > $1 as timestamp_changed from municipal_contact_settings",
          [initial],
        )
      ).rows,
    ).toEqual([
      {
        telephone: "032 123 4567",
        email: "contact@example.gov.ph",
        office_hours: "Monday to Friday\n8 AM to 5 PM",
        social_url: "https://www.facebook.com/municipality",
        timestamp_changed: true,
      },
    ]);
    await expect(
      db.query("update municipal_contact_settings set telephone='Forged'"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  for (const role of ["admin", "editor", "viewer"] as const)
    await as(role, async () => {
      expect(
        (await db.query("select id from municipal_contact_settings")).rows,
      ).toEqual([{ id: "municipal" }]);
      expect(
        (
          await db.query(
            "update municipal_contact_settings set telephone='Forged' returning id",
          )
        ).rows,
      ).toEqual([]);
    });
});

test("demotion, deactivation and deletion revoke update access immediately", async () => {
  for (const state of [
    "role='admin'",
    "role='superadmin',active=false",
    "role='superadmin',active=false,deleted_at=now()",
  ]) {
    await db.exec(
      `update staff_accounts set ${state} where user_id='${users.revoked}'`,
    );
    await as("revoked", async () => {
      expect(
        (
          await db.query(
            "update municipal_contact_settings set municipality_name='Forged' returning id",
          )
        ).rows,
      ).toEqual([]);
    });
  }
  expect(
    (await db.query("select municipality_name from municipal_contact_settings"))
      .rows,
  ).toEqual([{ municipality_name: "Municipality of Pinamungajan" }]);
});

test("singleton identity and no client insert/delete are enforced even for Superadmin", async () => {
  for (const user of ["anon", "admin", "superadmin"] as const)
    await as(user, async () => {
      await expect(
        db.query(
          "insert into municipal_contact_settings(municipality_name,address) values('Duplicate','Address')",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query("delete from municipal_contact_settings"),
      ).rejects.toMatchObject({ code: "42501" });
    });
  await as("superadmin", async () => {
    await expect(
      db.query("update municipal_contact_settings set id='other'"),
    ).rejects.toMatchObject({ code: "23514" });
  });
  await expect(
    db.query(
      "insert into municipal_contact_settings(municipality_name,address) values('Duplicate','Address')",
    ),
  ).rejects.toMatchObject({ code: "23505" });
  expect(
    (await db.query("select id from municipal_contact_settings")).rows,
  ).toEqual([{ id: "municipal" }]);
});

test("direct writes reject invalid lengths, emails, unsafe URLs and iframe HTML", async () => {
  const invalid: Array<[string, string]> = [
    ["municipality_name", " "],
    ["municipality_name", "x".repeat(161)],
    ["address", ""],
    ["address", "x".repeat(1001)],
    ["telephone", ""],
    ["telephone", "x".repeat(101)],
    ["office_hours", "x".repeat(1001)],
    ["social_label", "x".repeat(101)],
    ["email", "invalid"],
    ["email", "test@example.gov.ph\ninvalid"],
    ["email", `${"x".repeat(250)}@a.ph`],
    ["social_url", "javascript:alert(1)"],
    ["social_url", "http://example.com"],
    ["social_url", "https://user:password@example.com"],
    ["social_url", "https://example.com\ninvalid"],
    ["social_url", `https://example.com/${"x".repeat(2048)}`],
    ["map_embed_url", "https://www.google.com.evil.test/maps/embed?pb=123"],
    ["map_embed_url", "https://www.google.com@evil.test/maps/embed?pb=123"],
    ["map_embed_url", "https://evil.test/maps/embed?pb=123"],
    ["map_embed_url", "http://www.google.com/maps/embed?pb=123"],
    ["map_embed_url", "https://www.google.com/maps/embed?pb="],
    ["map_embed_url", "https://www.google.com/maps/embed?pb=123\ninvalid"],
    ["map_embed_url", `<iframe src="${suppliedMap}"></iframe>`],
    [
      "map_embed_url",
      `https://www.google.com/maps/embed?pb=${"x".repeat(4096)}`,
    ],
  ];
  await as("superadmin", async () => {
    for (const [column, value] of invalid)
      await expect(
        db.query(`update municipal_contact_settings set ${column}=$1`, [value]),
        `${column}: ${value.slice(0, 60)}`,
      ).rejects.toMatchObject({ code: "23514" });
    await db.query(
      "update municipal_contact_settings set telephone=null,email=null,office_hours=null,social_label=null,social_url=null,map_embed_url=null",
    );
  });
  await as("anon", async () => {
    expect(
      (
        await db.query(
          "select telephone,email,office_hours,social_label,social_url,map_embed_url from municipal_contact_settings",
        )
      ).rows,
    ).toEqual([
      {
        telephone: null,
        email: null,
        office_hours: null,
        social_label: null,
        social_url: null,
        map_embed_url: null,
      },
    ]);
  });
});
