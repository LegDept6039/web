import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
let offices: Record<string, string>;
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  mho: "00000000-0000-4000-8000-000000000002",
  legislative: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
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
  await db.exec(
    `create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
  );
  for (const f of [
    "202609300001_content.sql",
    "202609300003_auth.sql",
    "202610010004_office_access.sql",
    "202610010005_legislative_modules.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(
    `create schema storage;grant usage on schema storage to authenticated;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;create policy public_media_read on storage.objects for select to authenticated using(bucket_id='municipal-media');`,
  );
  for (const f of [
    "202610010006_official_photos.sql",
    "202610010007_single_legislative_access.sql",
    "202610020008_department_scope.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  offices = Object.fromEntries(
    (
      await db.query<{ id: string; slug: string }>(
        "select id,slug from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
  for (const [name, id] of Object.entries(users))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      name + "@test.local",
    ]);
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id=$1",
    [users.superadmin],
  );
  await as("superadmin", async () => {
    for (const [user, office, role, level] of [
      ["mho", "municipal-health", "admin", "manager"],
      ["legislative", "legislative-access", "admin", "manager"],
      ["viewer", "municipal-health", "viewer", "viewer"],
    ])
      await db.query("select manage_staff($1,$2,true,$3,$4::jsonb,false)", [
        users[user as keyof typeof users],
        role,
        user,
        JSON.stringify([
          { office_id: offices[office], permission_level: level },
        ]),
      ]);
    await db.query(
      "insert into offices(name,short_name,slug,department) values('Municipal Environment Office','MENRO','menro','executive')",
    );
  });
  offices = Object.fromEntries(
    (
      await db.query<{ id: string; slug: string }>(
        "select id,slug from offices",
      )
    ).rows.map((o) => [o.slug, o.id]),
  );
});
test.afterAll(async () => await db.close());

let newDepartment: string;
test.beforeAll(async () => {
  await db.exec(
    "update departments set head_name='Existing Head',head_photo='/images/existing-head.webp' where id='health'",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610020009_dynamic_departments.sql",
      "utf8",
    ),
  );
});
test.beforeAll(async () => {
  await db.exec(
    readFileSync(
      "supabase/migrations/202610050010_department_identity.sql",
      "utf8",
    ),
  );
});

test("authenticated accounts can resolve their own UUID profile and memberships after all migrations", async () => {
  for (const user of ["superadmin", "mho", "legislative", "viewer"] as const) {
    await as(user, async () => {
      const profile = await db.query(
        "select user_id,role,active,deleted_at from staff_accounts where user_id=auth.uid()",
      );
      expect(profile.rows).toHaveLength(1);
      expect(profile.rows[0]).toMatchObject({
        user_id: users[user],
        active: true,
      });
      const memberships = await db.query(
        "select office_id from user_office_access where user_id=auth.uid()",
      );
      expect(memberships.rows.length).toBe(user === "superadmin" ? 0 : 1);
      if (user !== "superadmin") {
        const other = await db.query(
          "select user_id from staff_accounts where user_id=$1",
          [users.superadmin],
        );
        expect(other.rows).toHaveLength(0);
      }
    });
  }
});

test("consolidation preserves IDs, assignments, legacy profiles and head information", async () => {
  expect(
    (
      await db.query(
        "select head_name,head_photo from departments where slug='health'",
      )
    ).rows,
  ).toEqual([
    { head_name: "Existing Head", head_photo: "/images/existing-head.webp" },
  ]);
  const health = offices["municipal-health"];
  expect(
    (
      await db.query<{ id: string }>(
        "select id from departments where slug='health'",
      )
    ).rows[0].id,
  ).toBe(health);
  expect(
    (
      await db.query(
        "select * from user_office_access where user_id=$1 and office_id=$2",
        [users.mho, health],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select * from legacy_department_profiles where id='health'",
      )
    ).rows,
  ).toHaveLength(1);
  const fk = (
    await db.query<{ table_name: string }>(
      "select confrelid::regclass::text table_name from pg_constraint where conrelid='user_office_access'::regclass and contype='f' and confrelid='departments'::regclass",
    )
  ).rows;
  expect(fk).toHaveLength(1);
  await as("mho", async () => {
    await expect(
      db.exec("select * from legacy_department_profiles"),
    ).rejects.toThrow();
  });
});
test("Superadmin creates a previously unknown department and assigns an Editor without code changes", async () => {
  await as("superadmin", async () => {
    const rows = (
      await db.query<{ id: string }>(
        "insert into departments(name,short_name,slug,department,description) values('Dynamic Agriculture Office','MAO','dynamic-agriculture','executive','Agriculture support') returning id",
      )
    ).rows;
    newDepartment = rows[0].id;
    await db.query(
      "select manage_staff($1,'editor',true,'Dynamic editor',$2::jsonb,false)",
      [
        users.mho,
        JSON.stringify([
          { office_id: newDepartment, permission_level: "editor" },
        ]),
      ],
    );
  });
  await db.exec("set role anon");
  try {
    expect(
      (
        await db.query(
          "select * from departments where slug='dynamic-agriculture'",
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.exec("reset role");
  }
});
test("Editor edits page, head and images but cannot alter access settings or other departments", async () => {
  await as("mho", async () => {
    expect(
      (
        await db.query(
          "update departments set body='About our services',head_name='Head One',head_description='Head biography',image_url='/images/test.webp',head_photo='/images/head.webp' where id=$1 returning id",
          [newDepartment],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "update departments set name='Forbidden' where id=$1 returning id",
          [offices.menro],
        )
      ).rows,
    ).toHaveLength(0);
    for (const change of [
      "name='Forbidden'",
      "short_name='BAD'",
      "slug='stolen-slug'",
      "published=false",
      "sort_order=99",
    ]) {
      await expect(
        db.query(`update departments set ${change} where id=$1`, [
          newDepartment,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      db.query("update departments set active=false where id=$1", [
        newDepartment,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("update departments set department='legislative' where id=$1", [
        newDepartment,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.exec(
        "insert into departments(name,slug,department) values('Forbidden','forbidden-new','executive')",
      ),
    ).rejects.toThrow();
  });
});
test("Editor has own news/program/contact CRUD and cannot forge resource ownership", async () => {
  await as("mho", async () => {
    await db.query(
      "insert into news(slug,title,category,date,excerpt,image,content,office_id) values('dynamic-news','Dynamic news','Updates','2026-10-02','Test','/test.svg',ARRAY['Body'],$1)",
      [newDepartment],
    );
    await db.query(
      "insert into programs(id,name,description,category,status,office_id) values('dynamic-program','Program','Test','Services','Active',$1)",
      [newDepartment],
    );
    for (const [type, value] of [
      ["PHONE", "09170000000"],
      ["PHONE", "09280000000"],
      ["EMAIL", "office@example.test"],
      ["EMAIL", "records@example.test"],
      ["LOCATION", "Municipal Hall"],
    ])
      await db.query(
        "insert into department_contacts(office_id,type,value) values($1,$2,$3)",
        [newDepartment, type, value],
      );
    expect(
      (
        await db.query("select * from department_contacts where office_id=$1", [
          newDepartment,
        ])
      ).rows,
    ).toHaveLength(5);
    expect(
      (
        await db.query(
          "update department_contacts set label='Office' where office_id=$1 returning id",
          [newDepartment],
        )
      ).rows,
    ).toHaveLength(5);
    await expect(
      db.query(
        "insert into department_contacts(office_id,type,value) values($1,'PHONE','09170000000')",
        [offices.menro],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("update news set office_id=$1 where slug='dynamic-news'", [
        offices.menro,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await db.query(
          "delete from news where slug='dynamic-news' returning slug",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "delete from programs where id='dynamic-program' returning id",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "delete from department_contacts where office_id=$1 and type='LOCATION' returning id",
          [newDepartment],
        )
      ).rows,
    ).toHaveLength(1);
  });
});
test("all non-superadmin roles are denied department creation, including Legislative staff", async () => {
  for (const user of ["mho", "viewer", "legislative"] as const) {
    await as(user, async () => {
      await expect(
        db.query(
          "insert into departments(name,slug,department) values('Unauthorized',$1,'executive')",
          [`forbidden-${user}`],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  }
});

test("Superadmin owns identity/publication changes and preserves old slug aliases", async () => {
  await as("superadmin", async () => {
    const result = await db.query(
      "update departments set name='Renamed Dynamic Office',short_name='RDO',slug='renamed-dynamic-office',published=false,sort_order=12 where id=$1 returning id",
      [newDepartment],
    );
    expect(result.rows).toHaveLength(1);
  });
  expect(
    (
      await db.query(
        "select department_id from department_slug_aliases where slug='dynamic-agriculture'",
      )
    ).rows,
  ).toEqual([{ department_id: newDepartment }]);
  await db.exec("set role anon");
  try {
    expect(
      (
        await db.query("select id from departments where id=$1", [
          newDepartment,
        ])
      ).rows,
    ).toHaveLength(0);
  } finally {
    await db.exec("reset role");
  }
  await as("superadmin", async () => {
    await db.query("update departments set published=true where id=$1", [
      newDepartment,
    ]);
  });
});

test("inactive departments disappear publicly and revoke edits; permanent deletion is blocked", async () => {
  await as("superadmin", async () => {
    await db.query("update departments set active=false where id=$1", [
      newDepartment,
    ]);
    await expect(
      db.query("delete from departments where id=$1", [newDepartment]),
    ).rejects.toThrow();
    await expect(
      db.query("select manage_staff($1,'editor',true,'Bad',$2::jsonb,false)", [
        users.viewer,
        JSON.stringify([
          { office_id: newDepartment, permission_level: "editor" },
        ]),
      ]),
    ).rejects.toThrow();
  });
  await db.exec("set role anon");
  try {
    expect(
      (await db.query("select * from departments where id=$1", [newDepartment]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from department_contacts where office_id=$1", [
          newDepartment,
        ])
      ).rows,
    ).toHaveLength(0);
  } finally {
    await db.exec("reset role");
  }
  await as("mho", async () => {
    expect(
      (
        await db.query(
          "update departments set body='Forbidden' where id=$1 returning id",
          [newDepartment],
        )
      ).rows,
    ).toHaveLength(0);
  });
});
