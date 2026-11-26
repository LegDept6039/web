import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

test.describe.configure({ mode: "serial" });
const importPath = "supabase/imports/20261126_legislative_documents_ready.sql";
const manifestPath =
  "supabase/imports/20261126_legislative_documents_ready_manifest.json";
const lastMigration = "202611260037_document_mass_motion.sql";
const user = "00000000-0000-4000-8000-000000000001";
const current = "10000000-0000-4000-8000-000000000017";
const past = "10000000-0000-4000-8000-000000000016";
const tables = ["ordinances", "resolutions"] as const;
type Table = (typeof tables)[number];
type JsonRow = { id: string; row: Record<string, unknown> };
type SourceRow = {
  sourceRow: number;
  sourceRows: number[];
  collection: Table;
  number: string;
  date: string;
  title: string;
  committee: string;
  author: string;
  coAuthor: string;
  approvalMode: string;
  summary: string;
  pdfUrl: null;
};
const officials = [
  "Hon. Richard M. Canillo",
  "Hon. Annette J. Navarro",
  "Hon. Julius Erwin Alpas",
  "Hon. Lorenzo P. Niñal",
  "Hon. Jose A. Alqueza",
  "Hon. Marvin M. Miralles",
  "Hon. Jesus M. Managaytay",
  "Hon. Maria Elena C. Limocon",
  "Hon. Joey D. Indino",
  "Hon. Marmie Jeanne B. Albillar",
];
let db: PGlite;
let office: string;
let source: SourceRow[];
let original: Record<Table, JsonRow[]>;
let preserved: Record<string, unknown>;
let originalGuards: unknown[];

function seedSql() {
  return readFileSync(importPath, "utf8");
}
function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/^hon\.?\s*/, "")
    .replace(/^atty\.?\s*/, "")
    .replaceAll("ñ", "n")
    .replace(/[.\s]+/g, "")
    .replace(/^juliuserwintalpas$/, "juliuserwinalpas");
}
function normalizeCommittee(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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
      "select tgrelid::regclass::text relation,tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal order by relation,tgname",
    )
  ).rows;
}
async function referenceSnapshot() {
  const snapshot: Record<string, unknown> = {};
  for (const table of [
    "officials",
    "committees",
    "committee_master",
    "sessions",
    "municipal_documents",
    "legislative_terms",
    "departments",
    "department_slug_aliases",
    "staff_accounts",
    "user_office_access",
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
async function auditRows() {
  return (
    await db.query<Record<string, unknown>>("select * from audit_logs order by id")
  ).rows;
}
async function snapshot() {
  return {
    ordinances: await rows("ordinances"),
    resolutions: await rows("resolutions"),
    references: await referenceSnapshot(),
    audit: await auditRows(),
    triggers: await triggerSnapshot(),
  };
}
async function expectSeedRollback(
  change: () => Promise<unknown>,
  message?: RegExp,
) {
  const before = await snapshot();
  await db.exec("begin");
  try {
    await change();
    await expect(db.exec(seedSql())).rejects.toThrow(message);
  } finally {
    await db.exec("rollback");
  }
  expect(await snapshot()).toEqual(before);
}
async function insertSession(id: string, date: string) {
  const next = (
    await db.query<{ position: number }>(
      "select coalesce(max(sort_order),0)+1 position from sessions where published and office_id=$1 and content_scope='legislative'",
      [office],
    )
  ).rows[0].position;
  return db.query(
    `insert into sessions(id,name,number,date,type,description,agenda,image,office_id,content_scope,sort_order)
     values($1,$2,$1,$3,'Regular session','Preserved test session',array[]::text[],
       '/images/department-placeholder.svg',$4,'legislative',$5)`,
    [id, `Test session ${date}`, date, office, next],
  );
}

test.beforeAll(async () => {
  source = JSON.parse(readFileSync(manifestPath, "utf8")).rows;
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
        "insert into auth.users values($1,'document-seed@test.local')",
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
        // Keep every seeded document and file reference while giving the
        // unrelated fictional samples identities outside the real workbook.
        for (const table of tables)
          await db.query(
            `update ${table} set number='fixture-preserved-'||number where true`,
          );
      });
    }
    if (file === "202611160019_legislative_terms.sql")
      await asStaff(async () => {
        await db.query(
          "insert into legislative_terms(id,name,start_date,end_date) values($1,'17th','2025-07-01','2028-06-30'),($2,'16th','2022-07-01','2025-06-30')",
          [current, past],
        );
      });
  }
  await asStaff(async () => {
    for (const [index, name] of officials.entries())
      await db.query(
        `insert into officials(id,name,role,description,photo_url,branch,legislative_role,office_id,content_scope,term_id,published,sort_order)
         values($1,$2,'Sangguniang Bayan',$3,$4,'legislative','SANGGUNIANG_BAYAN',$5,'legislative',$6,true,$7)`,
        [
          `fixture-sb-${index}`,
          name,
          `Preserved biography ${index}`,
          `https://example.test/official-${index}.webp`,
          office,
          current,
          index + 1,
        ],
      );
    for (const date of [...new Set(source.map((row) => row.date))].sort())
      await insertSession(`fixture-session-${date}`, date);
  });
  original = {
    ordinances: await rows("ordinances"),
    resolutions: await rows("resolutions"),
  };
  preserved = await referenceSnapshot();
  originalGuards = await triggerSnapshot();
});
test.afterAll(async () => await db?.close());

