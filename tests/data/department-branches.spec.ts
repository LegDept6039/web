import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

test.describe.configure({ mode: "serial" });
const migration = "202611240034_department_branches.sql";
const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  parent: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
  other: "00000000-0000-4000-8000-000000000005",
};
type Staff = keyof typeof users;
let db: PGlite;
let treasury: string;
let engineering: string;
let legislative: string;
let affairs: string;
let market: string;
let slaughter: string;
let waterworks: string;
let retained: Record<string, unknown>;

async function as<T>(user: Staff | "anon", run: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user === "anon" ? "" : users[user],
  ]);
  await db.exec(`set role ${user === "anon" ? "anon" : "authenticated"}`);
  try {
    return await run();
  } finally {
    await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)");
  }
}
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of [
    "staff_accounts", "user_office_access", "news", "programs", "services",
    "department_contacts", "storage.objects", "barangays", "sk_profiles",
  ])
    result[table] = (await db.query(`select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`)).rows;
  result.departments = (await db.query("select to_jsonb(d) row from departments d order by id")).rows;
  return result;
}
async function position() {
  return (await db.query<{ position: number }>("select count(*)::integer+1 position from departments where department='executive' and published")).rows[0].position;
}
async function createDepartment(name: string, slug: string, parent: string | null = null) {
  return (await db.query<{ id: string }>(
    "insert into departments(name,short_name,slug,department,published,sort_order,parent_department_id) values($1,'',$2,'executive',false,0,$3) returning id",
    [name, slug, parent],
  )).rows[0].id;
}
async function visible(id: string) {
  return (await db.query<{ visible: boolean }>("select public_department_visible($1) visible", [id])).rows[0].visible;
}
async function manage(user: Exclude<Staff, "superadmin">, office: string | null) {
  const role = user === "parent" ? "admin" : user === "viewer" ? "viewer" : "editor";
  return db.query("select manage_staff($1,$2,true,$3,$4::jsonb,false)", [
    users[user], role, user, JSON.stringify(office ? [{ office_id: office, permission_level: role === "admin" ? "manager" : role }] : []),
  ]);
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
  for (const file of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql") && f < migration).sort()) {
    if (file === "202609300002_media.sql") continue;
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file === "202610010005_legislative_modules.sql")
      await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  }
  for (const [name, id] of Object.entries(users)) {
    await db.query("insert into auth.users values($1,$2)", [id, `${name}@test.local`]);
    await db.query("update staff_accounts set role=$1,active=true where user_id=$2", [name === "superadmin" ? name : name === "viewer" ? "viewer" : name === "parent" ? "admin" : "editor", id]);
  }
  treasury = (await db.query<{ id: string }>("select id from departments where short_name='TREASURY'")).rows[0].id;
  engineering = (await db.query<{ id: string }>("select id from departments where short_name='ENGINEERING'")).rows[0].id;
  legislative = (await db.query<{ id: string }>("select id from departments where slug='legislative-access'")).rows[0].id;
  affairs = (await db.query<{ id: string }>("select id from departments where slug='barangay-affairs'")).rows[0].id;
  await as("superadmin", async () => {
    await db.query("update departments set published=true,sort_order=$1 where id=$2", [await position(), treasury]);
    market = (await db.query<{ id: string }>(`insert into departments(name,short_name,slug,department,published,sort_order,
      description,body,image_url,head_name,head_photo) values('Market Affairs','Existing market','market-affairs','executive',false,0,
      'Existing description','Existing body','/images/retained-market.webp','Existing head','/images/retained-head.webp') returning id`)).rows[0].id;
    for (const [user, office] of [["parent", treasury], ["editor", market], ["viewer", market], ["other", engineering]] as const)
      await manage(user, office);
    await db.query(`insert into news(slug,title,category,date,excerpt,image,content,office_id,content_scope,published,sort_order)
      values('retained-market-news','Retained news','News','2026-11-24','Keep excerpt','/images/retained-news.webp',array['Keep content'],$1,'executive',false,0)`, [market]);
  });
  await db.exec("insert into storage.objects values('municipal-media','departments/retained-market.webp')");
  retained = await snapshot();
});
test.afterAll(async () => await db.close());

