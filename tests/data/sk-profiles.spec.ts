import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { prepareSKValues, validateSKProfile } from "../../lib/sk/validation";
import { readSKProfiles } from "../../lib/sk/data";

const migration = "202611220029_sk_profiles.sql";
const barangayId = "10000000-0000-4000-8000-000000000001";
const secondBarangayId = "10000000-0000-4000-8000-000000000002";
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
        {
          type: "text",
          text: "Youth community profile",
          marks: [{ type: "bold" }],
        },
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
      "barangays",
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
  await db.query(
    "insert into barangays(id,name,slug,captain_name,body,published) values($1,'Fixture Barangay','fixture-barangay','Captain','Existing barangay body',true),($2,'Second Barangay','second-barangay','Second Captain','Existing body',false)",
    [barangayId, secondBarangayId],
  );
  await db.exec(
    "insert into storage.objects values('municipal-media','barangays/preserved/image.webp')",
  );
  before = await snapshot();
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());

test("SK migration preserves barangays, existing records and files and creates an empty collection", async () => {
  expect(await snapshot()).toEqual(before);
  expect((await db.query("select * from sk_profiles")).rows).toEqual([]);
});

test("only active Superadmins can write SK profiles, drafts are private and changes are audited", async () => {
  for (const role of ["admin", "editor", "viewer", "anon"] as const)
    await as(role, async () => {
      await expect(
        db.query(
          "insert into sk_profiles(barangay_id,slug,chairperson_name,body) values($1,'forged','Chairperson','Body')",
          [barangayId],
        ),
      ).rejects.toThrow();
    });
  await as("superadmin", async () => {
    await db.query(
      "insert into sk_profiles(barangay_id,slug,chairperson_name,body,rich_body) values($1,'fixture-barangay','Fixture Chairperson','Youth community profile',$2::jsonb)",
      [barangayId, JSON.stringify(rich)],
    );
  });
  for (const role of ["admin", "editor", "viewer", "anon"] as const)
    await as(role, async () => {
      expect((await db.query("select * from sk_profiles")).rows).toEqual([]);
    });
  await as("superadmin", async () => {
    await db.exec("update sk_profiles set published=true");
  });
  for (const role of ["admin", "editor", "viewer", "anon"] as const)
    await as(role, async () => {
      expect(
        (await db.query("select chairperson_name from sk_profiles")).rows,
      ).toEqual([{ chairperson_name: "Fixture Chairperson" }]);
      if (role !== "anon")
        expect(
          (
            await db.query(
              "update sk_profiles set chairperson_name='Forged' returning id",
            )
          ).rows,
        ).toEqual([]);
      await expect(db.query("delete from sk_profiles")).rejects.toThrow();
    });
  await as("superadmin", async () => {
    await expect(db.query("delete from sk_profiles")).rejects.toThrow();
  });
  expect(
    (
      await db.query(
        "select action from audit_logs where entity_type='sk_profiles'",
      )
    ).rows,
  ).toHaveLength(2);
});

test("both the SK profile and linked barangay must be published, and revocation takes effect immediately", async () => {
  await db.query("update barangays set published=false where id=$1", [
    barangayId,
  ]);
  for (const role of ["admin", "editor", "viewer", "anon"] as const)
    await as(role, async () => {
      expect((await db.query("select * from sk_profiles")).rows).toEqual([]);
    });
  await as("superadmin", async () => {
    expect((await db.query("select * from sk_profiles")).rows).toHaveLength(1);
  });
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.superadmin,
  ]);
  await as("superadmin", async () => {
    expect((await db.query("select * from sk_profiles")).rows).toEqual([]);
    expect(
      (
        await db.query(
          "update sk_profiles set chairperson_name='Revoked' returning id",
        )
      ).rows,
    ).toEqual([]);
    await expect(
      db.query(
        "insert into sk_profiles(barangay_id,slug,chairperson_name,body) values($1,'revoked','Chairperson','Body')",
        [secondBarangayId],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("insert into storage.objects values('municipal-media',$1)", [
        `sk/${users.superadmin}/revoked.webp`,
      ]),
    ).rejects.toThrow();
  });
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.superadmin,
  ]);
  await db.query("update barangays set published=true where id=$1", [
    barangayId,
  ]);
  await as("superadmin", async () => {
    await db.exec("update sk_profiles set published=false");
  });
  await as("anon", async () => {
    expect((await db.query("select * from sk_profiles")).rows).toEqual([]);
  });
  await as("superadmin", async () => {
    await db.exec("update sk_profiles set published=true");
  });
});

