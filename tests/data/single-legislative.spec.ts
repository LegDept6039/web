import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const moduleKeys = [
  "officials",
  "ordinances",
  "resolutions",
  "news",
  "sessions",
  "committeeHearings",
  "documentCategories",
  "documents",
  "departments",
];
let db: PGlite;
let offices: Record<string, string>;
const ids = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  secretary: "00000000-0000-4000-8000-000000000002",
  vmo: "00000000-0000-4000-8000-000000000003",
  restricted: "00000000-0000-4000-8000-000000000004",
  viewer: "00000000-0000-4000-8000-000000000005",
};
async function as(user: keyof typeof ids, run: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[user],
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
async function configure(
  user: keyof typeof ids,
  office: string,
  modules: Record<string, boolean> | null,
  role = "admin",
) {
  await as("superadmin", async () => {
    await db.query(
      "select public.manage_staff($1,$2,true,$3,$4::jsonb,false,$5::jsonb)",
      [
        ids[user],
        role,
        user,
        JSON.stringify([
          { office_id: offices[office], permission_level: "viewer" },
        ]),
        modules === null ? null : JSON.stringify(modules),
      ],
    );
  });
}
const all = Object.fromEntries(moduleKeys.map((m) => [m, true]));
let snapshots: Record<string, unknown[]>;
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  for (const file of [
    "202609300001_content.sql",
    "202609300003_auth.sql",
    "202610010004_office_access.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  for (const [name, id] of Object.entries(ids))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      name + "@example.test",
    ]);
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id=$1",
    [ids.superadmin],
  );
  offices = Object.fromEntries(
    (
      await db.query<{ slug: string; id: string }>(
        "select slug,id from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
  await as("superadmin", async () => {
    await db.query(
      "select manage_staff($1,'admin',true,'Secretary',$2::jsonb,false)",
      [
        ids.secretary,
        JSON.stringify([
          { office_id: offices["sb-secretary"], permission_level: "viewer" },
        ]),
      ],
    );
  });
  await as("superadmin", async () => {
    await db.query("update officials set office_id=$1 where id='members'", [
      offices["sb-secretary"],
    ]);
  });
  await db.exec(
    readFileSync(
      "supabase/migrations/202610010005_legislative_modules.sql",
      "utf8",
    ),
  );
  await configure("vmo", "vice-mayor", all);
  await configure("restricted", "vice-mayor", {
    ...all,
    news: false,
    officials: false,
  });
  await configure("viewer", "sangguniang-bayan", all, "viewer");
  await db.exec(
    `create schema storage;grant usage on schema storage to authenticated;create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;create policy public_media_read on storage.objects for select to authenticated using(bucket_id='municipal-media');`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610010006_official_photos.sql",
      "utf8",
    ),
  );
  const tables = [
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
  ];
  await as("superadmin", async () => {
    await db.exec(
      "update officials set photo_url='https://example.test/storage/photo.webp' where id='members'",
    );
  });
  await as("superadmin", async () => {
    await db.exec(
      "insert into municipal_documents(id,category_id,title,description,date,file_url,content_scope) values('legislative-document','full-disclosure','Preserved document','Test','2026-10-01','/documents/existing.pdf','legislative')",
    );
  });
  snapshots = {};
  for (const table of tables)
    snapshots[table] = (
      await db.query(
        `select to_jsonb(t)-'office_id'-'updated_at'-'content_scope' as record from public.${table} t order by to_jsonb(t)->>'id',to_jsonb(t)->>'slug'`,
      )
    ).rows;
  await db.exec(
    readFileSync(
      "supabase/migrations/202610010007_single_legislative_access.sql",
      "utf8",
    ),
  );
  offices = Object.fromEntries(
    (
      await db.query<{ slug: string; id: string }>(
        "select slug,id from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
});

test.afterAll(async () => await db.close());
test("migration preserves every content record and uploaded URL", async () => {
  for (const table of Object.keys(snapshots))
    expect(
      (
        await db.query(
          `select to_jsonb(t)-'office_id'-'updated_at'-'legacy_office_id'-'content_scope' as record from public.${table} t order by to_jsonb(t)->>'id',to_jsonb(t)->>'slug'`,
        )
      ).rows,
    ).toEqual(snapshots[table]);
  expect(
    (
      await db.query<{ content_scope: string }>(
        "select content_scope from news where slug='regular-session'",
      )
    ).rows[0].content_scope,
  ).toBe("legislative");
  const row = (
    await db.query<{
      office_id: string;
      legacy_office_id: string;
      photo_url: string;
    }>("select * from officials where id='members'")
  ).rows[0];
  expect(row.office_id).toBe(offices["legislative-access"]);
  expect(row.legacy_office_id).toBe(offices["sb-secretary"]);
  expect(row.photo_url).toBe("https://example.test/storage/photo.webp");
});
test("one Legislative office and no module-based auth remains", async () => {
  expect(
    (
      await db.query(
        "select name from offices where department='legislative' and archived_at is null",
      )
    ).rows,
  ).toEqual([{ name: "Legislative Access" }]);
  expect(
    (
      await db.query("select * from user_office_access where office_id=$1", [
        offices["legislative-access"],
      ])
    ).rows,
  ).toHaveLength(4);
  expect(
    (
      await db.query(
        "select to_regclass('public.user_module_permissions') gone",
      )
    ).rows,
  ).toEqual([{ gone: null }]);
  await as("restricted", async () => {
    await expect(
      db.exec("select * from legacy_user_module_permissions"),
    ).rejects.toThrow();
  });
});
test("all previous Legislative users get whole-branch office access regardless of old module choices", async () => {
  for (const user of ["secretary", "vmo", "restricted"] as const)
    await as(user, async () => {
      for (const operation of ["read", "write", "delete"])
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select can_manage_office($1,$2) ok",
              [offices["legislative-access"], operation],
            )
          ).rows[0].ok,
        ).toBe(true);
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select can_manage_content('executive',$1,'write') ok",
            [offices["mpdc"]],
          )
        ).rows[0].ok,
      ).toBe(false);
    });
  await as("viewer", async () => {
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select can_manage_office($1,'write') ok",
          [offices["legislative-access"]],
        )
      ).rows[0].ok,
    ).toBe(false);
  });
});
test("normal office RPC assigns all Legislative access without module fields", async () => {
  await as("superadmin", async () => {
    await db.query(
      "select manage_staff($1,'admin',true,'Pedro',$2::jsonb,false)",
      [
        ids.restricted,
        JSON.stringify([
          {
            office_id: offices["legislative-access"],
            permission_level: "manager",
          },
        ]),
      ],
    );
    await expect(
      db.query("select manage_staff($1,'admin',true,'Pedro',$2::jsonb,false)", [
        ids.restricted,
        JSON.stringify([
          { office_id: offices["vice-mayor"], permission_level: "manager" },
        ]),
      ]),
    ).rejects.toThrow();
  });
});
test("every content table uses the same office authorization", async () => {
  for (const [table, key] of Object.entries({
    officials: "id",
    ordinances: "id",
    resolutions: "id",
    news: "slug",
    sessions: "id",
    services: "id",
    departments: "id",
    programs: "id",
    committees: "id",
    hearings: "id",
    document_categories: "id",
    municipal_documents: "id",
  })) {
    await as("superadmin", async () => {
      await db.query(
        `insert into ${table} select (jsonb_populate_record(null::${table},to_jsonb(t)||jsonb_build_object('${key}','legislative-test','content_scope','legislative','office_id',null,'published',false))).* from ${table} t ${table === "officials" ? "where legislative_role is not null" : ""} limit 1`,
      );
    });
    await as("restricted", async () => {
      expect(
        (
          await db.query(
            `select * from ${table} where ${key}='legislative-test'`,
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `update ${table} set sort_order=7 where ${key}='legislative-test' returning ${key}`,
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            `delete from ${table} where ${key}='legislative-test' returning ${key}`,
          )
        ).rows,
      ).toHaveLength(1);
    });
  }
});
test("Executive office boundaries, role caps and branch spoofing are enforced", async () => {
  await as("superadmin", async () => {
    await db.query(
      "select manage_staff($1,'admin',true,'Executive',$2::jsonb,false)",
      [
        ids.restricted,
        JSON.stringify([
          { office_id: offices.mpdc, permission_level: "manager" },
        ]),
      ],
    );
  });
  await as("restricted", async () => {
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select can_manage_content('executive',$1,'write') ok",
          [offices.mpdc],
        )
      ).rows[0].ok,
    ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select can_manage_content('executive',$1,'write') ok",
          [offices["municipal-assessor"]],
        )
      ).rows[0].ok,
    ).toBe(false);
    await expect(
      db.query(
        "insert into officials(name,description,role,branch,legislative_role,content_scope,office_id) values('Forbidden','Test','SB','legislative','SANGGUNIANG_BAYAN','legislative',$1)",
        [offices.mpdc],
      ),
    ).rejects.toThrow();
  });
});
test("upload policies follow the same office level and revocation", async () => {
  await as("secretary", async () => {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('municipal-media',$1)",
      [`officials/${ids.secretary}/whole-branch.webp`],
    );
  });
  await as("viewer", async () => {
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('municipal-media',$1)",
        [`officials/${ids.viewer}/denied.webp`],
      ),
    ).rejects.toThrow();
  });
  await db.query("update offices set active=false where id=$1", [
    offices["legislative-access"],
  ]);
  await as("secretary", async () => {
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select can_manage_office($1,'read') ok",
          [offices["legislative-access"]],
        )
      ).rows[0].ok,
    ).toBe(false);
  });
  await db.query("update offices set active=true where id=$1", [
    offices["legislative-access"],
  ]);
});
test("second Legislative office is rejected and seed still preserves content", async () => {
  await as("superadmin", async () => {
    await expect(
      db.exec(
        "insert into offices(name,slug,department) values('Extra','extra-legislative','legislative')",
      ),
    ).rejects.toThrow();
  });
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
});
