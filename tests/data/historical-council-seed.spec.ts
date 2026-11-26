import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

test.describe.configure({ mode: "serial" });
const importPath = "supabase/imports/20261126_historical_council_officials.sql";
const lastMigration = "202611260036_committees_published.sql";
const user = "00000000-0000-4000-8000-000000000001";
const termId = (year: number) =>
  `10000000-0000-4000-8000-${year.toString().padStart(12, "0")}`;
const termCounts = [
  [1982, 1986, 12],
  [1986, 1989, 11],
  [1989, 1992, 10],
  [1992, 1995, 10],
  [1995, 1998, 11],
  [1998, 2001, 11],
  [2001, 2004, 11],
  [2004, 2007, 11],
  [2007, 2010, 11],
  [2010, 2013, 11],
  [2013, 2016, 10],
  [2016, 2019, 10],
  [2019, 2022, 11],
  [2022, 2025, 11],
  [2025, 2028, 11],
] as const;
const existing = [
  ["1", "Hon. Julius Erwin Alpas", 2025, "SANGGUNIANG_BAYAN"],
  ["members", "Hon. Marvin M. Miralles", 2025, "SANGGUNIANG_BAYAN"],
  ["committees", "Hon. Richard M. Canillo", 2025, "SANGGUNIANG_BAYAN"],
  ["secretariat", "Hon. Annette J. Navarro", 2025, "SANGGUNIANG_BAYAN"],
  [
    "current-vice",
    "Hon. Ana Jessica A. Baricuatro",
    2025,
    "MUNICIPAL_VICE_MAYOR",
  ],
  ["jesus", "Hon. Jesus M. Managaytay", 2025, "SANGGUNIANG_BAYAN"],
  ["joey", "Hon. Joey D. Indino", 2025, "SANGGUNIANG_BAYAN"],
  ["jose", "Hon. Jose A. Alqueza", 2025, "SANGGUNIANG_BAYAN"],
  ["marmie", "Hon. Marmie Jeanne B. Albillar", 2025, "SANGGUNIANG_BAYAN"],
  ["maria", "Hon. Maria Elena C. Limocon", 2025, "SANGGUNIANG_BAYAN"],
  ["lorenzo", "Hon. Lorenzo P. Niñal", 2025, "SANGGUNIANG_BAYAN"],
  ["past-vice", "GLENN F. BARICUATRO", 2022, "MUNICIPAL_VICE_MAYOR"],
  ["past-marcelo", "MARCELO T. GERONGCO", 2022, "SANGGUNIANG_BAYAN"],
] as const;
type JsonRow = { id: string; row: Record<string, unknown> };
let db: PGlite;
let office: string;
let initial: JsonRow[];
let unrelated: Record<string, unknown>;
let initialTerms: JsonRow[];
let guards: unknown[];

