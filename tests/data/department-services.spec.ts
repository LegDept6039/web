import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const migration = "202611200025_department_services.sql";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
};
let db: PGlite;
let office: string;
let otherOffice: string;
let legislativeOffice: string;
let before: unknown;
let editorService: string;

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

async function assignEditor(enabled = true) {
  await as("superadmin", async () => {
    await db.query("select manage_staff($1,'editor',true,'Editor',$2::jsonb)", [
      users.editor,
      JSON.stringify(
        enabled ? [{ office_id: office, permission_level: "editor" }] : [],
      ),
    ]);
  });
}

async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of [
    "services",
    "departments",
    "staff_accounts",
    "user_office_access",
    "department_contacts",
    "news",
    "programs",
    "audit_logs",
    "storage.objects",
  ]) {
    const row = table === "services" ? "to_jsonb(r)-'body'" : "to_jsonb(r)";
    result[table] = (
      await db.query(`select ${row} row from ${table} r order by ${row}::text`)
    ).rows;
  }
  return result;
}

async function insertService(
  id: string,
  owner: string | null,
  published = false,
) {
  return db.query(
    "insert into services(id,name,description,body,icon,office,office_id,published,sort_order) values($1,'Service title','Legacy-compatible description',E'First line\\nSecond line','FileText','Department',$2,$3,$4) returning id",
    [id, owner, published, published ? 1 : 0],
  );
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
  for (const [role, id] of Object.entries(users))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      `${role}@test.local`,
    ]);
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id=$1",
    [users.superadmin],
  );
  [office, otherOffice] = (
    await db.query<{ id: string }>(
      "select id from departments where department='executive' and active and published and archived_at is null order by id limit 2",
    )
  ).rows.map((row) => row.id);
  legislativeOffice = (
    await db.query<{ id: string }>(
      "select id from departments where department='legislative' and active and archived_at is null",
    )
  ).rows[0].id;
  await assignEditor();
  await as("superadmin", async () => {
    await db.query("select manage_staff($1,'viewer',true,'Viewer',$2::jsonb)", [
      users.viewer,
      JSON.stringify([{ office_id: office, permission_level: "viewer" }]),
    ]);
  });
  before = await snapshot();
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());

test("migration preserves legacy services and all existing content, access and audit records", async () => {
  expect(await snapshot()).toEqual(before);
  expect(
    (await db.query("select id from services where body is not null")).rows,
  ).toEqual([]);
  await as("anon", async () => {
    expect(
      (
        await db.query(
          "select id from services where published and office_id is null",
        )
      ).rows.length,
    ).toBeGreaterThan(0);
  });
  expect(
    (
      await db.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name='services' and data_type='date'",
      )
    ).rows,
  ).toEqual([]);
});

test("assigned editor creates a UUID service, preserves multiline body, publishes and retains authored identity", async () => {
  await as("editor", async () => {
    editorService = (
      await db.query<{ id: string }>(
        "insert into services(name,description,body,icon,office,office_id,created_by) values('Permit assistance','Summary',E'Bring your valid ID.\\nVisit the service desk.','FileText','Office',$1,$2) returning id",
        [office, users.superadmin],
      )
    ).rows[0].id;
    expect(editorService).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      (
        await db.query(
          "select body,published,created_by from services where id=$1",
          [editorService],
        )
      ).rows,
    ).toEqual([
      {
        body: "Bring your valid ID.\nVisit the service desk.",
        published: false,
        created_by: users.editor,
      },
    ]);
  });
  await as("viewer", async () =>
    expect(
      (await db.query("select id from services where id=$1", [editorService]))
        .rows,
    ).toEqual([{ id: editorService }]),
  );
  await as("anon", async () =>
    expect(
      (await db.query("select id from services where id=$1", [editorService]))
        .rows,
    ).toEqual([]),
  );
  await as("editor", async () => {
    await db.query(
      "update services set name='Updated assistance',body='Updated details',published=true,sort_order=1,created_by=$1 where id=$2",
      [users.superadmin, editorService],
    );
  });
  await as("anon", async () =>
    expect(
      (
        await db.query(
          "select name,body,published,created_by from services where id=$1",
          [editorService],
        )
      ).rows,
    ).toEqual([
      {
        name: "Updated assistance",
        body: "Updated details",
        published: true,
        created_by: users.editor,
      },
    ]),
  );
  expect(
    (
      await db.query(
        "select action from audit_logs where entity_type='services' and entity_id=$1 order by id",
        [editorService],
      )
    ).rows,
  ).toEqual([{ action: "insert" }, { action: "update" }]);
});