test("ambiguous identities, aliases and unexpected ordering state abort without changing existing data", async () => {
  for (const conflict of ["parent", "child-name", "child-slug", "alias", "trigger", "preservation"] as const) {
    await db.exec("begin");
    if (conflict === "trigger") await db.exec("alter table departments disable trigger z_reorder");
    else if (conflict === "preservation")
      await db.exec(`create function public.test_branch_rewrite() returns trigger language plpgsql as $$
        begin if to_jsonb(new)->>'parent_department_id' is not null then new.body='Unexpected rewrite'; end if; return new; end $$;
        create trigger test_branch_rewrite before update on public.departments for each row execute function public.test_branch_rewrite()`);
    else if (conflict === "alias")
      await db.query("insert into department_slug_aliases values('waterworks',$1)", [treasury]);
    else await as("superadmin", async () => {
      await db.query("insert into departments(name,short_name,slug,department,published,sort_order) values($1,$2,$3,'executive',false,0)", [
        conflict === "child-name" ? "Market Affairs" : "Unrelated office",
        conflict === "parent" ? "TREASURY" : "",
        conflict === "child-slug" ? "waterworks" : `conflict-${conflict}`,
      ]);
    });
    await db.exec("set constraints all immediate");
    await expect(db.exec(sql)).rejects.toThrow(/ambiguous|Ambiguous|Conflicting|alias|ordering trigger|preservation check/);
    await db.exec("rollback");
    expect(await snapshot()).toEqual(retained);
    expect((await db.query("select column_name from information_schema.columns where table_name='departments' and column_name='parent_department_id'")).rows).toHaveLength(0);
  }
});

test("migration links existing canonical branch and publishes missing names without modifying identities or content", async () => {
  await db.exec(sql);
  const branches = (await db.query<{ id: string; name: string; short_name: string; parent_department_id: string; published: boolean; image_url: string | null; description: string; body: string }>(
    "select id,name,short_name,parent_department_id,published,image_url,description,body from departments where parent_department_id is not null order by name",
  )).rows;
  expect(branches).toHaveLength(3);
  expect(branches[0]).toMatchObject({ id: market, name: "Market Affairs", parent_department_id: treasury, published: false, body: "Existing body", image_url: "/images/retained-market.webp" });
  expect(branches[1]).toMatchObject({ name: "Slaughter House", short_name: "", parent_department_id: treasury, published: true, image_url: null, description: "", body: "" });
  expect(branches[2]).toMatchObject({ name: "Waterworks", short_name: "", parent_department_id: engineering, published: true, image_url: null, description: "", body: "" });
  slaughter = branches[1].id;
  waterworks = branches[2].id;
  const after = await snapshot();
  for (const [table, records] of Object.entries(retained)) {
    if (table !== "departments") expect(after[table]).toEqual(records);
  }
  const oldDepartments = retained.departments as { row: Record<string, unknown> }[];
  const newDepartments = (after.departments as { row: Record<string, unknown> }[]).map(({ row }) => row);
  for (const { row } of oldDepartments) {
    const current = newDepartments.find((d) => d.id === row.id)!;
    const { parent_department_id, ...preserved } = current;
    expect(parent_department_id).toBe(row.id === market ? treasury : null);
    expect({ ...preserved, updated_at: row.updated_at }).toEqual(row);
  }
  expect((await db.query("select tgname,tgenabled from pg_trigger where tgrelid='departments'::regclass and tgname in ('z_reorder','protect_department','validate_department_parent') order by tgname")).rows).toEqual([
    { tgname: "protect_department", tgenabled: "O" }, { tgname: "validate_department_parent", tgenabled: "O" }, { tgname: "z_reorder", tgenabled: "O" },
  ]);
});

test("parent and branch memberships grant only their separately assigned office", async () => {
  await as("parent", async () => {
    expect((await db.query<{ access: boolean }>("select can_manage_office($1,'write') access", [market])).rows[0].access).toBe(false);
    expect((await db.query("update departments set body='Forged inherited access' where id=$1 returning id", [market])).rows).toHaveLength(0);
    expect((await db.query("update departments set body='Treasury information' where id=$1 returning id", [treasury])).rows).toHaveLength(1);
  });
  await as("editor", async () => {
    expect((await db.query("update departments set body='Branch information' where id=$1 returning id", [market])).rows).toHaveLength(1);
    expect((await db.query("update departments set body='Parent forgery' where id=$1 returning id", [treasury])).rows).toHaveLength(0);
    expect((await db.query("update departments set body='Sibling forgery' where id=$1 returning id", [slaughter])).rows).toHaveLength(0);
  });
  await as("viewer", async () => {
    expect((await db.query("select id from departments where id=$1", [market])).rows).toHaveLength(1);
    expect((await db.query("update departments set body='Viewer forgery' where id=$1 returning id", [market])).rows).toHaveLength(0);
  });
});