function seedSql() {
  return readFileSync(importPath, "utf8");
}
async function asStaff<T>(run: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  try {
    return await run();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
  }
}
async function rows(table: string): Promise<JsonRow[]> {
  return (
    await db.query<JsonRow>(
      `select id::text id,to_jsonb(r) row from ${table} r order by id`,
    )
  ).rows;
}
async function triggerSnapshot() {
  return (
    await db.query(
      "select tgrelid::regclass::text relation,tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid in ('public.officials'::regclass,'public.legislative_terms'::regclass,'public.committees'::regclass) order by relation,tgname",
    )
  ).rows;
}
async function otherSnapshot() {
  const snapshot: Record<string, unknown> = {};
  for (const table of [
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
    snapshot[table] = (
      await db.query(
        `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
      )
    ).rows;
  snapshot.policies = (
    await db.query(
      "select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname",
    )
  ).rows;
  return snapshot;
}
async function auditSnapshot() {
  return (await db.query("select * from audit_logs order by id")).rows;
}
async function assertOriginalState() {
  expect(await rows("officials")).toEqual(initial);
  expect(await rows("legislative_terms")).toEqual(initialTerms);
  expect(await otherSnapshot()).toEqual(unrelated);
  expect(await triggerSnapshot()).toEqual(guards);
}
async function attemptInRollback(
  change: () => Promise<unknown>,
  error?: RegExp,
) {
  const officials = await rows("officials");
  const terms = await rows("legislative_terms");
  const committees = await rows("committees");
  const audit = await auditSnapshot();
  await db.exec("begin");
  await change();
  await expect(db.exec(seedSql())).rejects.toThrow(error);
  await db.exec("rollback");
  expect(await rows("officials")).toEqual(officials);
  expect(await rows("legislative_terms")).toEqual(terms);
  expect(await rows("committees")).toEqual(committees);
  expect(await auditSnapshot()).toEqual(audit);
  expect(await triggerSnapshot()).toEqual(guards);
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
    .filter((f) => f.endsWith(".sql") && f <= lastMigration)
    .sort()) {
    if (file === "202609300002_media.sql") continue;
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file === "202610010005_legislative_modules.sql")
      await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    if (file === "202611130018_transparency_access.sql") {
      office = (
        await db.query<{ id: string }>(
          "select id from departments where department='legislative' and active and archived_at is null",
        )
      ).rows[0].id;
      await db.query(
        "insert into auth.users values($1,'historical-seed@test.local')",
        [user],
      );
      await db.query(
        "update staff_accounts set role='superadmin',active=true where user_id=$1",
        [user],
      );
      await asStaff(async () => {
        const samples = (
          await db.query<{ id: string }>(
            "select id from officials where content_scope='legislative' order by sort_order desc",
          )
        ).rows;
        for (const { id } of samples)
          await db.query("delete from officials where id=$1", [id]);
      });
    }
    if (file === "202611160019_legislative_terms.sql")
      await asStaff(async () => {
        for (const [start, end] of termCounts.slice(1))
          await db.query(
            "insert into legislative_terms(id,name,start_date,end_date) values($1,$2,$3,$4)",
            [
              termId(start),
              `Saved term ${start}`,
              `${start}-07-01`,
              `${end}-06-30`,
            ],
          );
      });
  }
  await asStaff(async () => {
    for (const [id, name, year, legislativeRole] of existing)
      await db.query(
        `insert into officials(id,name,role,branch,description,photo_url,content_scope,office_id,term_id,legislative_role,published,sort_order)
        values($1,$2,$3,'legislative',$4,$5,'legislative',$6,$7,$8,true,$9)`,
        [
          id,
          name,
          legislativeRole === "MUNICIPAL_VICE_MAYOR"
            ? "Municipal Vice-Mayor"
            : "Sangguniang Bayan",
          `Preserved original biography for ${id}`,
          `https://example.test/preserved/${id}.webp`,
          office,
          termId(year),
          legislativeRole,
          existing.findIndex((r) => r[0] === id) + 1,
        ],
      );
    await db.query(
      "update sessions set office_id=$1,sort_order=1,term_id=$2 where id='61st-regular'",
      [office, termId(2025)],
    );
    const finance = (
      await db.query<{ id: string }>(
        "select c.id from committees c join committee_master m on m.id=c.master_id where c.term_id=$1 and m.sort_order=1",
        [termId(2025)],
      )
    ).rows[0].id;
    await db.query(
      "update committees set chair_id='1',vice_chair_id='members' where id=$1",
      [finance],
    );
    await db.query(
      "update ordinances set date_approved='2026-09-28',year=2026,author_id='1',co_author_id='committees',committee_id=$1,session_id='61st-regular',office_id=$2,sort_order=1 where id='water-safety'",
      [finance, office],
    );
    await db.query(
      "update resolutions set date_approved='2026-09-28',year=2026,author_id='members',co_author_id='secretariat',committee_id=$1,session_id='61st-regular',office_id=$2,sort_order=1 where id='health-outreach'",
      [finance, office],
    );
  });
  initial = await rows("officials");
  initialTerms = await rows("legislative_terms");
  unrelated = await otherSnapshot();
  guards = await triggerSnapshot();
});
test.afterAll(async () => await db.close());

test("requires exact existing July-to-June term boundaries and preserves all records on failure", async () => {
  await attemptInRollback(async () => {
    await db.query(
      "update legislative_terms set start_date='1986-07-02' where id=$1",
      [termId(1986)],
    );
  });
  await assertOriginalState();
});

