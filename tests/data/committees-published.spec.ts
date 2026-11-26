import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

test.describe.configure({ mode: "serial" });
const migration = "202611260036_committees_published.sql";
const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
const current = "10000000-0000-4000-8000-000000000001";
const past = "10000000-0000-4000-8000-000000000002";
const future = "10000000-0000-4000-8000-000000000003";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  legislative: "00000000-0000-4000-8000-000000000002",
  executive: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
type RecordRow = { id: string; row: Record<string, unknown> };
let db: PGlite;
let offices: Record<string, string>;
let original: RecordRow[];
let preserved: Record<string, unknown>;
let master: string;
let chair: string;

async function as<T>(user: keyof typeof users | "anon", run: () => Promise<T>) {
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
async function committees() {
  return (
    await db.query<RecordRow>(
      "select id,to_jsonb(c) row from committees c order by id",
    )
  ).rows;
}
async function position() {
  return (
    await db.query<{ position: number }>(
      "select coalesce(max(sort_order),0)+1 position from committees where published and content_scope='legislative' and office_id=$1",
      [offices["legislative-access"]],
    )
  ).rows[0].position;
}
async function policySnapshot() {
  return (
    await db.query(
      "select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname",
    )
  ).rows;
}
async function triggerSnapshot() {
  return (
    await db.query(
      "select tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.committees'::regclass order by tgname",
    )
  ).rows;
}
async function unrelated() {
  const rows: Record<string, unknown> = {};
  for (const table of [
    "officials",
    "ordinances",
    "resolutions",
    "sessions",
    "municipal_documents",
    "departments",
    "staff_accounts",
    "user_office_access",
    "committee_master",
    "storage.objects",
  ])
    rows[table] = (
      await db.query(
        `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
      )
    ).rows;
  rows.policies = await policySnapshot();
  return rows;
}
async function insertTerm(
  id: string,
  name = "18th",
  start = "2028-07-01",
  end = "2031-06-30",
) {
  return db.query(
    "insert into legislative_terms(id,name,start_date,end_date) values($1,$2,$3,$4)",
    [id, name, start, end],
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
    if (file === "202611130018_transparency_access.sql") {
      offices = Object.fromEntries(
        (
          await db.query<{ id: string; slug: string }>(
            "select id,slug from departments union all select department_id id,slug from department_slug_aliases",
          )
        ).rows.map((r) => [r.slug, r.id]),
      );
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
        for (const [user, office, role, level] of [
          ["legislative", "legislative-access", "admin", "manager"],
          ["executive", "municipal-health", "admin", "manager"],
          ["viewer", "legislative-access", "viewer", "viewer"],
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
          `insert into committees(id,name,responsibility,chair,content_scope,office_id,published,sort_order)
          values('legacy-unassigned-draft','Preserved unassigned history','Retained legacy description','Retained legacy chair','legislative',$1,false,0)`,
          [offices["legislative-access"]],
        );
      });
    }
    if (file === "202611160019_legislative_terms.sql")
      await as("superadmin", async () => {
        await insertTerm(current, "17th", "2025-07-01", "2028-06-30");
        await insertTerm(past, "16th", "2022-07-01", "2025-06-30");
        await db.query(
          "update officials set term_id=$1 where content_scope='legislative'",
          [current],
        );
        chair = (
          await db.query<{ id: string }>(
            "select id from officials where content_scope='legislative' order by id limit 1",
          )
        ).rows[0].id;
        await db.query(
          "update committees set name='Committee on Finance, Budget and Appropriation',term_id=$1,chair_id=$2 where id='finance'",
          [current, chair],
        );
        await db.query(
          `insert into committees(id,name,responsibility,chair,content_scope,office_id,term_id,chair_id,published,sort_order)
        values('health-draft','Committee on Health and Sanitation','Preserved health responsibility','Preserved health chair','legislative',$1,$2,$3,false,0),
        ('unlinked-term-history','Preserved special historical committee','Retained special responsibility','','legislative',$1,$2,null,false,0)`,
          [offices["legislative-access"], current, chair],
        );
        await db.query(
          "update ordinances set date_approved='2026-11-18',year=2026,author_id=$1,committee_id='finance' where id=(select id from ordinances order by id limit 1)",
          [chair],
        );
      });
    if (file === "202611180020_committee_master.sql")
      await as("superadmin", async () => {
        master = (
          await db.query<{ master_id: string }>(
            "select master_id from committees where id='finance'",
          )
        ).rows[0].master_id;
        await db.query(
          `insert into committees(id,name,responsibility,chair,content_scope,office_id,term_id,master_id,published,sort_order)
        values('past-finance-draft','Ignored input','Preserved past finance responsibility','Retained historical chair','legislative',$1,$2,$3,false,0)`,
          [offices["legislative-access"], past, master],
        );
        await db.query(
          "update committee_master set name='Finance master renamed after existing snapshots' where id=$1",
          [master],
        );
      });
  }
  original = await committees();
  preserved = await unrelated();
});
test.afterAll(async () => await db.close());

test("unexpected trigger states and matching unlinked histories abort without publishing or duplicating", async () => {
  await db.exec(
    "alter table committees disable trigger assign_legislative_term",
  );
  const disabled = await triggerSnapshot();
  await expect(db.exec(sql)).rejects.toThrow(
    "Unexpected committee ordering, term or master trigger state",
  );
  await db.exec("rollback");
  expect(await committees()).toEqual(original);
  expect(await triggerSnapshot()).toEqual(disabled);
  await db.exec(
    "alter table committees enable trigger assign_legislative_term",
  );
  await db.exec(
    "begin;alter table committees disable trigger committee_master_guard",
  );
  await as("superadmin", async () => {
    await db.query(
      `insert into committees(id,name,responsibility,chair,content_scope,office_id,term_id,published,sort_order)
      values('collision','  Committee  ON   Education  ','Retain me','','legislative',$1,$2,false,0)`,
      [offices["legislative-access"], past],
    );
  });
  await db.exec(
    "set constraints all immediate;alter table committees enable trigger committee_master_guard",
  );
  await expect(db.exec(sql)).rejects.toThrow(
    "An unlinked historical committee matches a Master Committee",
  );
  await db.exec("rollback");
  expect(await committees()).toEqual(original);
  expect(await unrelated()).toEqual(preserved);
});

test("a preservation failure restores publication, audit records, schema and temporary guards", async () => {
  await db.exec(`create function public.test_committee_rewrite() returns trigger language plpgsql as $$
    begin if new.id='health-draft' and new.published then new.responsibility='Unexpected rewrite';end if;return new;end$$;
    create trigger x_test_committee_rewrite before update on committees for each row execute function test_committee_rewrite();`);
  const guards = await triggerSnapshot();
  const audit = (await db.query("select * from audit_logs order by id")).rows;
  await expect(db.exec(sql)).rejects.toThrow(
    "Committee publication preservation check failed",
  );
  await db.exec("rollback");
  expect(await committees()).toEqual(original);
  expect(await triggerSnapshot()).toEqual(guards);
  expect((await db.query("select * from audit_logs order by id")).rows).toEqual(
    audit,
  );
  expect(
    (
      await db.query(
        "select conname from pg_constraint where conname='committees_always_published'",
      )
    ).rows,
  ).toEqual([]);
  await db.exec(
    "drop trigger x_test_committee_rewrite on committees;drop function test_committee_rewrite()",
  );
});

test("publishes drafts and fills every term from the catalog while preserving identities, historical snapshots, roles and linked documents", async () => {
  const guards = await triggerSnapshot();
  await db.exec(sql);
  const after = await committees();
  for (const before of original) {
    const row = after.find((r) => r.id === before.id)!.row;
    expect(row.published).toBe(true);
    for (const [key, value] of Object.entries(before.row))
      if (!["published", "sort_order", "updated_at"].includes(key))
        expect(row[key]).toEqual(value);
    if (before.row.published) expect(row).toEqual(before.row);
  }
  expect(
    after.find((r) => r.id === "legacy-unassigned-draft")!.row,
  ).toMatchObject({ master_id: null, term_id: null, published: true });
  const maxPrior = Math.max(
    ...original
      .filter((r) => r.row.published)
      .map((r) => Number(r.row.sort_order)),
  );
  const drafts = original.filter((r) => !r.row.published).map((r) => r.id);
  expect(
    after
      .filter((r) => drafts.includes(r.id))
      .map((r) => Number(r.row.sort_order))
      .sort((a, b) => a - b),
  ).toEqual(Array.from({ length: drafts.length }, (_, i) => maxPrior + i + 1));
  expect(
    (
      await db.query(
        "select term_id,count(*)::integer total from committees where master_id is not null and term_id is not null group by term_id order by term_id",
      )
    ).rows,
  ).toEqual([
    { term_id: current, total: 25 },
    { term_id: past, total: 25 },
  ]);
  const added = after.filter(
    (r) => !original.some((prior) => prior.id === r.id),
  );
  expect(added).toHaveLength(47);
  for (const { row } of added)
    expect(row).toMatchObject({
      published: true,
      office_id: offices["legislative-access"],
      content_scope: "legislative",
      responsibility: "",
      chair: "",
      chair_id: null,
      vice_chair_id: null,
      member_1_id: null,
      member_2_id: null,
      member_3_id: null,
      member_4_id: null,
    });
  expect(await triggerSnapshot()).toEqual(guards);
  expect(await unrelated()).toEqual(preserved);
  expect(
    (
      await db.query(
        "select column_default from information_schema.columns where table_schema='public' and table_name='committees' and column_name='published'",
      )
    ).rows,
  ).toEqual([{ column_default: "true" }]);
  await as("anon", async () => {
    expect((await db.query("select id from committees")).rows).toHaveLength(
      after.length,
    );
  });
});

test("new terms atomically receive published catalog snapshots without copying any officials and edits never reseed", async () => {
  const before = await committees();
  const priorMax = await position();
  const officialRows = (
    await db.query("select to_jsonb(o) row from officials o order by id")
  ).rows;
  await as("superadmin", async () => {
    await insertTerm(future);
  });
  const created = (
    await db.query<RecordRow>(
      "select id,to_jsonb(c) row from committees c where term_id=$1 order by sort_order",
      [future],
    )
  ).rows;
  expect(created).toHaveLength(25);
  expect(created.map((r) => r.row.sort_order)).toEqual(
    Array.from({ length: 25 }, (_, i) => priorMax + i),
  );
  expect(created[0].row.name).toBe(
    "Finance master renamed after existing snapshots",
  );
  for (const { row } of created)
    expect(row).toMatchObject({
      published: true,
      office_id: offices["legislative-access"],
      content_scope: "legislative",
      created_by: users.superadmin,
      responsibility: "",
      chair: "",
      chair_id: null,
      vice_chair_id: null,
      member_1_id: null,
      member_2_id: null,
      member_3_id: null,
      member_4_id: null,
    });
  for (const prior of before)
    expect((await committees()).find((r) => r.id === prior.id)).toEqual(prior);
  expect(
    (await db.query("select to_jsonb(o) row from officials o order by id"))
      .rows,
  ).toEqual(officialRows);
  await as("superadmin", async () => {
    await db.query(
      "update legislative_terms set name='18th renamed',end_date='2031-06-29' where id=$1",
      [future],
    );
    await db.query(
      "update committee_master set name='Finance renamed again',sort_order=35 where id=$1",
      [master],
    );
  });
  expect(
    (
      await db.query<RecordRow>(
        "select id,to_jsonb(c) row from committees c where term_id=$1 order by sort_order",
        [future],
      )
    ).rows,
  ).toEqual(created);
  expect(
    (
      await db.query<{ name: string }>(
        "select name from committees where id='finance'",
      )
    ).rows[0].name,
  ).toBe("Committee on Finance, Budget and Appropriation");
  // SQL Editor creation is also a supported database-admin operation without a staff JWT.
  await insertTerm(
    "10000000-0000-4000-8000-000000000004",
    "19th",
    "2031-07-01",
    "2034-06-30",
  );
  expect(
    (
      await db.query(
        "select id from committees where term_id='10000000-0000-4000-8000-000000000004' and published",
      )
    ).rows,
  ).toHaveLength(25);
});

test("new master committees propagate once to every existing term; updates and explicit transactions preserve existing compositions", async () => {
  const before = await committees();
  let addedMaster = "";
  await as("superadmin", async () => {
    addedMaster = (
      await db.query<{ id: string }>(
        "insert into committee_master(name,sort_order) values('New editable master',26) returning id",
      )
    ).rows[0].id;
  });
  const created = (
    await db.query<RecordRow>(
      "select id,to_jsonb(c) row from committees c where master_id=$1 order by term_id",
      [addedMaster],
    )
  ).rows;
  expect(created).toHaveLength(4);
  expect(created.map((r) => r.row.term_id).sort()).toEqual(
    [current, past, future, "10000000-0000-4000-8000-000000000004"].sort(),
  );
  for (const { row } of created)
    expect(row).toMatchObject({
      name: "New editable master",
      published: true,
      chair_id: null,
      vice_chair_id: null,
    });
  await as("superadmin", async () => {
    await db.query(
      "update committee_master set name='Master name changed',sort_order=100 where id=$1",
      [addedMaster],
    );
  });
  expect(
    (
      await db.query<RecordRow>(
        "select id,to_jsonb(c) row from committees c where master_id=$1 order by term_id",
        [addedMaster],
      )
    ).rows,
  ).toEqual(created);
  for (const prior of before)
    expect((await committees()).find((r) => r.id === prior.id)).toEqual(prior);
  const baseline = await committees();
  await db.exec("begin");
  await as("superadmin", async () => {
    await db.query(
      "insert into committee_master(name) values('Rolled back master')",
    );
    await insertTerm(
      "10000000-0000-4000-8000-000000000005",
      "20th",
      "2034-07-01",
      "2037-06-30",
    );
  });
  expect((await committees()).length).toBeGreaterThan(baseline.length);
  await db.exec("rollback");
  expect(await committees()).toEqual(baseline);
  expect(
    (
      await db.query(
        "select id from committee_master where name='Rolled back master'",
      )
    ).rows,
  ).toEqual([]);
});

test("failed seeding rolls back its term/master and all partial composition work", async () => {
  const before = await committees();
  const audit = (await db.query("select * from audit_logs order by id")).rows;
  await db.exec(`create function public.test_committee_insert_failure() returns trigger language plpgsql as $$
    begin if new.name='Committee on Agriculture' and new.term_id='10000000-0000-4000-8000-000000000006' then raise exception 'Injected seed failure';end if;return new;end$$;
    create trigger x_test_committee_insert_failure before insert on committees for each row execute function test_committee_insert_failure();`);
  await as("superadmin", async () => {
    await expect(
      insertTerm(
        "10000000-0000-4000-8000-000000000006",
        "20th failure",
        "2034-07-01",
        "2037-06-30",
      ),
    ).rejects.toThrow("Injected seed failure");
  });
  expect(await committees()).toEqual(before);
  expect(
    (
      await db.query(
        "select id from legislative_terms where id='10000000-0000-4000-8000-000000000006'",
      )
    ).rows,
  ).toEqual([]);
  expect((await db.query("select * from audit_logs order by id")).rows).toEqual(
    audit,
  );
  await db.exec(
    "drop trigger x_test_committee_insert_failure on committees;drop function test_committee_insert_failure()",
  );
  await as("superadmin", async () => {
    await expect(
      db.query(
        "insert into committee_master(name) values('  Preserved   SPECIAL historical committee  ')",
      ),
    ).rejects.toThrow("An unlinked historical committee matches");
  });
  expect(await committees()).toEqual(before);
  expect(
    (
      await db.query(
        "select id from committee_master where name like '%SPECIAL%'",
      )
    ).rows,
  ).toEqual([]);
  await as("superadmin", async () => {
    await db.query("update departments set active=false where id=$1", [
      offices["legislative-access"],
    ]);
    await expect(
      insertTerm(
        "10000000-0000-4000-8000-000000000006",
        "20th unavailable",
        "2034-07-01",
        "2037-06-30",
      ),
    ).rejects.toThrow("An active Legislative Access office is required");
    await db.query("update departments set active=true where id=$1", [
      offices["legislative-access"],
    ]);
  });
  expect(await committees()).toEqual(before);
});

test("always-published constraint and existing term, master, position and reference guards remain enforced", async () => {
  await as("legislative", async () => {
    await expect(
      db.query(
        "update committees set published=false,sort_order=0 where id='finance'",
      ),
    ).rejects.toThrow("committees_always_published");
    await expect(
      db.query(
        "update committees set name='Rewrite history' where id='finance'",
      ),
    ).rejects.toThrow("Historical committee names");
    await expect(
      db.query("update committees set master_id=null where id='finance'"),
    ).rejects.toThrow("retain its master identity");
    const otherTerm = (
      await db.query<{ id: string }>(
        "select id from committees where term_id=$1 and master_id=$2",
        [future, master],
      )
    ).rows[0].id;
    await expect(
      db.query("update committees set chair_id=$1 where id=$2", [
        chair,
        otherTerm,
      ]),
    ).rejects.toThrow("same Legislative Term");
    await expect(
      db.query("delete from committees where id='finance'"),
    ).rejects.toThrow("foreign key constraint");
    await db.query(
      "update committees set responsibility='Updated published composition' where id=$1",
      [otherTerm],
    );
    expect(
      (
        await db.query("select published from committees where id=$1", [
          otherTerm,
        ])
      ).rows,
    ).toEqual([{ published: true }]);
    await db.query("update committees set sort_order=1 where id=$1", [
      otherTerm,
    ]);
    expect(
      (
        await db.query(
          "select sort_order,published from committees where id=$1",
          [otherTerm],
        )
      ).rows,
    ).toEqual([{ sort_order: 1, published: true }]);
    await expect(
      db.query(
        `insert into committees(name,responsibility,chair,master_id,term_id,content_scope,office_id,published,sort_order)
      values('Duplicate','','',$1,$2,'legislative',$3,true,$4)`,
        [master, current, offices["legislative-access"], await position()],
      ),
    ).rejects.toThrow("unique");
  });
  // Temporarily remove an empty slot so its replacement can exercise INSERT's
  // default and draft constraint independently from the master/term unique key.
  const baseline = await committees();
  await db.exec("begin");
  await as("legislative", async () => {
    const id = (
      await db.query<{ id: string }>(
        "delete from committees where term_id=$1 and master_id=$2 returning id",
        [future, master],
      )
    ).rows[0].id;
    await db.exec("savepoint before_draft_attempt");
    await expect(
      db.query(
        `insert into committees(id,name,responsibility,chair,master_id,term_id,content_scope,office_id,published,sort_order)
      values($1,'Ignored','','',$2,$3,'legislative',$4,false,0)`,
        [id, master, future, offices["legislative-access"]],
      ),
    ).rejects.toThrow("committees_always_published");
    await db.exec("rollback to savepoint before_draft_attempt");
    expect(
      (
        await db.query(
          `insert into committees(id,name,responsibility,chair,master_id,term_id,content_scope,office_id,sort_order)
      values($1,'Ignored','','',$2,$3,'legislative',$4,$5) returning published`,
          [id, master, future, offices["legislative-access"], await position()],
        )
      ).rows,
    ).toEqual([{ published: true }]);
  });
  await db.exec("rollback");
  expect(await committees()).toEqual(baseline);
  expect(
    (
      await db.query(
        "select content_scope,office_id,sort_order,count(*) from committees where published group by content_scope,office_id,sort_order having count(*)>1",
      )
    ).rows,
  ).toEqual([]);
});

test("multi-row catalog and term inserts allocate unique positions and complete every pair exactly once", async () => {
  const before = await committees();
  await db.exec("begin");
  await as("superadmin", async () => {
    await db.query(`insert into legislative_terms(name,start_date,end_date) values
      ('Batch term one','2034-07-01','2037-06-30'),('Batch term two','2037-07-01','2040-06-30')`);
    await db.query(
      "insert into committee_master(name) values('Batch master one'),('Batch master two')",
    );
  });
  expect(
    (
      await db.query(`select t.id,m.id from legislative_terms t cross join committee_master m
    left join committees c on c.term_id=t.id and c.master_id=m.id
    where c.id is null or not c.published`)
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select master_id,term_id,count(*) from committees where master_id is not null and term_id is not null group by master_id,term_id having count(*)<>1",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select content_scope,office_id,sort_order,count(*) from committees where published group by content_scope,office_id,sort_order having count(*)>1",
      )
    ).rows,
  ).toEqual([]);
  await db.exec("set constraints all immediate;rollback");
  expect(await committees()).toEqual(before);
});

test("term/master creation remains Superadmin-only and published visibility grants no write or trigger-call access", async () => {
  const before = await committees();
  for (const user of ["legislative", "executive", "viewer", "anon"] as const)
    await as(user, async () => {
      await expect(
        insertTerm(
          "10000000-0000-4000-8000-000000000007",
          "Forbidden",
          "2034-07-01",
          "2037-06-30",
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "insert into committee_master(name) values('Forbidden master')",
        ),
      ).rejects.toThrow();
      await expect(
        db.query("select portal_create_committee_compositions()"),
      ).rejects.toThrow("permission denied");
      if (user !== "legislative") {
        const update = db.query(
          "update committees set responsibility='Forbidden change' where id='finance' returning id",
        );
        if (user === "anon")
          await expect(update).rejects.toThrow("permission denied");
        else expect((await update).rows).toEqual([]);
      }
    });
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.superadmin,
  ]);
  await as("superadmin", async () => {
    await expect(
      insertTerm(
        "10000000-0000-4000-8000-000000000007",
        "Revoked",
        "2034-07-01",
        "2037-06-30",
      ),
    ).rejects.toThrow();
    await expect(
      db.query("insert into committee_master(name) values('Revoked master')"),
    ).rejects.toThrow();
  });
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.superadmin,
  ]);
  expect(await committees()).toEqual(before);
  expect(await policySnapshot()).toEqual(preserved.policies);
});
