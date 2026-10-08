import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const moduleKeys = ["officials","ordinances","resolutions","news","sessions","committeeHearings","documentCategories","documents","departments"];
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
});
test.describe.configure({ mode: "serial" });
test.afterAll(async () => await db.close());
test("migration keeps old IDs/text/attribution and backfills roles and all nine modules", async () => {
  const result = await db.query<{
    id: string;
    role: string;
    legislative_role: string;
    office_id: string;
    content_scope: string;
  }>("select * from officials where id='members'");
  expect(result.rows[0]).toMatchObject({
    id: "members",
    legislative_role: "SANGGUNIANG_BAYAN",
    office_id: offices["sb-secretary"],
    content_scope: "legislative",
  });
  expect(
    (
      await db.query(
        "select * from user_module_permissions where user_id=$1 and enabled",
        [ids.secretary],
      )
    ).rows,
  ).toHaveLength(9);
  expect(
    (
      await db.query(
        "select * from officials where branch='legislative' and legislative_role is null",
      )
    ).rows,
  ).toHaveLength(0);
});
let officialId: string;
test("Secretary creates one canonical official with DB ID and VMO reads and updates it", async () => {
  await as("secretary", async () => {
    const result = await db.query<{
      id: string;
      created_by: string;
      office_id: null;
    }>(
      "insert into officials(name,description,role,branch,legislative_role,content_scope,published) values('Cross office member','Test Description','Sangguniang Bayan','legislative','SANGGUNIANG_BAYAN','legislative',true) returning *",
    );
    officialId = result.rows[0].id;
    expect(officialId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.rows[0].office_id).toBeNull();
    expect(result.rows[0].created_by).toBe(ids.secretary);
  });
  await as("vmo", async () => {
    expect(
      (await db.query("select * from officials where id=$1", [officialId]))
        .rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "update officials set description='Updated by VMO' where id=$1 returning id",
          [officialId],
        )
      ).rows,
    ).toHaveLength(1);
  });
  await db.exec("set role anon");
  try {
    expect(
      (
        await db.query(
          "select * from officials where id=$1 and legislative_role='SANGGUNIANG_BAYAN'",
          [officialId],
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.exec("reset role");
  }
  expect(
    (await db.query("select * from officials where name='Cross office member'"))
      .rows,
  ).toHaveLength(1);
});
test("same-office users have different persisted permissions", async () => {
  await as("restricted", async () => {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select can_manage_module('news','read') allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select can_manage_module('sessions','write') allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
  await as("vmo", async () => {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select can_manage_module('news','write') allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
});
test("disabled module rejects direct SQL create/update/delete and draft reads", async () => {
  await as("vmo", async () => {
    await db.exec(
      "insert into news(slug,title,category,date,excerpt,image,content,content_scope) values('private-news','Private','News','2026-10-01','Test','/test.png','{Body}','legislative')",
    );
  });
  await as("restricted", async () => {
    expect(
      (await db.query("select * from news where slug='private-news'")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        "insert into news(slug,title,category,date,excerpt,image,content,content_scope) values('forged-news','Private','News','2026-10-01','Test','/test.png','{Body}','legislative')",
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update news set title='Forbidden' where slug='private-news' returning slug",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from news where slug='private-news' returning slug",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update officials set name='Forbidden' where id=$1 returning id",
          [officialId],
        )
      ).rows,
    ).toHaveLength(0);
  });
});
test("all nine modules work equally across three offices and role caps still apply", async () => {
  for (const user of ["secretary", "vmo", "viewer"] as const)
    await as(user, async () => {
      for (const moduleKey of moduleKeys) {
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select can_manage_module($1,'read') ok",
              [moduleKey],
            )
          ).rows[0].ok,
        ).toBe(true);
      }
      if (user === "viewer")
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select can_manage_module('officials','write') ok",
            )
          ).rows[0].ok,
        ).toBe(false);
    });
});
test("office change preserves explicit false and true permissions", async () => {
  await configure("restricted", "sb-secretary", null);
  const rows = (
    await db.query<{ module: string; enabled: boolean }>(
      "select module,enabled from user_module_permissions where user_id=$1",
      [ids.restricted],
    )
  ).rows;
  expect(Object.fromEntries(rows.map((r) => [r.module, r.enabled]))).toEqual({
    ...all,
    news: false,
    officials: false,
  });
});
test("invalid enum, forged creator and scope transfer are blocked", async () => {
  await as("vmo", async () => {
    await expect(
      db.exec(
        "insert into officials(name,description,role,branch,legislative_role,content_scope) values('Invalid','Description','Role','legislative','INVALID','legislative')",
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update officials set content_scope='executive',branch='executive',legislative_role=null where id=$1",
        [officialId],
      ),
    ).rejects.toThrow();
    await db.query("update officials set created_by=$1 where id=$2", [
      ids.vmo,
      officialId,
    ]);
  });
  expect(
    (
      await db.query<{ created_by: string }>(
        "select created_by from officials where id=$1",
        [officialId],
      )
    ).rows[0].created_by,
  ).toBe(ids.secretary);
});
test("staff cannot grant their own modules or call private account RPC", async () => {
  await as("restricted", async () => {
    await expect(
      db.exec("update user_module_permissions set enabled=true"),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select portal_manage_staff_base($1,'superadmin',true,'Escalation','[]',false)",
        [ids.restricted],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select manage_staff($1,'superadmin',true,'Escalation','[]',false,'{}')",
        [ids.restricted],
      ),
    ).rejects.toThrow();
  });
});
test("storage accepts own official upload but rejects other user paths and disabled modules", async () => {
  await as("secretary", async () => {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('municipal-media',$1)",
      [`officials/${ids.secretary}/photo.webp`],
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('municipal-media',$1)",
        [`officials/${ids.vmo}/forged.webp`],
      ),
    ).rejects.toThrow();
  });
  await as("restricted", async () => {
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('municipal-media',$1)",
        [`officials/${ids.restricted}/blocked.webp`],
      ),
    ).rejects.toThrow();
  });
});
test("superadmin retains all modules and account protections", async () => {
  await as("superadmin", async () => {
    for (const moduleKey of moduleKeys)
      for (const op of ["read", "write", "delete"])
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select can_manage_module($1,$2) ok",
              [moduleKey, op],
            )
          ).rows[0].ok,
        ).toBe(true);
    await expect(
      db.query("select manage_staff($1,'viewer',true,'Self','[]',false,'{}')", [
        ids.superadmin,
      ]),
    ).rejects.toThrow();
  });
});

test("optional seed remains safe after the upgrade and preserves official edits", async () => {
  await as("superadmin", async () => {
    await db.exec(
      "update officials set description='Retained existing description' where id='members'",
    );
  });
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  expect(
    (
      await db.query<{ description: string }>(
        "select description from officials where id='members'",
      )
    ).rows[0].description,
  ).toBe("Retained existing description");
});
