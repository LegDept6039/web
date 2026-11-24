import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

test.describe.configure({ mode: "serial" });
const migration = "202611230032_barangay_affairs.sql";
const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  affairs: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
  executive: "00000000-0000-4000-8000-000000000005",
  legislative: "00000000-0000-4000-8000-000000000006",
};
type Staff = keyof typeof users;
let db: PGlite;
let affairs: string;
let health: string;
let legislative: string;
let barangay: string;
let before: Record<string, unknown>;
const rich = (indent?: unknown) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs:
        indent === undefined ? { size: "large" } : { size: "large", indent },
      content: [
        { type: "text", text: "Community news", marks: [{ type: "bold" }] },
      ],
    },
  ],
});

async function as<T>(user: Staff | "anon", run: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user === "anon" ? "" : users[user],
  ]);
  await db.exec(`set role ${user === "anon" ? "anon" : "authenticated"}`);
  let failed = false;
  try {
    return await run();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await db.exec(
        "reset role;select set_config('request.jwt.claim.sub','',false)",
      );
    } catch (error) {
      if (!failed) throw error;
    }
  }
}
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of [
    "departments",
    "staff_accounts",
    "user_office_access",
    "news",
    "barangays",
    "sk_profiles",
    "services",
    "storage.objects",
  ]) {
    result[table] = (
      await db.query(
        `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
      )
    ).rows;
  }
  return result;
}
async function bool(expression: string, values: unknown[] = []) {
  return (
    await db.query<{ value: boolean }>(`select ${expression} value`, values)
  ).rows[0].value;
}
async function article(
  slug: string,
  owner: string,
  linked: string | null,
  published = true,
) {
  const position = published
    ? (
        await db.query<{ position: number }>(
          "select count(*)::integer+1 position from news where published and office_id=$1 and content_scope='executive'",
          [owner],
        )
      ).rows[0].position
    : 0;
  return db.query(
    `insert into news(slug,title,category,date,excerpt,image,content,office_id,content_scope,published,sort_order,barangay_id)
    values($1,$1,'Community','2026-11-23','Community update','/images/retained-news.webp',array['Community news'],$2,'executive',$3,$4,$5)
    returning id,barangay_id,created_by`,
    [slug, owner, published, position, linked],
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
  for (const [name, id] of Object.entries(users)) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      `${name}@test.local`,
    ]);
    await db.query(
      "update staff_accounts set role=$1,active=true where user_id=$2",
      [
        name === "superadmin"
          ? name
          : name === "viewer"
            ? "viewer"
            : name === "editor"
              ? "editor"
              : "admin",
        id,
      ],
    );
  }
  health = (
    await db.query<{ id: string }>(
      "select id from departments where slug='municipal-health' union all select department_id id from department_slug_aliases where slug='municipal-health' limit 1",
    )
  ).rows[0].id;
  legislative = (
    await db.query<{ id: string }>(
      "select id from departments where slug='legislative-access'",
    )
  ).rows[0].id;
  barangay = (
    await db.query<{ id: string }>(
      "select id from barangays where slug='anislag'",
    )
  ).rows[0].id;
  before = await snapshot();
});
test.afterAll(async () => await db.close());

test("conflicting department identities and old aliases fail transactionally", async () => {
  for (const conflict of ["name", "slug", "alias"] as const) {
    await db.exec("begin");
    if (conflict === "alias")
      await db.query(
        "insert into department_slug_aliases values('barangay-affairs',$1)",
        [health],
      );
    else
      await as("superadmin", async () => {
        await db.query(
          `insert into departments(name,short_name,slug,department,published,sort_order)
        values($1,'Conflict',$2,'executive',false,0)`,
          [
            conflict === "name" ? "Barangay Affairs" : "Other Department",
            conflict === "slug" ? "barangay-affairs" : "other-affairs",
          ],
        );
      });
    await expect(db.exec(sql)).rejects.toThrow(/Barangay Affairs/);
    await db.exec("rollback");
    expect(await snapshot()).toEqual(before);
    expect(
      (
        await db.query(
          "select column_name from information_schema.columns where table_name='news' and column_name='barangay_id'",
        )
      ).rows,
    ).toEqual([]);
  }
});

test("an exact preexisting workspace is reused with its UUID and deactivation preserved", async () => {
  await db.exec("begin");
  const existing = await as(
    "superadmin",
    async () =>
      (
        await db.query<{
          id: string;
        }>(`insert into departments(name,short_name,slug,department,published,sort_order,active)
    values('Barangay Affairs','Barangay Affairs','barangay-affairs','executive',false,0,false) returning id`)
      ).rows[0].id,
  );
  await db.exec("set constraints all immediate");
  // Keep the actual migration body under this test's transaction so we can
  // inspect reuse, then restore the pre-migration database for the create path.
  await db.exec(sql.replace(/^begin;\s*/, "").replace(/commit;\s*$/, ""));
  expect(
    (
      await db.query(
        "select id,active from departments where slug='barangay-affairs'",
      )
    ).rows,
  ).toEqual([{ id: existing, active: false }]);
  expect(await bool("is_barangay_affairs_office($1)", [existing])).toBe(true);
  expect(
    (await db.query("select barangay_affairs_office_id() id")).rows,
  ).toEqual([{ id: null }]);
  await db.exec("rollback");
  expect(await snapshot()).toEqual(before);
});

test("a late schema conflict rolls back the workspace, helpers and temporary ordering trigger change", async () => {
  const triggers = (
    await db.query(
      "select tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='departments'::regclass order by tgname",
    )
  ).rows;
  await db.exec("begin;alter table news add column barangay_id text");
  await expect(db.exec(sql)).rejects.toThrow(/already exists/);
  await db.exec("rollback");
  expect(await snapshot()).toEqual(before);
  expect(
    (
      await db.query(
        "select tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='departments'::regclass order by tgname",
      )
    ).rows,
  ).toEqual(triggers);
  expect(
    (
      await db.query(
        "select proname from pg_proc where proname='can_manage_barangays'",
      )
    ).rows,
  ).toEqual([]);
});

test("migration creates one hidden workspace and preserves existing content and access", async () => {
  await db.exec(sql);
  const workspace = (
    await db.query<{
      id: string;
      name: string;
      short_name: string;
      active: boolean;
      published: boolean;
      sort_order: number;
    }>(
      "select id,name,short_name,active,published,sort_order from departments where slug='barangay-affairs'",
    )
  ).rows;
  expect(workspace).toHaveLength(1);
  affairs = workspace[0].id;
  expect(workspace[0]).toMatchObject({
    name: "Barangay Affairs",
    short_name: "Barangay Affairs",
    active: true,
    published: false,
    sort_order: 0,
  });
  const after = await snapshot();
  expect(
    (after.departments as { row: { id: string } }[]).filter(
      (r) => r.row.id !== affairs,
    ),
  ).toEqual(before.departments);
  for (const table of [
    "staff_accounts",
    "user_office_access",
    "barangays",
    "sk_profiles",
    "services",
    "storage.objects",
  ])
    expect(after[table]).toEqual(before[table]);
  expect(
    (after.news as { row: Record<string, unknown> }[]).map(({ row }) => ({
      row: Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "barangay_id"),
      ),
    })),
  ).toEqual(before.news);
  await as("superadmin", async () => {
    for (const [user, office, level] of [
      ["affairs", affairs, "manager"],
      ["editor", affairs, "editor"],
      ["viewer", affairs, "viewer"],
      ["executive", health, "manager"],
      ["legislative", legislative, "manager"],
    ] as const)
      await db.query("select manage_staff($1,$2,true,$3,$4::jsonb,false)", [
        users[user],
        user === "editor" ? "editor" : user === "viewer" ? "viewer" : "admin",
        user,
        JSON.stringify([{ office_id: office, permission_level: level }]),
      ]);
  });
});

test("existing membership and role limits grant barangay edits without other modules or SK", async () => {
  for (const user of [
    "affairs",
    "editor",
    "viewer",
    "executive",
    "legislative",
  ] as const)
    await as(user, async () => {
      expect(await bool("can_manage_barangays('read')")).toBe(
        ["affairs", "editor", "viewer"].includes(user),
      );
      expect(await bool("can_manage_barangays('write')")).toBe(
        ["affairs", "editor"].includes(user),
      );
      expect(await bool("can_manage_barangays('delete')")).toBe(false);
      expect(
        await bool("can_manage_collection('news','executive',$1,'write')", [
          affairs,
        ]),
      ).toBe(["affairs", "editor"].includes(user));
      for (const table of [
        "departments",
        "programs",
        "services",
        "department_contacts",
        "officials",
        "sessions",
      ])
        expect(
          await bool("can_manage_collection($1,'executive',$2,'write')", [
            table,
            affairs,
          ]),
        ).toBe(false);
      const changed = await db.query(
        "update barangays set body='Updated community information' where id=$1 returning id",
        [barangay],
      );
      expect(changed.rows).toHaveLength(
        ["affairs", "editor"].includes(user) ? 1 : 0,
      );
      expect(
        (
          await db.query(
            "update sk_profiles set body='Forged' where barangay_id=$1 returning id",
            [barangay],
          )
        ).rows,
      ).toEqual([]);
      await expect(
        db.query("delete from barangays where id=$1", [barangay]),
      ).rejects.toThrow(/permission denied/);
    });
  await as("editor", async () => {
    expect(
      (
        await db.query(
          "update departments set body='Forged workspace profile' where id=$1 returning id",
          [affairs],
        )
      ).rows,
    ).toEqual([]);
    await db.query(
      "insert into barangays(name,slug) values('Staff created','staff-created')",
    );
    await expect(
      db.query(
        `insert into programs(id,slug,name,description,category,status,office_id,content_scope,published,sort_order)
      values('denied-affairs-program','denied-affairs-program','Denied','Body','Community','Ongoing',$1,'executive',false,0)`,
        [affairs],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `insert into services(id,name,description,steps,body,office_id,content_scope,published,sort_order)
      values('denied-affairs-service','Denied','Description',array[]::text[],'Body',$1,'executive',false,0)`,
        [affairs],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `insert into department_contacts(type,value,office_id,content_scope,published,sort_order)
      values('PHONE','123',$1,'executive',false,0)`,
        [affairs],
      ),
    ).rejects.toThrow();
  });
  await as("viewer", async () => {
    expect(
      (await db.query("select id from barangays where slug='staff-created'"))
        .rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "insert into barangays(name,slug) values('Denied','viewer-created')",
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

test("Barangay Affairs identity stays private and reserved, including for Superadmin", async () => {
  await as("superadmin", async () => {
    for (const change of [
      "published=true,sort_order=1",
      "slug='renamed-affairs'",
      "name='Another name'",
      "short_name='Changed'",
      "id=gen_random_uuid()",
    ])
      await expect(
        db.query(`update departments set ${change} where id=$1`, [affairs]),
      ).rejects.toThrow(/access-only workspace/);
    await expect(
      db.query(
        "insert into departments(name,slug,department,published,sort_order) values('Barangay Affairs','other-affairs','executive',false,0)",
      ),
    ).rejects.toThrow(/reserved/);
  });
  await as("anon", async () =>
    expect(
      (await db.query("select id from departments where id=$1", [affairs]))
        .rows,
    ).toEqual([]),
  );
});

test("assigned staff create linked news, while forged links, scope and transfers are rejected", async () => {
  await as("affairs", async () => {
    const row = (await article("anislag-community-news", affairs, barangay))
      .rows[0];
    expect(row).toMatchObject({
      barangay_id: barangay,
      created_by: users.affairs,
    });
    await expect(article("missing-barangay", affairs, null)).rejects.toThrow(
      /requires a barangay/,
    );
    await expect(
      article("forged-other-office", health, barangay),
    ).rejects.toThrow();
    await expect(
      article("missing-parent", affairs, randomUUID()),
    ).rejects.toThrow(/foreign key/);
    await expect(
      db.query(
        "update news set barangay_id=null where slug='anislag-community-news'",
      ),
    ).rejects.toThrow(/cannot be transferred/);
    await expect(
      db.query(
        "update news set content_scope='legislative' where slug='anislag-community-news'",
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update news set office_id=$1 where slug='anislag-community-news'",
        [health],
      ),
    ).rejects.toThrow();
    await db.query(
      "update news set rich_body=$1::jsonb where slug='anislag-community-news'",
      [JSON.stringify(rich(2))],
    );
  });
  await as("executive", async () => {
    await article("ordinary-health-news", health, null);
    await expect(
      article("forged-linked-health", health, barangay),
    ).rejects.toThrow(/requires a barangay/);
    expect(
      (
        await db.query(
          "update news set title='Forged' where slug='anislag-community-news' returning id",
        )
      ).rows,
    ).toEqual([]);
  });
  await as("superadmin", async () => {
    await expect(
      db.query(
        "update news set office_id=$1,barangay_id=$2 where slug='ordinary-health-news'",
        [affairs, barangay],
      ),
    ).rejects.toThrow(/cannot be transferred/);
    await expect(
      db.query(
        "update news set office_id=$1,barangay_id=null where slug='anislag-community-news'",
        [health],
      ),
    ).rejects.toThrow(/cannot be transferred/);
  });
  await as("viewer", async () => {
    expect(
      (
        await db.query(
          "select id from news where slug='anislag-community-news'",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "update news set title='Forged' where slug='anislag-community-news' returning id",
        )
      ).rows,
    ).toEqual([]);
    await expect(article("viewer-news", affairs, barangay)).rejects.toThrow();
  });
});

test("public articles use the barangay source and follow parent publication plus workspace activation", async () => {
  const publicRow = async () =>
    as("anon", async () => {
      const direct = (
        await db.query(
          "select slug from news where slug='anislag-community-news'",
        )
      ).rows;
      const projected = (
        await db.query(
          "select slug,barangay_id,source from published_news where slug='anislag-community-news'",
        )
      ).rows;
      expect(projected).toHaveLength(direct.length);
      return projected;
    });
  expect(await publicRow()).toEqual([
    {
      slug: "anislag-community-news",
      barangay_id: barangay,
      source: { name: "Anislag", slug: null },
    },
  ]);
  await as("affairs", async () =>
    db.query("update barangays set published=false where id=$1", [barangay]),
  );
  expect(await publicRow()).toEqual([]);
  await as("affairs", async () => {
    expect(
      (
        await db.query(
          "select id from news where slug='anislag-community-news'",
        )
      ).rows,
    ).toHaveLength(1);
    await db.query("update barangays set published=true where id=$1", [
      barangay,
    ]);
  });
  await as("superadmin", async () =>
    db.query("update departments set active=false where id=$1", [affairs]),
  );
  expect(await publicRow()).toEqual([]);
  await as("affairs", async () => {
    expect(await bool("can_manage_barangays('write')")).toBe(false);
    expect(
      (
        await db.query(
          "update barangays set body='Revoked' where id=$1 returning id",
          [barangay],
        )
      ).rows,
    ).toEqual([]);
    await expect(
      article("inactive-affairs-news", affairs, barangay),
    ).rejects.toThrow();
  });
  await as("anon", async () =>
    expect(
      (
        await db.query(
          "select slug from published_news where slug='ordinary-health-news'",
        )
      ).rows,
    ).toHaveLength(1),
  );
  await as("superadmin", async () =>
    db.query("update departments set active=true where id=$1", [affairs]),
  );
  expect(await publicRow()).toHaveLength(1);
});

test("profile photos use the existing uploader path and retain referenced assets", async () => {
  const owned = `barangays/${users.editor}/owned.webp`;
  const referenced = `barangays/${users.editor}/referenced.webp`;
  await as("editor", async () => {
    await db.query(
      "insert into storage.objects values('municipal-media',$1),('municipal-media',$2)",
      [owned, referenced],
    );
    await db.query("update barangays set image_url=$1 where id=$2", [
      `https://fixture.supabase.test/storage/v1/object/public/municipal-media/${referenced}`,
      barangay,
    ]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [referenced],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [owned],
        )
      ).rows,
    ).toEqual([{ name: owned }]);
    await expect(
      db.query("insert into storage.objects values('municipal-media',$1)", [
        `barangays/${users.affairs}/forged.webp`,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
  for (const user of ["viewer", "executive", "legislative"] as const)
    await as(user, async () => {
      await expect(
        db.query("insert into storage.objects values('municipal-media',$1)", [
          `barangays/${users[user]}/denied.webp`,
        ]),
      ).rejects.toThrow(/row-level security/);
    });
});

test("revocation, disabled accounts and pending password resets remove write access immediately", async () => {
  await db.query(
    "delete from user_office_access where user_id=$1 and office_id=$2",
    [users.editor, affairs],
  );
  await as("editor", async () =>
    expect(await bool("can_manage_barangays('write')")).toBe(false),
  );
  await db.query(
    "insert into user_office_access(user_id,office_id,permission_level) values($1,$2,'viewer')",
    [users.editor, affairs],
  );
  await as("editor", async () =>
    expect(await bool("can_manage_barangays('write')")).toBe(false),
  );
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.affairs,
  ]);
  await as("affairs", async () =>
    expect(await bool("can_manage_barangays('write')")).toBe(false),
  );
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.affairs,
  ]);
  await db.query(
    "insert into staff_password_resets(user_id,generation,state,initiated_by) values($1,$2,'issuing',$3)",
    [users.affairs, randomUUID(), users.superadmin],
  );
  await as("affairs", async () => {
    expect(await bool("can_manage_barangays('write')")).toBe(false);
    await expect(
      article("password-reset-news", affairs, barangay),
    ).rejects.toThrow();
  });
});

test("rich bodies accept only bounded integer paragraph indentation", async () => {
  for (const indent of [undefined, 0, 1, 6])
    expect(
      await bool("portal_valid_rich_node($1::jsonb)", [
        JSON.stringify(rich(indent)),
      ]),
    ).toBe(true);
  for (const indent of [-1, 7, 1.5, "2", null, {}, true])
    expect(
      await bool("portal_valid_rich_node($1::jsonb)", [
        JSON.stringify(rich(indent)),
      ]),
    ).toBe(false);
  for (const node of [
    { type: "paragraph", attrs: { style: "padding:20px" } },
    { type: "bulletList", attrs: { indent: 2 } },
    { type: "paragraph", attrs: { indent: 2, size: "giant" } },
    { type: "text", text: "Bad", attrs: { indent: 2 } },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Bad", marks: [{ type: "link" }] }],
    },
  ])
    expect(
      await bool("portal_valid_rich_node($1::jsonb)", [JSON.stringify(node)]),
    ).toBe(false);
});
