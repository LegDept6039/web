import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import {
  validateBarangay,
  barangaySlug,
  prepareBarangayValues,
} from "../../lib/barangays/validation";
import { readBarangays } from "../../lib/barangays/data";

const migration = "202611210028_barangays.sql";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  admin: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
let db: PGlite;
let before: unknown;
const rich = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Community profile", marks: [{ type: "bold" }] },
      ],
    },
  ],
};
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
  return Promise.all(
    [
      "departments",
      "staff_accounts",
      "user_office_access",
      "services",
      "municipal_contact_settings",
      "audit_logs",
      "storage.objects",
    ].map(
      async (table) =>
        (
          await db.query(
            `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
          )
        ).rows,
    ),
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
  before = await snapshot();
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());

test("barangay migration preserves existing records and begins with an empty directory", async () => {
  expect(await snapshot()).toEqual(before);
  expect((await db.query("select * from barangays")).rows).toEqual([]);
});

test("only active Superadmin creates and edits barangays; drafts remain private and changes are audited", async () => {
  for (const role of ["admin", "editor", "viewer", "anon"] as const) {
    await as(role, async () => {
      await expect(
        db.query(
          "insert into barangays(name,slug,captain_name,body) values('Denied','denied','Captain','Body')",
        ),
      ).rejects.toThrow();
    });
  }
  await as("superadmin", async () => {
    await db.query(
      "insert into barangays(name,slug,captain_name,body,rich_body) values('Fixture Barangay','fixture-barangay','Fixture Captain','Community profile',$1::jsonb)",
      [JSON.stringify(rich)],
    );
  });
  for (const role of ["admin", "editor", "viewer", "anon"] as const)
    await as(role, async () => {
      expect((await db.query("select * from barangays")).rows).toEqual([]);
    });
  await as("superadmin", async () => {
    await db.exec(
      "update barangays set published=true where slug='fixture-barangay'",
    );
  });
  for (const role of ["admin", "editor", "viewer", "anon"] as const)
    await as(role, async () => {
      expect(
        (await db.query("select captain_name from barangays")).rows,
      ).toEqual([{ captain_name: "Fixture Captain" }]);
      if (role !== "anon")
        expect(
          (
            await db.query(
              "update barangays set captain_name='Forged' returning id",
            )
          ).rows,
        ).toEqual([]);
      await expect(db.query("delete from barangays")).rejects.toThrow();
    });
  expect(
    (
      await db.query(
        "select action from audit_logs where entity_type='barangays' order by created_at,id",
      )
    ).rows,
  ).toHaveLength(2);
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.superadmin,
  ]);
  await as("superadmin", async () => {
    expect(
      (
        await db.query(
          "update barangays set captain_name='Inactive' returning id",
        )
      ).rows,
    ).toEqual([]);
  });
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.superadmin,
  ]);
});

test("barangay media is Superadmin-only and referenced images cannot be deleted", async () => {
  const path = `barangays/${users.superadmin}/image.webp`;
  for (const role of ["admin", "editor", "viewer"] as const)
    await as(role, async () => {
      await expect(
        db.query("insert into storage.objects values('municipal-media',$1)", [
          `barangays/${users[role]}/image.webp`,
        ]),
      ).rejects.toThrow();
    });
  await as("superadmin", async () => {
    await expect(
      db.query("insert into storage.objects values('municipal-media',$1)", [
        `barangays/${users.admin}/forged.webp`,
      ]),
    ).rejects.toThrow();
    await db.query("insert into storage.objects values('municipal-media',$1)", [
      path,
    ]);
    await db.query(
      "update barangays set image_url=$1 where slug='fixture-barangay'",
      [
        `https://fixture.supabase.test/storage/v1/object/public/municipal-media/${path}`,
      ],
    );
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [path],
        )
      ).rows,
    ).toEqual([]);
    await db.query("insert into storage.objects values('municipal-media',$1)", [
      `barangays/${users.superadmin}/unused.webp`,
    ]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [`barangays/${users.superadmin}/unused.webp`],
        )
      ).rows,
    ).toHaveLength(1);
  });
});