test("one current profile per barangay, valid relationships and safe formatted bodies are enforced by SQL", async () => {
  await as("superadmin", async () => {
    await expect(
      db.query(
        "insert into sk_profiles(barangay_id,slug,chairperson_name,body) values($1,'duplicate','Chairperson','Body')",
        [barangayId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      db.query(
        "insert into sk_profiles(barangay_id,slug,chairperson_name,body) values($1,'missing','Chairperson','Body')",
        ["10000000-0000-4000-8000-000000000099"],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      db.query("update sk_profiles set rich_body=$1::jsonb", [
        JSON.stringify({ type: "doc", content: [{ type: "script" }] }),
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query("update sk_profiles set chairperson_name=''"),
    ).rejects.toMatchObject({ code: "23514" });
  });
  // Even a privileged administrative deletion cannot cascade through the relationship.
  await expect(
    db.query("delete from barangays where id=$1", [barangayId]),
  ).rejects.toMatchObject({ code: "23503" });
});

test("SK media uploads require Superadmin ownership and referenced images remain protected", async () => {
  const path = `sk/${users.superadmin}/image.webp`;
  for (const role of ["admin", "editor", "viewer"] as const)
    await as(role, async () => {
      await expect(
        db.query("insert into storage.objects values('municipal-media',$1)", [
          `sk/${users[role]}/image.webp`,
        ]),
      ).rejects.toThrow();
    });
  await as("superadmin", async () => {
    await expect(
      db.query("insert into storage.objects values('municipal-media',$1)", [
        `sk/${users.admin}/forged.webp`,
      ]),
    ).rejects.toThrow();
    await db.query("insert into storage.objects values('municipal-media',$1)", [
      path,
    ]);
    await db.query("update sk_profiles set image_url=$1", [
      `https://fixture.supabase.test/storage/v1/object/public/municipal-media/${path}`,
    ]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [path],
        )
      ).rows,
    ).toEqual([]);
    const unused = `sk/${users.superadmin}/unused.webp`;
    await db.query("insert into storage.objects values('municipal-media',$1)", [
      unused,
    ]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [unused],
        )
      ).rows,
    ).toHaveLength(1);
  });
});

test("SK validation derives plain text from safe formatting and rejects invalid input", () => {
  const input = {
    barangay_id: barangayId,
    slug: "fixture-barangay",
    chairperson_name: "Chairperson",
    body: "Forged plain text",
    rich_body: rich,
    sort_order: 0,
  };
  expect(validateSKProfile(input)).toMatchObject({
    barangay_id: barangayId,
    body: "Youth community profile",
    published: false,
  });
  for (const patch of [
    { barangay_id: "forged" },
    { chairperson_name: "x".repeat(201) },
    { slug: "../contact" },
    { sort_order: -1 },
    {
      rich_body: {
        type: "doc",
        content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }],
      },
    },
  ])
    expect(() => validateSKProfile({ ...input, ...patch })).toThrow();
  expect(
    validateSKProfile({ barangay_id: barangayId, slug: "anislag" }),
  ).toMatchObject({ chairperson_name: "", body: "", sort_order: 0 });
  expect(
    validateSKProfile({
      ...input,
      chairperson_name: "",
      rich_body: { type: "doc", content: [{ type: "paragraph" }] },
    }),
  ).toMatchObject({ chairperson_name: "", body: "" });
});

test("SK page addresses come from verified barangay names and remain stable on edits", () => {
  const input = {
    barangay_id: barangayId,
    slug: "forged",
    chairperson_name: "Chairperson",
    body: "Profile",
    sort_order: 0,
  };
  expect(prepareSKValues(input, "Ni\u00f1o Norte").slug).toBe("nino-norte");
  expect(prepareSKValues(input, "Renamed Barangay", "saved-address").slug).toBe(
    "saved-address",
  );
  expect(prepareSKValues(input, "\u793e\u533a").slug).toBe("sk");
  expect(prepareSKValues(input, "x".repeat(160)).slug).toHaveLength(160);
});

test("the public adapter filters both publication states and validates relationships, media and failures", async () => {
  const config = {
    url: "https://fixture.supabase.test",
    key: "sb_publishable_fixture",
  };
  const row = {
    id: crypto.randomUUID(),
    barangay_id: barangayId,
    slug: "fixture-barangay",
    chairperson_name: "Fixture Chairperson",
    body: "Youth community profile",
    rich_body: rich,
    image_url: null,
    published: true,
    sort_order: 0,
    updated_at: new Date().toISOString(),
    barangay: {
      id: barangayId,
      name: "Fixture Barangay",
      slug: "fixture-barangay",
      published: true,
    },
  };
  const barangay = {
    id: row.barangay.id,
    name: row.barangay.name,
    slug: row.barangay.slug,
  };
  expect(
    await readSKProfiles(
      config,
      async (input) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/rest/v1/sk_profiles");
        expect(url.searchParams.get("select")).toBe(
          "*,barangay:barangays!inner(id,name,slug,published)",
        );
        expect(url.searchParams.get("published")).toBe("eq.true");
        expect(url.searchParams.get("barangay.published")).toBe("eq.true");
        expect(url.searchParams.get("slug")).toBe("eq.fixture-barangay");
        return new Response(JSON.stringify([row]));
      },
      "fixture-barangay",
    ),
  ).toEqual([{ ...row, barangay }]);
  for (const invalid of [
    { ...row, published: false },
    { ...row, barangay: { ...row.barangay, published: false } },
    { ...row, barangay: { ...row.barangay, id: secondBarangayId } },
    { ...row, barangay: null },
    { ...row, image_url: "http://127.0.0.1/private.png" },
    {
      ...row,
      image_url: `${config.url}/storage/v1/object/public/municipal-media/barangays/image.webp`,
    },
  ])
    await expect(
      readSKProfiles(
        config,
        async () => new Response(JSON.stringify([invalid])),
      ),
    ).rejects.toThrow();
  expect(await readSKProfiles(config, async () => new Response("[]"))).toEqual(
    [],
  );
  expect(
    await readSKProfiles(
      config,
      async () =>
        new Response(JSON.stringify({ code: "PGRST205" }), { status: 404 }),
    ),
  ).toBeNull();
  await expect(
    readSKProfiles(config, async () => new Response("{}", { status: 503 })),
  ).rejects.toThrow("Unable to load");
});