test("editors cannot forge hierarchy or create a branch; Superadmin identity management remains required", async () => {
  await as("editor", async () => {
    await expect(db.query("update departments set parent_department_id=$1 where id=$2", [engineering, market])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("update departments set parent_department_id=null where id=$1", [market])).rejects.toMatchObject({ code: "42501" });
    await expect(createDepartment("Forged office", "forged-office", treasury)).rejects.toThrow();
  });
  await as("superadmin", async () => {
    const child = await createDepartment("New branch", "new-branch", treasury);
    await db.query("update departments set parent_department_id=$1 where id=$2", [engineering, child]);
    expect((await db.query<{ parent_department_id: string }>("select parent_department_id from departments where id=$1", [child])).rows[0].parent_department_id).toBe(engineering);
  });
});

test("self, nesting, cycles, Legislative and access-only workspace parents are rejected", async () => {
  await as("superadmin", async () => {
    await expect(db.query("update departments set parent_department_id=id where id=$1", [treasury])).rejects.toThrow(/branch offices/);
    await expect(createDepartment("Nested child", "nested-child", market)).rejects.toThrow(/top-level/);
    await expect(db.query("update departments set parent_department_id=$1 where id=$2", [market, treasury])).rejects.toThrow(/top-level/);
    await expect(db.query("update departments set parent_department_id=$1 where id=$2", [engineering, treasury])).rejects.toThrow(/with branch offices/);
    await expect(createDepartment("Legislative child", "legislative-child", legislative)).rejects.toThrow(/top-level/);
    await expect(createDepartment("Access child", "access-child", affairs)).rejects.toThrow(/top-level/);
    await expect(db.query("update departments set parent_department_id=$1 where id=$2", [treasury, affairs])).rejects.toThrow(/ordinary Executive/);
    await expect(db.query("insert into departments(name,short_name,slug,department,published,sort_order,parent_department_id) values('Leg child','','leg-child','legislative',false,0,$1)", [treasury])).rejects.toThrow(/ordinary Executive/);
    await expect(db.query("delete from departments where id=$1", [market])).rejects.toMatchObject({ code: "42501" });
  });
});

test("anonymous public reads require both child and parent visibility without recursive RLS", async () => {
  await as("anon", async () => {
    expect(await visible(slaughter)).toBe(true);
    expect(await visible(waterworks)).toBe(true);
    expect(await visible(market)).toBe(false);
    expect((await db.query("select id from departments where id=$1", [slaughter])).rows).toHaveLength(1);
    expect((await db.query("select id from departments where id=$1", [market])).rows).toHaveLength(0);
  });
  for (const state of ["active=false", "published=false", "archived_at=now()"] as const) {
    await db.exec("begin");
    await as("superadmin", async () => { await db.query(`update departments set ${state} where id=$1`, [treasury]); });
    await as("anon", async () => {
      expect(await visible(slaughter)).toBe(false);
      expect(await visible(waterworks)).toBe(true);
      expect((await db.query("select id from departments where id=$1", [slaughter])).rows).toHaveLength(0);
    });
    await as("superadmin", async () => {
      expect(await visible(slaughter)).toBe(false);
      expect((await db.query("select id from departments where id=$1", [slaughter])).rows).toHaveLength(1);
    });
    await db.exec("rollback");
  }
});

test("parent archival preserves links and branch editing but blocks newly assigned archived parents", async () => {
  await as("superadmin", async () => { await db.query("update departments set active=false,archived_at=now() where id=$1", [treasury]); });
  await as("editor", async () => {
    expect((await db.query("update departments set description='Still editable branch' where id=$1 returning id", [market])).rows).toHaveLength(1);
    expect((await db.query<{ parent_department_id: string }>("select parent_department_id from departments where id=$1", [market])).rows[0].parent_department_id).toBe(treasury);
  });
  await as("superadmin", async () => {
    await expect(createDepartment("Archived parent child", "archived-parent-child", treasury)).rejects.toThrow(/top-level/);
  });
  await as("superadmin", async () => { await db.query("update departments set active=true,archived_at=null where id=$1", [treasury]); });
});