test("barangay validation supports safe formatted body content and rejects unsafe or invalid data", async () => {
  const input = {
    name: "Fixture Barangay",
    slug: "fixture-barangay",
    captain_name: "Fixture Captain",
    body: "Forged plain body",
    rich_body: rich,
    sort_order: 0,
  };
  expect(validateBarangay(input)).toMatchObject({
    body: "Community profile",
    published: false,
  });
  expect(barangaySlug("  Niño Norte ")).toBe("nino-norte");
  for (const patch of [
    { name: "" },
    { captain_name: "x".repeat(201) },
    { slug: "../contact" },
    { sort_order: -1 },
    {
      rich_body: {
        type: "doc",
        content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }],
      },
    },
  ])
    expect(() => validateBarangay({ ...input, ...patch })).toThrow();
  expect(validateBarangay({ name: "Anislag", slug: "anislag" })).toMatchObject({
    captain_name: "",
    body: "",
    sort_order: 0,
  });
  expect(
    validateBarangay({
      ...input,
      captain_name: "",
      rich_body: { type: "doc", content: [{ type: "paragraph" }] },
    }),
  ).toMatchObject({ captain_name: "", body: "" });
  await as("superadmin", async () => {
    await expect(
      db.query("update barangays set rich_body=$1::jsonb", [
        JSON.stringify({ type: "doc", content: [{ type: "script" }] }),
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });
});

test("the server generates addresses and ignores submitted slugs while retaining saved links", () => {
  const input = {
    name: "Niño Norte",
    captain_name: "Captain",
    body: "Community profile",
    sort_order: 0,
    slug: "forged-value",
  };
  expect(prepareBarangayValues(input).slug).toBe("nino-norte");
  expect(
    prepareBarangayValues(
      { ...input, name: "Renamed Barangay" },
      "saved-address",
    ).slug,
  ).toBe("saved-address");
  expect(prepareBarangayValues({ ...input, name: "社区" }).slug).toBe(
    "barangay",
  );
  expect(
    prepareBarangayValues({ ...input, name: "X".repeat(160) }).slug.length,
  ).toBeLessThanOrEqual(160);
});

test("public adapter filters published records, validates media and distinguishes setup from failures", async () => {
  const config = {
    url: "https://fixture.supabase.test",
    key: "sb_publishable_fixture",
  };
  const row = {
    id: crypto.randomUUID(),
    name: "Fixture Barangay",
    slug: "fixture-barangay",
    captain_name: "Fixture Captain",
    body: "Community profile",
    rich_body: rich,
    image_url: null,
    published: true,
    sort_order: 0,
    updated_at: new Date().toISOString(),
  };
  expect(
    await readBarangays(
      config,
      async (input) => {
        const url = new URL(String(input));
        expect(url.searchParams.get("published")).toBe("eq.true");
        expect(url.searchParams.get("slug")).toBe("eq.fixture-barangay");
        return new Response(JSON.stringify([row]));
      },
      "fixture-barangay",
    ),
  ).toMatchObject([row]);
  await expect(
    readBarangays(
      config,
      async () => new Response(JSON.stringify([{ ...row, published: false }])),
    ),
  ).rejects.toThrow();
  await expect(
    readBarangays(
      config,
      async () =>
        new Response(
          JSON.stringify([
            { ...row, image_url: "http://127.0.0.1/private.png" },
          ]),
        ),
    ),
  ).rejects.toThrow();
  expect(
    await readBarangays(
      config,
      async () =>
        new Response(JSON.stringify({ code: "42P01" }), { status: 404 }),
    ),
  ).toBeNull();
  await expect(
    readBarangays(config, async () => new Response("{}", { status: 503 })),
  ).rejects.toThrow("Unable to load");
});
