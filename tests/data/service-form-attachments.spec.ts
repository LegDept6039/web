import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const migration = "202611270038_service_form_attachments.sql";
test.describe.configure({ mode: "serial" });
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
};
let db: PGlite;
let office: string;
let otherOffice: string;
let before: unknown;
let attached: string;
let replaced: string;

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
  const output: Record<string, unknown> = {};
  for (const table of [
    "services",
    "departments",
    "staff_accounts",
    "user_office_access",
    "audit_logs",
    "storage.objects",
  ]) {
    const row =
      table === "services"
        ? "to_jsonb(r)-array['form_path','form_name']"
        : "to_jsonb(r)";
    output[table] = (
      await db.query(`select ${row} row from ${table} r order by ${row}::text`)
    ).rows;
  }
  return output;
}
function path(
  owner = office,
  user = users.editor,
  version = "00000000-0000-4000-8000-000000000001",
) {
  return `services/${owner}/${user}/${version}.pdf`;
}
async function objects(bucket: string, name: string) {
  return (
    await db.query(
      "select name from storage.objects where bucket_id=$1 and name=$2",
      [bucket, name],
    )
  ).rows;
}
async function upload(name: string, bucket = "municipal-service-forms") {
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    bucket,
    name,
  ]);
}

test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema auth;
    grant usage on schema auth to anon,authenticated;
    create table auth.users(id uuid primary key,email text);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz not null);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create schema storage;grant usage on schema storage to anon,authenticated;
    create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
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
      "select id from departments where department='executive' and active and published and archived_at is null and parent_department_id is null and not public.is_barangay_affairs_office(id) order by id limit 2",
    )
  ).rows.map((row) => row.id);
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

test("migration adds optional private PDFs without changing existing content, access, audit or files", async () => {
  expect(await snapshot()).toEqual(before);
  expect(
    (
      await db.query(
        "select id from services where form_path is not null or form_name is not null",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select public,file_size_limit,allowed_mime_types from storage.buckets where id='municipal-service-forms'",
      )
    ).rows,
  ).toEqual([
    {
      public: false,
      file_size_limit: 10485760,
      allowed_mime_types: ["application/pdf"],
    },
  ]);
});

test("assigned editor stages and attaches a private PDF; viewers and cross-office uploads are denied", async () => {
  attached = path();
  await as("editor", async () => {
    await upload(attached, "municipal-document-staging");
    expect(await objects("municipal-document-staging", attached)).toEqual([
      { name: attached },
    ]);
    await upload(attached);
    await db.query(
      "insert into services(id,name,description,body,office,office_id,icon,form_path,form_name) values('form-service','Application assistance','Summary','Bring the completed form.','Office',$1,'FileText',$2,'Application.pdf')",
      [office, attached],
    );
    await expect(upload(path(otherOffice))).rejects.toMatchObject({
      code: "42501",
    });
    await expect(upload(path(office, users.viewer))).rejects.toMatchObject({
      code: "42501",
    });
  });
  await as("viewer", async () => {
    await expect(upload(path(office, users.viewer))).rejects.toMatchObject({
      code: "42501",
    });
    expect(await objects("municipal-service-forms", attached)).toEqual([
      { name: attached },
    ]);
    expect(
      (
        await db.query(
          "update services set form_name='Changed.pdf' where id='form-service' returning id",
        )
      ).rows,
    ).toEqual([]);
  });
  await as("anon", async () => {
    expect(await objects("municipal-service-forms", attached)).toEqual([]);
    expect(await objects("municipal-document-staging", attached)).toEqual([]);
  });
});

test("form access follows current service and owning department publication, activation and archival", async () => {
  await as("editor", async () => {
    expect(
      (
        await db.query(
          "update services set published=true,sort_order=1 where id='form-service' returning published,form_path",
        )
      ).rows,
    ).toEqual([{ published: true, form_path: attached }]);
  });
  expect(
    (
      await db.query(
        "select s.form_path,s.published,d.published owner_published,d.active,d.archived_at,d.department,s.content_scope,d.parent_department_id from services s join departments d on d.id=s.office_id where s.id='form-service'",
      )
    ).rows,
  ).toEqual([
    {
      form_path: attached,
      published: true,
      owner_published: true,
      active: true,
      archived_at: null,
      department: "executive",
      content_scope: "executive",
      parent_department_id: null,
    },
  ]);
  expect(
    (
      await db.query("select public.service_form_published($1) visible", [
        attached,
      ])
    ).rows,
  ).toEqual([{ visible: true }]);
  await as("anon", async () =>
    expect(await objects("municipal-service-forms", attached)).toEqual([
      { name: attached },
    ]),
  );
  for (const patch of [
    "published=false",
    "active=false",
    "archived_at=now()",
  ]) {
    await as("superadmin", async () => {
      await db.query(`update departments set ${patch} where id=$1`, [office]);
    });
    await as("anon", async () =>
      expect(await objects("municipal-service-forms", attached)).toEqual([]),
    );
    await as("superadmin", async () => {
      await db.query(
        "update departments set published=true,active=true,archived_at=null,sort_order=1 where id=$1",
        [office],
      );
    });
  }
  await as("editor", async () => {
    await db.exec(
      "update services set published=false where id='form-service'",
    );
  });
  await as("anon", async () =>
    expect(await objects("municipal-service-forms", attached)).toEqual([]),
  );
});

