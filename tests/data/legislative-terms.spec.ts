import {
  philippineDate,
  termForDate,
  selectedTerm,
  termStatus,
} from "../../lib/legislative/terms";
import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { parseLegislative } from "../../lib/legislative/validation";
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

test.beforeAll(async () => {
  await db.exec(
    "create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])",
  );
  const sql = readFileSync(
    "supabase/migrations/202610080011_content_workflows.sql",
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
});

test.beforeAll(async () => {
  await db.exec(
    readFileSync(
      "supabase/migrations/202610100012_admin_authoring.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611060014_legislative_workspace.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611090015_legislative_pdf_uploads.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611100016_transparency.sql", "utf8"),
  );
  await db.exec(
    "grant usage on schema storage,auth to anon;grant select on storage.objects to anon",
  );
});

test.beforeAll(async () => {
  for (const file of [
    "202611100017_transparency_reports.sql",
    "202611130018_transparency_access.sql",
    "202611160019_legislative_terms.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
});
const current = "20000000-0000-4000-8000-000000000001";
const previous = "20000000-0000-4000-8000-000000000002";
const next = "20000000-0000-4000-8000-000000000003";
test("terms preserve historical identities, restrict writes and prevent overlapping dates", async () => {
  expect(
    (await db.query("select id,term_id from committees where id='finance'"))
      .rows,
  ).toEqual([{ id: "finance", term_id: null }]);
  await as("superadmin", async () => {
    await db.query(
      "insert into legislative_terms(id,name,start_date,end_date) values($1,'Current','2025-07-01','2028-06-30'),($2,'Previous','2022-07-01','2025-06-30'),($3,'Upcoming','2028-07-01','2031-06-30')",
      [current, previous, next],
    );
    await expect(
      db.exec(
        "insert into legislative_terms(name,start_date,end_date) values('Overlap','2028-06-30','2030-01-01')",
      ),
    ).rejects.toThrow();
    await expect(db.exec("delete from legislative_terms")).rejects.toThrow();
  });
  await as("legislative", async () => {
    await expect(
      db.exec(
        "insert into legislative_terms(name,start_date,end_date) values('Denied','2040-01-01','2041-01-01')",
      ),
    ).rejects.toThrow();
  });
});
test("date assignment, matching relationships, historical adoption and term edits", async () => {
  await as("superadmin", async () => {
    await db.query(
      "update officials set term_id=$1 where content_scope='legislative'",
      [current],
    );
    const officials = (
      await db.query<{ id: string }>(
        "select id from officials where content_scope='legislative' order by id",
      )
    ).rows;
    const chair = officials[0].id;
    await db.query(
      "update committees set term_id=$1,chair_id=$2 where id='finance'",
      [current, chair],
    );
    await db.query(
      "update sessions set date='2025-07-01' where content_scope='legislative'",
    );
    expect(
      (
        await db.query<{ term_id: string }>(
          "select term_id from sessions where content_scope='legislative'",
        )
      ).rows.every((r) => r.term_id === current),
    ).toBe(true);
    const session = (
      await db.query<{ id: string }>(
        "select id from sessions where content_scope='legislative' limit 1",
      )
    ).rows[0].id;
    await db.query(
      "insert into municipal_documents(id,title,date,description,document_type,session_id,content_scope,office_id,published,sort_order) values('term-agenda','Agenda','2029-01-01','Agenda','agenda',$1,'legislative',$2,false,0)",
      [session, offices["legislative-access"]],
    );
    expect(
      (
        await db.query<{ term_id: string }>(
          "select term_id from municipal_documents where id='term-agenda'",
        )
      ).rows[0].term_id,
    ).toBe(current);
    await expect(
      db.query("update sessions set date='2028-07-01' where id=$1", [session]),
    ).rejects.toThrow(/another term/);
    await expect(
      db.query(
        "update legislative_terms set start_date='2025-07-02' where id=$1",
        [current],
      ),
    ).rejects.toThrow(/exclude linked/);
    await expect(
      db.query("update committees set term_id=$1 where id='finance'", [
        previous,
      ]),
    ).rejects.toThrow(/same Legislative Term/);
    await db.query(
      "update ordinances set year=2028,date_approved='2028-06-30',author_id=$1,committee_id='finance',session_id=$2 where id=(select id from ordinances limit 1)",
      [chair, session],
    );
    await expect(
      db.query(
        "update ordinances set date_approved='2035-01-01' where content_scope='legislative'",
      ),
    ).rejects.toThrow(/No Legislative Term/);
    const ordinance = (
      await db.query<{ id: string }>(
        "select id from ordinances where term_id is not null limit 1",
      )
    ).rows[0].id;
    await expect(
      db.query("update ordinances set date_approved='2028-07-01' where id=$1", [
        ordinance,
      ]),
    ).rejects.toThrow(/same Legislative Term/);
  });
  await db.exec("set role anon");
  expect(
    (
      await db.query(
        "select id from municipal_documents where id='term-agenda'",
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec("reset role");
});
test("Philippine midnight switches current term and date boundaries are inclusive", () => {
  const terms = [
    {
      id: current,
      name: "Current",
      start_date: "2025-07-01",
      end_date: "2028-06-30",
    },
    {
      id: next,
      name: "Next",
      start_date: "2028-07-01",
      end_date: "2031-06-30",
    },
  ];
  expect(philippineDate(new Date("2028-06-30T15:59:59Z"))).toBe("2028-06-30");
  const midnight = philippineDate(new Date("2028-06-30T16:00:00Z"));
  expect(midnight).toBe("2028-07-01");
  expect(selectedTerm(terms, undefined, midnight)).toBe(next);
  expect(termForDate(terms, "2028-06-30")?.id).toBe(current);
  expect(termStatus(terms[0], midnight)).toBe("Previous");
  expect(selectedTerm(terms, previous, midnight)).toBe("none");
});

test("date-based sessions, resolutions and executive orders recalculate terms on edits", async () => {
  await as("superadmin", async () => {
    await db.query(
      "insert into sessions(id,number,type,date,description,image,office_id,content_scope,published,sort_order) values('date-session','2','Regular session','2025-06-30','Session','/images/department-placeholder.svg',$1,'legislative',false,0)",
      [offices["legislative-access"]],
    );
    expect(
      (
        await db.query<{ term_id: string }>(
          "select term_id from sessions where id='date-session'",
        )
      ).rows[0].term_id,
    ).toBe(previous);
    await db.query(
      "update sessions set date='2025-07-01' where id='date-session'",
    );
    expect(
      (
        await db.query<{ term_id: string }>(
          "select term_id from sessions where id='date-session'",
        )
      ).rows[0].term_id,
    ).toBe(current);
    await db.query(
      "insert into municipal_documents(id,title,date,description,document_type,office_id,content_scope,published,sort_order) values('term-eo','Order','2028-07-01','Order','executive-order',$1,'legislative',false,0)",
      [offices["legislative-access"]],
    );
    expect(
      (
        await db.query<{ term_id: string }>(
          "select term_id from municipal_documents where id='term-eo'",
        )
      ).rows[0].term_id,
    ).toBe(next);
    await db.query(
      "update municipal_documents set date='2028-06-30' where id='term-eo'",
    );
    expect(
      (
        await db.query<{ term_id: string }>(
          "select term_id from municipal_documents where id='term-eo'",
        )
      ).rows[0].term_id,
    ).toBe(current);
    await db.query(
      "update resolutions set year=2028,date_approved='2028-06-30',author_id=(select id from officials where term_id=$1 limit 1) where content_scope='legislative'",
      [current],
    );
    expect(
      (
        await db.query<{ term_id: string }>(
          "select term_id from resolutions where content_scope='legislative'",
        )
      ).rows.every((r) => r.term_id === current),
    ).toBe(true);
  });
});

test("Legislative CSV-shaped bulk inserts retain order and terms and roll back as one statement", async () => {
  const makeOrder = (
    title: string,
    date: string,
    position: number,
    term: string,
  ): Record<string, unknown> => {
    const form = new FormData();
    form.set("title", title);
    form.set("date", date);
    form.set("description", "Imported metadata with no PDF attachment.");
    form.set("document_type", "executive-order");
    return {
      ...parseLegislative("documents", form, null),
      office_id: offices["legislative-access"],
      content_scope: "legislative",
      term_id: term,
      sort_order: position,
    };
  };
  const bulkInsert = (rows: Record<string, unknown>[]) =>
    db.query(
      `insert into municipal_documents
      (id,title,date,description,document_type,session_id,category_id,file_url,
       office_id,content_scope,published,sort_order,is_sample,term_id)
     select id,title,date,description,document_type,session_id,category_id,file_url,
       office_id,content_scope,published,sort_order,is_sample,term_id
     from jsonb_to_recordset($1::jsonb) as imported(
       id text,title text,date date,description text,document_type text,session_id text,
       category_id text,file_url text,office_id uuid,content_scope text,
       published boolean,sort_order integer,is_sample boolean,term_id uuid)`,
      [JSON.stringify(rows)],
    );
  const publishedState = () =>
    db.query<{ id: string; sort_order: number; term_id: string | null }>(
      "select id,sort_order,term_id from municipal_documents where office_id=$1 and content_scope='legislative' and published order by sort_order,id",
      [offices["legislative-access"]],
    );
  await as("legislative", async () => {
    const before = (await publishedState()).rows;
    const rows = [
      makeOrder("CSV current order", "2026-11-18", 1, current),
      makeOrder("CSV upcoming order", "2029-01-05", 2, next),
    ];
    await bulkInsert(rows);
    const after = (await publishedState()).rows;
    expect(after.slice(0, 2)).toEqual([
      { id: rows[0].id, sort_order: 1, term_id: current },
      { id: rows[1].id, sort_order: 2, term_id: next },
    ]);
    expect(after.slice(2)).toEqual(
      before.map((row) => ({ ...row, sort_order: row.sort_order + 2 })),
    );
    const invalid = [
      makeOrder("CSV rolled-back first order", "2026-11-19", 1, current),
      makeOrder("CSV invalid second order", "2040-01-01", 2, current),
    ];
    await expect(bulkInsert(invalid)).rejects.toThrow(/No Legislative Term/);
    expect((await publishedState()).rows).toEqual(after);
    expect(
      (
        await db.query(
          "select id from municipal_documents where id in ($1,$2)",
          [invalid[0].id, invalid[1].id],
        )
      ).rows,
    ).toEqual([]);
  });
});