test("aliases, contacts and public source links follow parent visibility while general articles stay published", async () => {
  await as("superadmin", async () => {
    await db.query("update departments set slug='slaughter-services' where id=$1", [slaughter]);
    await db.query("insert into department_contacts(office_id,type,value,published,sort_order) values($1,'PHONE','123456',true,1)", [slaughter]);
    await db.query(`insert into news(slug,title,category,date,excerpt,image,content,office_id,content_scope,published,sort_order)
      values('slaughter-news','Branch news','News','2026-11-24','Excerpt','/images/department-placeholder.svg',array['Body'],$1,'executive',true,1)`, [slaughter]);
    await db.query(`insert into programs(id,slug,name,description,category,status,office_id,content_scope,published,sort_order)
      values('slaughter-program','slaughter-program','Branch program','Description','Community','Active',$1,'executive',true,1)`, [slaughter]);
  });
  await as("anon", async () => {
    expect((await db.query("select department_id from department_slug_aliases where slug='slaughter-house'")).rows).toHaveLength(1);
    expect((await db.query("select value from department_contacts where office_id=$1", [slaughter])).rows).toHaveLength(1);
    expect((await db.query<{ source: { slug: string } }>("select source from published_news where slug='slaughter-news'")).rows[0].source.slug).toBe("slaughter-services");
    expect((await db.query<{ source: { slug: string } }>("select source from published_programs where slug='slaughter-program'")).rows[0].source.slug).toBe("slaughter-services");
  });
  await db.exec("begin");
  await as("superadmin", async () => { await db.query("update departments set active=false where id=$1", [treasury]); });
  await as("anon", async () => {
    expect((await db.query("select department_id from department_slug_aliases where slug='slaughter-house'")).rows).toHaveLength(0);
    expect((await db.query("select value from department_contacts where office_id=$1", [slaughter])).rows).toHaveLength(0);
    const articles = (await db.query<{ source: { slug: string | null } }>("select source from published_news where slug='slaughter-news'")).rows;
    expect(articles).toHaveLength(1);
    expect(articles[0].source.slug).toBeNull();
    expect((await db.query<{ source: { slug: string | null } }>("select source from published_programs where slug='slaughter-program'")).rows[0].source.slug).toBeNull();
  });
  await db.exec("rollback");
});

test("explicit assignment revocation denies branch writes without changing parent access", async () => {
  await as("superadmin", async () => { await manage("editor", null); });
  await as("editor", async () => {
    expect((await db.query("update departments set body='Revoked write' where id=$1 returning id", [market])).rows).toHaveLength(0);
  });
  await as("parent", async () => {
    expect((await db.query("update departments set description='Parent remains assigned' where id=$1 returning id", [treasury])).rows).toHaveLength(1);
  });
});

test("ordinary Legislative contact publication keeps its pre-branch policy behavior", async () => {
  await db.exec("begin");
  await as("superadmin", async () => {
    await manage("other", legislative);
    const status = (await db.query<{ published: boolean }>("select published from departments where id=$1", [legislative])).rows[0];
    if (!status.published) {
      const next = (await db.query<{ position: number }>("select count(*)::integer+1 position from departments where department='legislative' and published")).rows[0].position;
      await db.query("update departments set published=true,sort_order=$1 where id=$2", [next, legislative]);
    }
    await db.query("insert into department_contacts(office_id,content_scope,type,value,published,sort_order) values($1,'legislative','PHONE','LEGACY-CONTACT',true,1)", [legislative]);
  });
  // Isolate the unchanged top-level public predicate from the separate staff
  // read policy; roll the test-only policy change back with the whole scenario.
  await db.exec("alter policy contacts_read on department_contacts using(false)");
  await as("other", async () => {
    expect((await db.query("select value from department_contacts where office_id=$1 and value='LEGACY-CONTACT'", [legislative])).rows).toHaveLength(1);
  });
  await db.exec("rollback");
});