test("forged paths, absent files and unsafe names cannot be attached", async () => {
  await as("editor", async () => {
    await expect(
      db.query("update services set form_path=$1 where id='form-service'", [
        path(office, users.viewer),
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("update services set form_path=$1 where id='form-service'", [
        path(office, users.editor, "00000000-0000-4000-8000-000000000009"),
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.exec(
        "update services set form_name=E'../unsafe.pdf' where id='form-service'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.exec("update services set form_name=null where id='form-service'"),
    ).rejects.toMatchObject({ code: "23514" });
  });
});

test("branch forms follow the parent department's current public visibility", async () => {
  let branch = "";
  const branchPath = "00000000-0000-4000-8000-000000000007";
  await as("superadmin", async () => {
    branch = (
      await db.query<{ id: string }>(
        "insert into departments(name,short_name,slug,description,department,parent_department_id,published,sort_order) values('Form branch','Branch','service-form-branch','Branch','executive',$1,true,1) returning id",
        [office],
      )
    ).rows[0].id;
    const formPath = path(branch, users.superadmin, branchPath);
    await upload(formPath);
    await db.query(
      "insert into services(id,name,description,body,office,office_id,icon,form_path,form_name,published,sort_order) values('branch-form-service','Branch application','Summary','Bring this form.','Branch',$1,'FileText',$2,'Branch.pdf',true,1)",
      [branch, formPath],
    );
  });
  const formPath = path(branch, users.superadmin, branchPath);
  await as("anon", async () =>
    expect(await objects("municipal-service-forms", formPath)).toEqual([
      { name: formPath },
    ]),
  );
  await as("superadmin", async () => {
    await db.query("update departments set published=false where id=$1", [
      office,
    ]);
  });
  await as("anon", async () =>
    expect(await objects("municipal-service-forms", formPath)).toEqual([]),
  );
  await as("superadmin", async () => {
    await db.query(
      "update departments set published=true,sort_order=1 where id=$1",
      [office],
    );
  });
});

test("replacement and removal hide old downloads while preserving every previously referenced file", async () => {
  replaced = path(office, users.editor, "00000000-0000-4000-8000-000000000002");
  await as("editor", async () => {
    await upload(replaced);
    await db.query(
      "update services set form_path=$1,form_name='Replacement.pdf',published=true,sort_order=1 where id='form-service'",
      [replaced],
    );
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-service-forms' and name=$1 returning name",
          [attached],
        )
      ).rows,
    ).toEqual([]);
  });
  await as("anon", async () => {
    expect(await objects("municipal-service-forms", attached)).toEqual([]);
    expect(await objects("municipal-service-forms", replaced)).toEqual([
      { name: replaced },
    ]);
  });
  await as("editor", async () => {
    await db.exec(
      "update services set form_path=null,form_name=null where id='form-service'",
    );
    await db.exec("delete from services where id='form-service'");
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-service-forms' and name=$1 returning name",
          [replaced],
        )
      ).rows,
    ).toEqual([]);
    const neverUsed = path(
      office,
      users.editor,
      "00000000-0000-4000-8000-000000000003",
    );
    await upload(neverUsed);
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='municipal-service-forms' and name=$1 returning name",
          [neverUsed],
        )
      ).rows,
    ).toEqual([{ name: neverUsed }]);
  });
  expect(
    (
      await db.query(
        "select path from service_form_references where service_id='form-service' order by path",
      )
    ).rows,
  ).toEqual([attached, replaced].sort().map((path) => ({ path })));
});

test("revocation blocks staging uploads and reads of unpublished attachments immediately", async () => {
  await assignEditor(false);
  await as("editor", async () => {
    expect(await objects("municipal-service-forms", attached)).toEqual([]);
    await expect(
      upload(path(), "municipal-document-staging"),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