test("rejects a disabled ordering guard, incompatible roles, duplicate matches and unassigned identity candidates atomically", async () => {
  await attemptInRollback(async () => {
    await db.exec("alter table officials disable trigger z_reorder");
  });
  await attemptInRollback(async () => {
    await db.exec(
      "alter table officials disable trigger assign_legislative_term",
    );
  });
  await attemptInRollback(async () => {
    await db.exec(
      "alter table legislative_terms disable trigger create_term_committees",
    );
  });
  await attemptInRollback(async () => {
    await asStaff(async () => {
      await db.query(
        "update officials set legislative_role='SANGGUNIANG_BAYAN' where id='past-vice'",
      );
    });
  });
  await attemptInRollback(async () => {
    await asStaff(async () => {
      await db.query(
        `insert into officials(id,name,role,branch,description,content_scope,office_id,term_id,legislative_role,published,sort_order)
        values('duplicate-glenn','Hon. Glenn F. Baricuatro','Sangguniang Bayan','legislative','','legislative',$1,$2,'MUNICIPAL_VICE_MAYOR',false,0)`,
        [office, termId(2022)],
      );
    });
  });
  await attemptInRollback(async () => {
    await db.exec(
      "alter table officials disable trigger assign_legislative_term",
    );
    await asStaff(async () => {
      await db.query(
        `insert into officials(id,name,role,branch,description,content_scope,office_id,term_id,legislative_role,published,sort_order)
        values('unassigned-ygay','Hon. Apolonio M. Ygay Sr.','Municipal Vice-Mayor','legislative','','legislative',$1,null,'MUNICIPAL_VICE_MAYOR',false,0)`,
        [office],
      );
    });
    await db.exec(
      "set constraints all immediate;alter table officials enable trigger assign_legislative_term",
    );
  });
  await attemptInRollback(async () => {
    await asStaff(async () => {
      await db.query(
        `insert into officials(id,name,role,branch,description,content_scope,office_id,term_id,legislative_role,published,sort_order)
        values('unexpected-vice','Existing different Vice-Mayor','Municipal Vice-Mayor','legislative','','legislative',$1,$2,'MUNICIPAL_VICE_MAYOR',false,0)`,
        [office, termId(1986)],
      );
    });
  }, /A different Vice-Mayor already exists/);
  await assertOriginalState();
});

test("an insert failure rolls back partial roster work, the new term, its generated committees and audit writes", async () => {
  await attemptInRollback(async () => {
    await db.exec(`create function public.test_historical_seed_failure() returns trigger language plpgsql as $$
      begin if new.name='Hon. Dulce Yap' then raise exception 'Injected historical roster failure';end if;return new;end$$;
      create trigger x_test_historical_seed_failure before insert on officials for each row execute function public.test_historical_seed_failure();`);
  }, /Injected historical roster failure/);
  await assertOriginalState();
});

