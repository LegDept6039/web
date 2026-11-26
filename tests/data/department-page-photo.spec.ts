import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { decodeRecord } from "../../lib/content/schema";

test.describe.configure({ mode: "serial" });
const migration = "202611250035_department_page_photo.sql";
const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
};
let db: PGlite;
let treasury: string;
let engineering: string;
let branch: string;

async function as<T>(
  user: keyof typeof users | "anon",
  run: () => Promise<T>,
): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user === "anon" ? "" : users[user],
  ]);
  await db.exec(`set role ${user === "anon" ? "anon" : "authenticated"}`);
  try {
    return await run();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
  }
}

async function snapshot() {
  const result: Record<string, unknown> = {};
  const tables = await db.query<{ schemaname: string; tablename: string }>(
    "select schemaname,tablename from pg_tables where schemaname in ('public','auth','storage') order by schemaname,tablename",
  );
  for (const { schemaname, tablename } of tables.rows) {
    const table = `"${schemaname}"."${tablename}"`;
    const record =
      schemaname === "public" && tablename === "departments"
        ? "to_jsonb(r)-'show_head_photo_on_page'"
        : "to_jsonb(r)";
    result[`${schemaname}.${tablename}`] = (
      await db.query(
        `select ${record} row from ${table} r order by (${record})::text`,
      )
    ).rows;
  }
  result.triggers = (
    await db.query(
      "select tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.departments'::regclass order by tgname",
    )
  ).rows;
  result.policies = (
    await db.query(
      "select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname",
    )
  ).rows;
  return result;
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
  treasury = (
    await db.query<{ id: string }>(
      "select id from departments where short_name='TREASURY'",
    )
  ).rows[0].id;
  engineering = (
    await db.query<{ id: string }>(
      "select id from departments where short_name='ENGINEERING'",
    )
  ).rows[0].id;
  branch = (
    await db.query<{ id: string }>(
      "select id from departments where slug='market-affairs'",
    )
  ).rows[0].id;
  await as("superadmin", async () => {
    await db.query(
      "update departments set published=true,sort_order=(select coalesce(max(sort_order),0)+1 from departments where department='executive' and published),head_name='Retained Treasurer',head_photo='/images/retained-treasurer.webp',head_description='Retained biography',image_url='/images/retained-office.webp' where id=$1",
      [treasury],
    );
    for (const role of ["editor", "viewer"] as const)
      await db.query("select manage_staff($1,$2,true,$3,$4::jsonb,false)", [
        users[role],
        role,
        role,
        JSON.stringify([{ office_id: treasury, permission_level: role }]),
      ]);
  });
  await db.exec(
    "insert into storage.objects values('municipal-media','departments/retained-treasurer.webp'),('municipal-media','departments/retained-office.webp')",
  );
});

test.afterAll(async () => await db.close());

test("migration defaults every existing department to shown without rewriting records, policies or triggers", async () => {
  const before = await snapshot();
  await db.exec(sql);
  expect(await snapshot()).toEqual(before);
  expect(
    (
      await db.query(
        "select id from departments where show_head_photo_on_page is distinct from true",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='departments' and column_name='show_head_photo_on_page'",
      )
    ).rows,
  ).toEqual([{ is_nullable: "NO", column_default: "true" }]);
});

test("new departments default to shown and null preferences are rejected", async () => {
  await as("superadmin", async () => {
    expect(
      (
        await db.query(
          "insert into departments(name,short_name,slug,department,published,sort_order) values('New office','','new-photo-preference-office','executive',false,0) returning show_head_photo_on_page",
        )
      ).rows,
    ).toEqual([{ show_head_photo_on_page: true }]);
    await expect(
      db.query(
        "update departments set show_head_photo_on_page=null where id=$1",
        [treasury],
      ),
    ).rejects.toMatchObject({ code: "23502" });
  });
});

test("assigned editors can hide and restore only their own portrait while retaining its media", async () => {
  const media = (await db.query("select * from storage.objects order by name"))
    .rows;
  await as("editor", async () => {
    for (const show of [false, true, false]) {
      expect(
        (
          await db.query(
            "update departments set show_head_photo_on_page=$1 where id=$2 returning show_head_photo_on_page,head_photo,image_url,head_name,head_description",
            [show, treasury],
          )
        ).rows,
      ).toEqual([
        {
          show_head_photo_on_page: show,
          head_photo: "/images/retained-treasurer.webp",
          image_url: "/images/retained-office.webp",
          head_name: "Retained Treasurer",
          head_description: "Retained biography",
        },
      ]);
    }
    for (const other of [engineering, branch])
      expect(
        (
          await db.query(
            "update departments set show_head_photo_on_page=false where id=$1 returning id",
            [other],
          )
        ).rows,
      ).toEqual([]);
  });
  expect((await db.query("select * from storage.objects order by name")).rows)
    .toEqual(media);
  await as("anon", async () => {
    expect(
      (
        await db.query(
          "select show_head_photo_on_page,head_photo from departments where id=$1",
          [treasury],
        )
      ).rows,
    ).toEqual([
      {
        show_head_photo_on_page: false,
        head_photo: "/images/retained-treasurer.webp",
      },
    ]);
  });
});

test("viewers and anonymous users cannot change portrait preferences", async () => {
  await as("viewer", async () => {
    expect(
      (
        await db.query(
          "update departments set show_head_photo_on_page=true where id=$1 returning id",
          [treasury],
        )
      ).rows,
    ).toEqual([]);
  });
  await as("anon", async () => {
    await expect(
      db.query(
        "update departments set show_head_photo_on_page=true where id=$1",
        [treasury],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  expect(
    (
      await db.query(
        "select show_head_photo_on_page from departments where id=$1",
        [treasury],
      )
    ).rows,
  ).toEqual([{ show_head_photo_on_page: false }]);
});

test("department decoding preserves optional boolean preference and all portrait URLs", () => {
  const row = {
    id: "department-photo",
    name: "Department with a portrait",
    description: "Department information",
    head_photo: "/images/retained-head.webp",
    image_url: "/images/retained-office.webp",
    is_sample: false,
  };
  for (const show of [true, false])
    expect(
      decodeRecord("departments", { ...row, show_head_photo_on_page: show }),
    ).toMatchObject({
      showHeadPhotoOnPage: show,
      headPhoto: row.head_photo,
      imageUrl: row.image_url,
    });
  for (const value of [undefined, null])
    expect(
      decodeRecord("departments", { ...row, show_head_photo_on_page: value }),
    ).not.toHaveProperty("showHeadPhotoOnPage");
  for (const value of ["false", "true", 0, 1, [], {}])
    expect(() =>
      decodeRecord("departments", { ...row, show_head_photo_on_page: value }),
    ).toThrow("show_head_photo_on_page");
});
