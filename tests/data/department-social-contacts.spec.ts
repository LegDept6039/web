import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const migration = "202611190024_department_social_contacts.sql";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
};
let db: PGlite;
let office: string;
let otherOffice: string;
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
    "department_contacts",
    "departments",
    "staff_accounts",
    "user_office_access",
    "municipal_contact_settings",
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
  const offices = (
    await db.query<{ id: string }>(
      "select id from departments where department='executive' and active and published and archived_at is null order by id limit 2",
    )
  ).rows;
  [office, otherOffice] = offices.map((row) => row.id);
  await as("superadmin", async () => {
    for (const role of ["editor", "viewer"] as const)
      await db.query("select manage_staff($1,$2,true,$2,$3::jsonb)", [
        users[role],
        role,
        JSON.stringify([{ office_id: office, permission_level: role }]),
      ]);
    for (const [type, value] of [
      ["PHONE", "09170000000"],
      ["LANDLINE", "032 123 4567"],
      ["EMAIL", "office@example.gov.ph"],
      ["LOCATION", "Municipal Hall"],
    ]) {
      await db.query(
        "insert into department_contacts(id,office_id,type,value,label,sort_order) values($1,$2,$3,$4,null,1)",
        [`legacy-${type}`, office, type, value],
      );
    }
  });
  before = await snapshot();
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());

test("social contact migration preserves existing records, access and audit history", async () => {
  expect(await snapshot()).toEqual(before);
  await as("editor", async () => {
    expect(
      (
        await db.query(
          "update department_contacts set value='Updated address' where id='legacy-LOCATION' returning type,label",
        )
      ).rows,
    ).toEqual([{ type: "LOCATION", label: null }]);
  });
});

test("assigned editors can create and edit labeled social contacts; drafts stay private", async () => {
  await as("editor", async () => {
    await db.query(
      "insert into department_contacts(id,office_id,type,value,label,published) values('editor-social',$1,'SOCIAL','https://www.facebook.com/municipal-office','Official Facebook',false)",
      [office],
    );
    expect(
      (
        await db.query(
          "update department_contacts set label='Office Facebook',value='https://www.facebook.com/office-page' where id='editor-social' returning label,value,published,created_by",
        )
      ).rows,
    ).toEqual([
      {
        label: "Office Facebook",
        value: "https://www.facebook.com/office-page",
        published: false,
        created_by: users.editor,
      },
    ]);
  });
  await as("anon", async () => {
    expect(
      (
        await db.query(
          "select id from department_contacts where id='editor-social'",
        )
      ).rows,
    ).toEqual([]);
  });
  await as("editor", async () => {
    await db.query(
      "update department_contacts set published=true,sort_order=1 where id='editor-social'",
    );
  });
  await as("anon", async () => {
    expect(
      (
        await db.query(
          "select type,label,value from department_contacts where id='editor-social'",
        )
      ).rows,
    ).toEqual([
      {
        type: "SOCIAL",
        label: "Office Facebook",
        value: "https://www.facebook.com/office-page",
      },
    ]);
  });
});

test("viewers and unassigned editors cannot create, edit or transfer social contacts", async () => {
  await as("superadmin", async () => {
    await db.query(
      "insert into department_contacts(id,office_id,type,value,label,sort_order) values('other-social',$1,'SOCIAL','https://example.gov.ph/social','Other Office',1)",
      [otherOffice],
    );
  });
  for (const user of ["viewer", "editor"] as const) {
    await as(user, async () => {
      const targetOffice = user === "viewer" ? office : otherOffice;
      const targetId = user === "viewer" ? "editor-social" : "other-social";
      await expect(
        db.query(
          "insert into department_contacts(office_id,type,value,label,published) values($1,'SOCIAL','https://example.gov.ph/social','Forbidden',false)",
          [targetOffice],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      expect(
        (
          await db.query(
            "update department_contacts set label='Forged' where id=$1 returning id",
            [targetId],
          )
        ).rows,
      ).toEqual([]);
    });
  }
  await as("editor", async () => {
    await expect(
      db.query(
        "update department_contacts set office_id=$1 where id='editor-social'",
        [otherOffice],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

test("social links disappear publicly when their department is unpublished or inactive", async () => {
  for (const column of ["published", "active"]) {
    await as("superadmin", async () => {
      await db.query(`update departments set ${column}=false where id=$1`, [
        office,
      ]);
    });
    await as("anon", async () => {
      expect(
        (
          await db.query(
            "select id from department_contacts where office_id=$1",
            [office],
          )
        ).rows,
      ).toEqual([]);
    });
    await as("superadmin", async () => {
      await db.query(
        `update departments set ${column}=true,sort_order=1 where id=$1`,
        [office],
      );
    });
  }
  await as("anon", async () => {
    expect(
      (
        await db.query(
          "select id from department_contacts where id='editor-social'",
        )
      ).rows,
    ).toEqual([{ id: "editor-social" }]);
  });
});

test("database rejects missing labels and unsafe or oversized social URLs", async () => {
  const invalid: Array<[string, unknown]> = [
    ["label", null],
    ["label", ""],
    ["label", " \t\n"],
    ["label", "x".repeat(101)],
    ["value", "javascript:alert(1)"],
    ["value", "http://example.com/social"],
    ["value", "//example.com/social"],
    ["value", "https://user:password@example.com/social"],
    ["value", "https://example.com\n/social"],
    ["value", "https://example.com/a b"],
    ["value", "https://example.com\\@evil.test/social"],
    ["value", "https://example.com/<script>"],
    ["value", 'https://example.com/"social'],
    ["value", "https://example.com/'social"],
    ["value", "https://"],
    ["value", `https://example.com/${"a".repeat(1000)}`],
    ["type", "UNSUPPORTED"],
  ];
  await as("editor", async () => {
    for (const [column, value] of invalid)
      await expect(
        db.query(
          `update department_contacts set ${column}=$1 where id='editor-social'`,
          [value],
        ),
        `${column}: ${String(value).slice(0, 60)}`,
      ).rejects.toMatchObject({ code: "23514" });
    expect(
      (
        await db.query(
          "select label,value from department_contacts where id='editor-social'",
        )
      ).rows,
    ).toEqual([
      {
        label: "Office Facebook",
        value: "https://www.facebook.com/office-page",
      },
    ]);
  });
});