test("publishes 149 missing term-specific council records, reuses all 13 officials and preserves linked content and photos", async () => {
  const originalCommittees = await rows("committees");
  await db.exec(seedSql());
  const after = await rows("officials");
  const legislative = after.filter(
    (r) => r.row.content_scope === "legislative",
  );
  expect(legislative).toHaveLength(162);
  for (const prior of initial)
    expect(after.find((r) => r.id === prior.id)).toEqual(prior);
  expect(await otherSnapshot()).toEqual(unrelated);
  expect(await triggerSnapshot()).toEqual(guards);
  for (const [start, end, expected] of termCounts) {
    const term = (
      await db.query<{ id: string }>(
        "select id from legislative_terms where start_date=$1 and end_date=$2",
        [`${start}-07-01`, `${end}-06-30`],
      )
    ).rows[0];
    expect(legislative.filter((r) => r.row.term_id === term.id)).toHaveLength(
      expected,
    );
  }
  for (const prior of initialTerms)
    expect(
      (await rows("legislative_terms")).find((r) => r.id === prior.id),
    ).toEqual(prior);
  const createdTerm = (
    await db.query<{ id: string; name: string }>(
      "select id,name from legislative_terms where start_date='1982-07-01' and end_date='1986-06-30'",
    )
  ).rows[0];
  expect(createdTerm.name).toBe("1982–1986");
  expect(
    (
      await db.query(
        "select id from committees where term_id=$1 and published",
        [createdTerm.id],
      )
    ).rows,
  ).toHaveLength(25);
  for (const prior of originalCommittees)
    expect((await rows("committees")).find((r) => r.id === prior.id)).toEqual(
      prior,
    );
  const added = legislative.filter(
    (r) => !existing.some(([id]) => id === r.id),
  );
  expect(added).toHaveLength(149);
  expect(
    added.every(
      (r) =>
        r.row.published &&
        r.row.photo_url === null &&
        !r.row.is_sample &&
        r.row.office_id === office,
    ),
  ).toBe(true);
  expect(
    added.map((r) => Number(r.row.sort_order)).sort((a, b) => a - b),
  ).toEqual(Array.from({ length: 149 }, (_, i) => existing.length + i + 1));
  expect(
    legislative.some((r) => String(r.row.name).includes("Manolo P. Cerna")),
  ).toBe(false);
  expect(
    legislative.filter(
      (r) => r.row.legislative_role === "MUNICIPAL_VICE_MAYOR",
    ),
  ).toHaveLength(14);
  expect(
    legislative.filter((r) => r.row.legislative_role === "SANGGUNIANG_BAYAN"),
  ).toHaveLength(148);
  await db.exec("set role anon");
  try {
    expect(
      (
        await db.query(
          "select id from officials where content_scope='legislative'",
        )
      ).rows,
    ).toHaveLength(162);
  } finally {
    await db.exec("reset role");
  }
});

test("keeps ABC and SK presidents as SB members, retains partial-service notes and creates separate records across terms", async () => {
  const abc = (
    await db.query<{ name: string; legislative_role: string }>(
      "select name,legislative_role from officials where description='Liga ng mga Barangay / ABC President' order by name",
    )
  ).rows;
  const sk = (
    await db.query<{ name: string; legislative_role: string }>(
      "select name,legislative_role from officials where description='SKF President / Ex-Officio Member' order by name",
    )
  ).rows;
  // Current presidents already have saved biographies, which the import must retain.
  expect(abc).toHaveLength(12);
  expect(sk).toHaveLength(9);
  expect(
    [...abc, ...sk].every((r) => r.legislative_role === "SANGGUNIANG_BAYAN"),
  ).toBe(true);
  expect(
    (
      await db.query(
        "select name from officials where description='Service period listed: 1986-1987.' order by name",
      )
    ).rows,
  ).toEqual([{ name: "Hon. Dulce Yap" }, { name: "Hon. Mario Gaviola" }]);
  expect(
    (await db.query("select name from officials where name like '%Moñasque%'"))
      .rows,
  ).toEqual([{ name: "Hon. Juanito Moñasque" }]);
  const repeating = (
    await db.query<{ id: string; term_id: string }>(
      "select id,term_id from officials where name='Hon. Francisco L. Bellones' order by term_id",
    )
  ).rows;
  expect(repeating).toHaveLength(9);
  expect(new Set(repeating.map((r) => r.id)).size).toBe(9);
  expect(new Set(repeating.map((r) => r.term_id)).size).toBe(9);
  expect(
    (
      await db.query(
        "select name from officials where term_id=$1 and name like '%Jul%Alpas%'",
        [termId(2025)],
      )
    ).rows,
  ).toEqual([{ name: "Hon. Julius Erwin Alpas" }]);
});

test("rerunning is a no-op for identities, timestamps, order, terms, compositions, references and audit history", async () => {
  const officials = await rows("officials");
  const terms = await rows("legislative_terms");
  const committees = await rows("committees");
  const audit = await auditSnapshot();
  await db.exec(seedSql());
  expect(await rows("officials")).toEqual(officials);
  expect(await rows("legislative_terms")).toEqual(terms);
  expect(await rows("committees")).toEqual(committees);
  expect(await otherSnapshot()).toEqual(unrelated);
  expect(await auditSnapshot()).toEqual(audit);
  expect(await triggerSnapshot()).toEqual(guards);
});