test("viewers and other offices cannot write services or forge ownership", async () => {
  await as("superadmin", async () => {
    await insertService("other-service", otherOffice);
  });
  for (const role of ["viewer", "editor"] as const) {
    await as(role, async () => {
      await expect(
        insertService(
          `forbidden-${role}`,
          role === "viewer" ? office : otherOffice,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      const target = role === "viewer" ? editorService : "other-service";
      expect(
        (
          await db.query(
            "update services set body='Forged update' where id=$1 returning id",
            [target],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await db.query("delete from services where id=$1 returning id", [
            target,
          ])
        ).rows,
      ).toEqual([]);
    });
  }
  await as("editor", async () => {
    expect(
      (await db.query("select id from services where id='other-service'")).rows,
    ).toEqual([]);
    await expect(
      db.query("update services set office_id=$1 where id=$2", [
        otherOffice,
        editorService,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "update services set content_scope='legislative',office_id=$1 where id=$2",
        [legislativeOffice, editorService],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      insertService("wrong-branch-service", legislativeOffice),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("update services set id='changed-service-id' where id=$1", [
        editorService,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

test("services are hidden publicly when their department is unpublished, inactive or archived", async () => {
  for (const patch of [
    "published=false",
    "active=false",
    "archived_at=now()",
  ]) {
    await as("superadmin", async () => {
      await db.query(`update departments set ${patch} where id=$1`, [office]);
    });
    await as("anon", async () =>
      expect(
        (await db.query("select id from services where id=$1", [editorService]))
          .rows,
      ).toEqual([]),
    );
    await as("superadmin", async () => {
      await db.query(
        "update departments set published=true,active=true,archived_at=null,sort_order=1 where id=$1",
        [office],
      );
    });
  }
  await as("anon", async () =>
    expect(
      (await db.query("select id from services where id=$1", [editorService]))
        .rows,
    ).toEqual([{ id: editorService }]),
  );
});

test("revoking department access immediately blocks draft reads and all service writes", async () => {
  await as("editor", async () => {
    await insertService("revocation-service", office);
  });
  await assignEditor(false);
  await as("editor", async () => {
    expect(
      (await db.query("select id from services where id='revocation-service'"))
        .rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "update services set body='Blocked update' where id='revocation-service' returning id",
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "delete from services where id='revocation-service' returning id",
        )
      ).rows,
    ).toEqual([]);
    await expect(insertService("revoked-create", office)).rejects.toMatchObject(
      { code: "42501" },
    );
  });
  await assignEditor();
  await as("editor", async () => {
    expect(
      (
        await db.query(
          "delete from services where id='revocation-service' returning id",
        )
      ).rows,
    ).toEqual([{ id: "revocation-service" }]);
  });
});

test("service title and body limits are enforced, while published ordering and editor deletion still work", async () => {
  await as("editor", async () => {
    for (const [column, value] of [
      ["name", ""],
      ["name", " \t\n"],
      ["name", "n".repeat(301)],
      ["body", null],
      ["body", ""],
      ["body", " \t\n"],
      ["body", "b".repeat(30001)],
    ]) {
      await expect(
        db.query(`update services set ${column}=$1 where id=$2`, [
          value,
          editorService,
        ]),
      ).rejects.toMatchObject({ code: "23514" });
    }
    await expect(
      db.query(
        "insert into services(name,description,icon,office,office_id) values('Missing body','Summary','FileText','Office',$1)",
        [office],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(insertService("missing-owner", null)).rejects.toMatchObject({
      code: "23514",
    });
    await insertService("ordered-service", office, true);
    expect(
      (
        await db.query(
          "select id,sort_order from services where office_id=$1 and published order by sort_order",
          [office],
        )
      ).rows,
    ).toEqual([
      { id: "ordered-service", sort_order: 1 },
      { id: editorService, sort_order: 2 },
    ]);
    expect(
      (
        await db.query(
          "delete from services where id='ordered-service' returning id",
        )
      ).rows,
    ).toEqual([{ id: "ordered-service" }]);
    expect(
      (
        await db.query("select sort_order from services where id=$1", [
          editorService,
        ])
      ).rows,
    ).toEqual([{ sort_order: 1 }]);
  });
});

test("Superadmin can deliberately adopt a legacy service without breaking or rewriting unassigned siblings", async () => {
  const legacy = (
    await db.query<{
      id: string;
      sort_order: number;
      description: string;
      steps: string[];
    }>(
      "select id,sort_order,description,steps from services where office_id is null and published order by sort_order",
    )
  ).rows;
  const first = legacy[0];
  await as("superadmin", async () => {
    await db.query(
      "update services set office_id=$1,body='Converted legacy service details',sort_order=1 where id=$2",
      [otherOffice, first.id],
    );
  });
  expect(
    (
      await db.query("select id,description,steps from services where id=$1", [
        first.id,
      ])
    ).rows,
  ).toEqual([
    { id: first.id, description: first.description, steps: first.steps },
  ]);
  expect(
    (
      await db.query(
        "select id,sort_order,description,steps,body from services where office_id is null and published order by sort_order",
      )
    ).rows,
  ).toEqual(
    legacy
      .slice(1)
      .map((row) => ({ ...row, sort_order: row.sort_order - 1, body: null })),
  );
});