test("the approved manifest contains 210 distinct records and excludes the two parked source rows", () => {
  expect(source).toHaveLength(210);
  expect(source.filter((row) => row.collection === "ordinances")).toHaveLength(
    69,
  );
  expect(source.filter((row) => row.collection === "resolutions")).toHaveLength(
    141,
  );
  expect(
    new Set(
      source.map(
        (row) => `${row.collection}:${row.number}:${row.date.slice(0, 4)}`,
      ),
    ).size,
  ).toBe(210);
  expect(source.flatMap((row) => row.sourceRows)).not.toContain(501);
  expect(source.flatMap((row) => row.sourceRows)).not.toContain(537);
  expect(
    source.every((row) => row.summary === row.title && row.pdfUrl === null),
  ).toBe(true);
});

test("number/year conflicts in either collection abort the whole import without changing historical records", async () => {
  for (const table of tables) {
    const target = source.find((row) => row.collection === table)!;
    await expectSeedRollback(async () => {
      // Mimic a genuinely preserved legacy number conflict. Only fixture
      // setup bypasses its historical date/session checks; the import does not.
      await db.exec(`alter table ${table} disable trigger a_document_session_authors;
        alter table ${table} disable trigger assign_legislative_term;
        alter table ${table} disable trigger z_reorder`);
      await db.query(
        `update ${table} set number=$1,year=$2,date_approved=$3 where id=$4`,
        [
          target.number,
          Number(target.date.slice(0, 4)),
          target.date,
          original[table][0].id,
        ],
      );
      await db.exec(`set constraints all immediate;
        alter table ${table} enable trigger a_document_session_authors;
        alter table ${table} enable trigger assign_legislative_term;
        alter table ${table} enable trigger z_reorder`);
    });
  }
});

test("missing and ambiguous date sessions cannot create partial imports or invent sessions", async () => {
  const date = source[0].date;
  await expectSeedRollback(async () =>
    asStaff(() =>
      db.query("delete from sessions where id=$1", [`fixture-session-${date}`]),
    ),
  );
  await expectSeedRollback(async () =>
    asStaff(() => insertSession("fixture-ambiguous-session", date)),
  );
});

test("wrong-term or non-SB officials and missing committee compositions are rejected", async () => {
  await expectSeedRollback(async () =>
    asStaff(() =>
      db.query("update officials set term_id=$1 where id='fixture-sb-2'", [
        past,
      ]),
    ),
  );
  await expectSeedRollback(async () =>
    asStaff(() =>
      db.query(
        "update officials set legislative_role='MUNICIPAL_VICE_MAYOR' where id='fixture-sb-2'",
      ),
    ),
  );
  await expectSeedRollback(async () =>
    asStaff(() =>
      db.query(
        "delete from committees where term_id=$1 and master_id=(select id from committee_master where sort_order=1)",
        [current],
      ),
    ),
  );
});

test("disabled required document guards are detected without changing their starting state", async () => {
  for (const table of tables)
    for (const trigger of [
      "z_reorder",
      "a_document_session_authors",
      "assign_legislative_term",
      "legislative_relations",
    ])
      await expectSeedRollback(() =>
        db.exec(`alter table ${table} disable trigger ${trigger}`),
      );
});

