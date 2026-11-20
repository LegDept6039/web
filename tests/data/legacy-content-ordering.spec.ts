import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { legacyDocument } from "../../lib/content/rich-text";

let db: PGlite;
let owner: string;
let otherOffice: string;
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  unrelated: "00000000-0000-4000-8000-000000000003",
};
const migration = "202611190022_legacy_content_ordering.sql";

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
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    grant usage on schema auth to anon,authenticated;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema storage;
    grant usage on schema storage to anon,authenticated;
    create table storage.objects(bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$select string_to_array($1,'/')$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create policy public_media_read on storage.objects for select to anon,authenticated
      using(bucket_id='municipal-media');
  `);
  // Use the real upgrade path and original seed; Storage is stubbed locally.
  for (const file of readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql") && file < migration)
    .sort()) {
    if (file === "202609300002_media.sql") continue;
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file === "202610010005_legislative_modules.sql")
      await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  }
  const offices = (
    await db.query<{ id: string }>(
      "select id from departments where department='executive' and active and archived_at is null order by slug limit 2",
    )
  ).rows;
  [owner, otherOffice] = offices.map((office) => office.id);
  for (const [name, id] of Object.entries(users))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      `${name}@test.local`,
    ]);
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id=$1",
    [users.superadmin],
  );
  await as("superadmin", async () => {
    for (const [name, office] of [
      ["editor", owner],
      ["unrelated", otherOffice],
    ] as const)
      await db.query("select manage_staff($1,'editor',true,$2,$3::jsonb)", [
        users[name],
        name,
        JSON.stringify([{ office_id: office, permission_level: "editor" }]),
      ]);
  });
});

test.afterAll(async () => await db.close());

test("legacy assignment reproduces the ownership failure, then migration preserves all rows", async () => {
  const before = (
    await db.query("select to_jsonb(n) row from news n order by id")
  ).rows;
  await as("superadmin", async () => {
    await expect(
      db.query(
        "update news set office_id=$1,published=true,sort_order=1 where slug='community-first'",
        [owner],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      message: "An owning office is required",
      where: expect.stringContaining("portal_reorder_content"),
    });
  });
  expect(
    (await db.query("select to_jsonb(n) row from news n order by id")).rows,
  ).toEqual(before);
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
  expect(
    (await db.query("select to_jsonb(n) row from news n order by id")).rows,
  ).toEqual(before);
});

test("seeded news can be assigned and saved while unassigned peers keep their content", async () => {
  const before = (
    await db.query<{ id: string; image: string; content: string[] }>(
      "select id,image,content from news where slug='community-first'",
    )
  ).rows[0];
  const peers = (
    await db.query(
      "select to_jsonb(n)-array['sort_order','updated_at'] row from news n where office_id is null and slug<>'community-first' order by id",
    )
  ).rows;
  await as("superadmin", async () => {
    await db.query(
      "update news set office_id=$1,published=true,sort_order=1,rich_body=$2 where slug='community-first'",
      [owner, JSON.stringify(legacyDocument(before.content))],
    );
  });
  expect(
    (
      await db.query(
        "select id,image,content,office_id,published,sort_order from news where slug='community-first'",
      )
    ).rows,
  ).toEqual([{ ...before, office_id: owner, published: true, sort_order: 1 }]);
  expect(
    (
      await db.query(
        "select to_jsonb(n)-array['sort_order','updated_at'] row from news n where office_id is null order by id",
      )
    ).rows,
  ).toEqual(peers);
  expect(
    (
      await db.query(
        "select sort_order from news where office_id is null order by sort_order",
      )
    ).rows,
  ).toEqual([{ sort_order: 1 }, { sort_order: 2 }, { sort_order: 3 }]);
});

test("ownership remains mandatory for direct orphan edits, inserts and office removal", async () => {
  await as("superadmin", async () => {
    for (const query of [
      "update news set title='Unassigned edit' where slug='coastal-community'",
      "update news set sort_order=2 where slug='coastal-community'",
      "update news set published=false,sort_order=0 where slug='coastal-community'",
      "update news set office_id=null where slug='community-first'",
      "insert into news(slug,title,category,date,excerpt,image,content) values('unowned','Unowned','News','2026-11-19','Body','/image.png',array['Body'])",
    ])
      await expect(db.query(query)).rejects.toMatchObject({
        code: "23514",
        message: "An owning office is required",
      });
  });
  await as("editor", async () => {
    expect(
      (
        await db.query(
          "update news set office_id=$1 where slug='coastal-community' returning id",
          [owner],
        )
      ).rows,
    ).toEqual([]);
  });
  await as("unrelated", async () => {
    expect(
      (
        await db.query(
          "update news set title='Cross-office edit' where slug='community-first' returning id",
        )
      ).rows,
    ).toEqual([]);
  });
});

test("owned publication, ordering, draft privacy and rich-body validation remain enforced", async () => {
  await as("editor", async () => {
    await db.query(
      "insert into news(slug,title,category,date,excerpt,image,content,office_id) values('ownership-draft','Draft','News','2026-11-19','Body','/image.png',array['Body'],$1)",
      [owner],
    );
    await expect(
      db.query(
        "update news set rich_body=$1 where slug='community-first'",
        [JSON.stringify({ type: "doc", content: [{ type: "script" }] })],
      ),
    ).rejects.toMatchObject({ code: "23514", constraint: "valid_rich_body" });
    await expect(
      db.query(
        "update news set published=true,sort_order=0 where slug='ownership-draft'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  await db.exec("set role anon");
  expect(
    (
      await db.query(
        "select slug from published_news where slug='ownership-draft'",
      )
    ).rows,
  ).toEqual([]);
  await db.exec("reset role");
  await as("editor", async () => {
    await db.query(
      "update news set published=true,sort_order=1 where slug='ownership-draft'",
    );
    expect(
      (
        await db.query(
          "select slug,sort_order from news where office_id=$1 order by sort_order",
          [owner],
        )
      ).rows,
    ).toEqual([
      { slug: "ownership-draft", sort_order: 1 },
      { slug: "community-first", sort_order: 2 },
    ]);
  });
  await db.exec("set role anon");
  expect(
    (
      await db.query(
        "select slug from published_news where slug='ownership-draft'",
      )
    ).rows,
  ).toEqual([{ slug: "ownership-draft" }]);
  await db.exec("reset role");
});
