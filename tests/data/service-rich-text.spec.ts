import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const migration = "202611200027_service_rich_text.sql";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
};
const body = "Bring your valid ID.\nVisit the service desk.";
const richBody = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Requirements", marks: [{ type: "bold" }] },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Bring your valid ID.",
                  marks: [{ type: "italic" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
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
    "services",
    "departments",
    "staff_accounts",
    "user_office_access",
    "audit_logs",
    "storage.objects",
  ]) {
    const value =
      table === "services" ? "to_jsonb(r)-'rich_body'" : "to_jsonb(r)";
    result[table] = (
      await db.query(
        `select ${value} row from ${table} r order by ${value}::text`,
      )
    ).rows;
  }
  return result;
}

async function insertService(
  id: string,
  owner: string,
  rich: unknown = richBody,
) {
  return db.query(
    "insert into services(id,name,description,body,rich_body,icon,office,office_id) values($1,'Permit assistance','Summary',$2,$3::jsonb,'FileText','Department',$4) returning id",
    [id, body, JSON.stringify(rich), owner],
  );
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
  await as("superadmin", async () => {
    for (const role of ["editor", "viewer"] as const)
      await db.query("select manage_staff($1,$2,true,$2,$3::jsonb)", [
        users[role],
        role,
        JSON.stringify([{ office_id: office, permission_level: role }]),
      ]);
    await db.query(
      "insert into services(id,name,description,body,icon,office,office_id) values('plain-service','Existing service','Existing summary',$1,'FileText','Department',$2)",
      [body, office],
    );
  });
  before = await snapshot();
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());

test("migration preserves all legacy/plain services, permissions and audit history", async () => {
  expect(await snapshot()).toEqual(before);
  expect(
    (await db.query("select id from services where rich_body is not null"))
      .rows,
  ).toEqual([]);
  expect(
    (await db.query("select body from services where id='plain-service'")).rows,
  ).toEqual([{ body }]);
  expect(
    (await db.query("select id from services where body is null")).rows.length,
  ).toBeGreaterThan(0);
});

test("assigned editor saves bold, italic and numbered lists with plain text compatibility", async () => {
  await as("editor", async () => {
    await insertService("rich-service", office);
    expect(
      (
        await db.query(
          "select body,rich_body,created_by from services where id='rich-service'",
        )
      ).rows,
    ).toEqual([{ body, rich_body: richBody, created_by: users.editor }]);
    await db.query(
      "update services set rich_body=$1::jsonb where id='plain-service'",
      [JSON.stringify(richBody)],
    );
    expect(
      (await db.query("select body from services where id='plain-service'"))
        .rows,
    ).toEqual([{ body }]);
  });
});

test("the database rejects unsupported nodes, marks, attributes and oversized documents", async () => {
  const paragraph = (child: unknown) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [child] }],
  });
  const invalid = [
    { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
    paragraph({ type: "image", attrs: { src: "javascript:alert(1)" } }),
    paragraph({
      type: "text",
      text: "Unsafe link",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    }),
    paragraph({ type: "text", text: "Unsafe", onClick: "alert(1)" }),
    {
      type: "doc",
      content: [{ type: "paragraph", attrs: { style: "color:red" } }],
    },
    {
      type: "doc",
      content: Array.from({ length: 8 }, () => ({
        type: "paragraph",
        content: [{ type: "text", text: "x".repeat(30000) }],
      })),
    },
  ];
  await as("editor", async () => {
    for (const value of invalid)
      await expect(
        db.query(
          "update services set rich_body=$1::jsonb where id='rich-service'",
          [JSON.stringify(value)],
        ),
      ).rejects.toMatchObject({ code: "23514", constraint: "valid_rich_body" });
    expect(
      (await db.query("select rich_body from services where id='rich-service'"))
        .rows,
    ).toEqual([{ rich_body: richBody }]);
  });
});

test("formatted drafts stay private and published content still follows department visibility", async () => {
  await as("anon", async () => {
    expect(
      (await db.query("select id from services where id='rich-service'")).rows,
    ).toEqual([]);
  });
  await as("editor", async () => {
    await db.query(
      "update services set published=true,sort_order=1 where id='rich-service'",
    );
  });
  await as("anon", async () => {
    expect(
      (await db.query("select rich_body from services where id='rich-service'"))
        .rows,
    ).toEqual([{ rich_body: richBody }]);
  });
  await as("superadmin", async () => {
    await db.query("update departments set active=false where id=$1", [office]);
  });
  await as("anon", async () => {
    expect(
      (await db.query("select id from services where id='rich-service'")).rows,
    ).toEqual([]);
  });
  await as("superadmin", async () => {
    await db.query("update departments set active=true where id=$1", [office]);
  });
});

test("rich body support does not grant viewers or another office permission to write", async () => {
  await as("superadmin", async () => {
    await insertService("other-rich-service", otherOffice);
  });
  for (const role of ["viewer", "editor"] as const)
    await as(role, async () => {
      const target = role === "viewer" ? "rich-service" : "other-rich-service";
      expect(
        (
          await db.query(
            "update services set rich_body=null where id=$1 returning id",
            [target],
          )
        ).rows,
      ).toEqual([]);
      await expect(
        insertService(
          `forbidden-rich-${role}`,
          role === "viewer" ? office : otherOffice,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
});