test("a failure after inserting into both collections rolls back documents, audit and trigger changes", async () => {
  const ordinance = source.find((row) => row.collection === "ordinances")!;
  const resolution = source.find((row) => row.collection === "resolutions")!;
  await expectSeedRollback(async () => {
    await db.exec(`create function public.test_document_seed_failure() returns trigger
      language plpgsql as $$begin
       if exists(select 1 from ordinances where number='${ordinance.number}')
        and exists(select 1 from resolutions where number='${resolution.number}') then
        raise exception 'Injected document seed failure after both collections changed';
       end if;
       return new;
      end$$;
      create trigger x_test_document_seed_failure before insert on resolutions
       for each row execute function public.test_document_seed_failure();`);
  }, /Injected document seed failure after both collections changed/);
});

test("imports 69 ordinances and 141 resolutions with exact approved previews and matching references", async () => {
  const auditBefore = await auditRows();
  await db.exec(seedSql());
  const officialRows = await rows("officials");
  const committeeRows = await rows("committees");
  for (const table of tables) {
    const after = await rows(table);
    const selected = source.filter((row) => row.collection === table);
    expect(after).toHaveLength(original[table].length + selected.length);
    for (const prior of original[table])
      expect(after.find((row) => row.id === prior.id)).toEqual(prior);
    const added = after.filter(
      (row) => !original[table].some((prior) => prior.id === row.id),
    );
    for (const input of selected) {
      const saved = added.filter((row) => row.row.number === input.number);
      expect(saved).toHaveLength(1);
      const row = saved[0].row;
      expect(row).toMatchObject({
        title: input.title,
        number: input.number,
        date_approved: input.date,
        year: Number(input.date.slice(0, 4)),
        summary: input.title,
        pdf_url: null,
        approval_mode: input.approvalMode,
        office_id: office,
        content_scope: "legislative",
        term_id: current,
        published: true,
        is_sample: false,
        session_id: `fixture-session-${input.date}`,
      });
      const author = officialRows.find(
        (candidate) => candidate.id === row.author_id,
      )!;
      const coAuthor = officialRows.find(
        (candidate) => candidate.id === row.co_author_id,
      )!;
      expect(normalizeName(String(author.row.name))).toBe(
        normalizeName(input.author),
      );
      expect(normalizeName(String(coAuthor.row.name))).toBe(
        normalizeName(input.coAuthor),
      );
      for (const linked of [author, coAuthor])
        expect(linked.row).toMatchObject({
          term_id: current,
          office_id: office,
          legislative_role: "SANGGUNIANG_BAYAN",
        });
      const committee = committeeRows.find(
        (candidate) => candidate.id === row.committee_id,
      )!;
      expect(normalizeCommittee(String(committee.row.name))).toBe(
        normalizeCommittee(input.committee),
      );
      expect(committee.row).toMatchObject({
        term_id: current,
        office_id: office,
      });
    }
    const previousMax = Math.max(
      0,
      ...original[table]
        .filter((row) => row.row.published && row.row.office_id === office)
        .map((row) => Number(row.row.sort_order)),
    );
    expect(
      added.map((row) => Number(row.row.sort_order)).sort((a, b) => a - b),
    ).toEqual(
      Array.from(
        { length: selected.length },
        (_, index) => previousMax + index + 1,
      ),
    );
  }
  expect(await referenceSnapshot()).toEqual(preserved);
  expect(await triggerSnapshot()).toEqual(originalGuards);
  const auditAfter = await auditRows();
  expect(auditAfter.slice(0, auditBefore.length)).toEqual(auditBefore);
  expect(auditAfter.slice(auditBefore.length)).toHaveLength(210);
  expect(
    auditAfter
      .slice(auditBefore.length)
      .every(
        (row) =>
          row.action === "insert" &&
          tables.includes(row.entity_type as Table) &&
          row.office_id === office,
      ),
  ).toBe(true);
  await db.exec("set role anon");
  try {
    for (const table of tables) {
      const published = await rows(table);
      expect(published).toHaveLength(
        original[table].filter((row) => row.row.published).length +
          source.filter((row) => row.collection === table).length,
      );
    }
  } finally {
    await db.exec("reset role");
  }
});

test("rerunning skips exact matches without rewriting content, timestamps, files or audit history", async () => {
  const before = await snapshot();
  await db.exec(seedSql());
  expect(await snapshot()).toEqual(before);
});
