import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

test.describe.configure({ mode: "serial" });
const migration = "202611260037_document_mass_motion.sql";
const current = "10000000-0000-4000-8000-000000000001";
const past = "10000000-0000-4000-8000-000000000002";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  legislative: "00000000-0000-4000-8000-000000000002",
  executive: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
const tables = ["ordinances", "resolutions"] as const;
type Table = (typeof tables)[number];
type JsonRow = { id: string; row: Record<string, unknown> };
let db: PGlite;
let offices: Record<string, string>;
let committee: string;
let pastCommittee: string;
let preserved: Record<string, unknown>;
let original: Record<Table, JsonRow[]>;
let guards: unknown[];

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
async function rows(table: string): Promise<JsonRow[]> {
  return (
    await db.query<JsonRow>(
      `select id::text id,to_jsonb(r) row from ${table} r order by id`,
    )
  ).rows;
}
async function unrelated() {
  const snapshot: Record<string, unknown> = {};
  for (const table of [
    "officials",
    "committees",
    "committee_master",
    "sessions",
    "municipal_documents",
    "legislative_terms",
    "departments",
    "staff_accounts",
    "user_office_access",
    "audit_logs",
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
async function triggerSnapshot() {
  return (
    await db.query(
      "select tgrelid::regclass::text relation,tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where not tgisinternal order by relation,tgname",
    )
  ).rows;
}
async function document(
  table: Table,
  id: string,
  overrides: Record<string, unknown> = {},
) {
  const record: Record<string, unknown> = {
    id,
    number: id,
    title: `Document ${id}`,
    date_approved: "2026-11-18",
    year: 2026,
    author: "",
    co_author: null,
    status: "Approved",
    summary: "Preserved complete body",
    office_id: offices["legislative-access"],
    content_scope: "legislative",
    approval_mode: "mass_motion",
    committee_id: committee,
    ...overrides,
  };
  const columns = Object.keys(record);
  return db.query(
    `insert into ${table}(${columns.join(",")}) values(${columns.map((_, i) => `$${i + 1}`).join(",")}) returning approval_mode,author_id,co_author_id,session_id,term_id`,
    Object.values(record),
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
      });
    }
    if (file === "202611160019_legislative_terms.sql")
      await as("superadmin", async () => {
        for (const [id, name, start, end] of [
          [current, "17th", "2025-07-01", "2028-06-30"],
          [past, "16th", "2022-07-01", "2025-06-30"],
        ])
          await db.query(
            "insert into legislative_terms(id,name,start_date,end_date) values($1,$2,$3,$4)",
            [id, name, start, end],
          );
      });
  }
  await as("superadmin", async () => {
    for (const [id, role, term] of [
      ["sb-a", "SANGGUNIANG_BAYAN", current],
      ["sb-b", "SANGGUNIANG_BAYAN", current],
      ["vice", "MUNICIPAL_VICE_MAYOR", current],
      ["past-sb", "SANGGUNIANG_BAYAN", past],
    ])
      await db.query(
        "insert into officials(id,name,role,description,branch,legislative_role,office_id,content_scope,term_id) values($1,$1,'Official','','legislative',$2,$3,'legislative',$4)",
        [id, role, offices["legislative-access"], term],
      );
    for (const [id, date] of [
      ["unique-session", "2026-11-18"],
      ["regular-session", "2026-11-19"],
      ["special-session", "2026-11-19"],
      ["past-session", "2024-11-18"],
    ]) {
      const position = (
        await db.query<{ position: number }>(
          "select coalesce(max(sort_order),0)+1 position from sessions where office_id=$1 and published",
          [offices["legislative-access"]],
        )
      ).rows[0].position;
      await db.query(
        "insert into sessions(id,name,number,date,type,description,agenda,image,office_id,content_scope,sort_order) values($1,$1,'1',$2,'Regular session','',array[]::text[],'/images/department-placeholder.svg',$3,'legislative',$4)",
        [id, date, offices["legislative-access"], position],
      );
    }
    for (const term of [current, past]) {
      const id = (
        await db.query<{ id: string }>(
          "select id from committees where term_id=$1 order by sort_order,id limit 1",
          [term],
        )
      ).rows[0].id;
      if (term === current) committee = id;
      else pastCommittee = id;
    }
    // Preserve both a genuine legacy text-only record and a linked authored one.
    await db.query(
      "update ordinances set date_approved='2026-11-18',year=2026,session_id='unique-session',committee_id=$1 where id='water-safety'",
      [committee],
    );
    await db.query(
      "update resolutions set date_approved='2026-11-18',year=2026,author_id='sb-a',co_author_id='sb-b',session_id='unique-session',committee_id=$1 where id='health-outreach'",
      [committee],
    );
  });
  original = {
    ordinances: await rows("ordinances"),
    resolutions: await rows("resolutions"),
  };
  preserved = await unrelated();
  guards = await triggerSnapshot();
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());

test("migration defaults existing documents to authored without rewriting preserved records or access", async () => {
  for (const table of tables) {
    const actual = await rows(table);
    expect(actual).toEqual(
      original[table].map(({ id, row }) => ({
        id,
        row: { ...row, approval_mode: "authored" },
      })),
    );
  }
  expect(await unrelated()).toEqual(preserved);
  expect(await triggerSnapshot()).toEqual(guards);
  const functions = (
    await db.query<{ can_execute: boolean }>(
      "select has_function_privilege('authenticated','public.portal_legislative_relations()','execute') can_execute",
    )
  ).rows;
  expect(functions).toEqual([{ can_execute: false }]);
});

test("mass motion supports both document types while matching sessions and terms", async () => {
  await as("legislative", async () => {
    for (const table of tables) {
      const position = (
        await db.query<{ position: number }>(
          `select coalesce(max(sort_order),0)+1 position from ${table} where office_id=$1 and published`,
          [offices["legislative-access"]],
        )
      ).rows[0].position;
      expect(
        (
          await document(table, `${table}-mass`, {
            published: true,
            sort_order: position,
          })
        ).rows,
      ).toEqual([
        {
          approval_mode: "mass_motion",
          author_id: null,
          co_author_id: null,
          session_id: "unique-session",
          term_id: current,
        },
      ]);
    }
  });
  await as("anon", async () => {
    for (const table of tables)
      expect(
        (
          await db.query(`select approval_mode from ${table} where id=$1`, [
            `${table}-mass`,
          ])
        ).rows,
      ).toEqual([{ approval_mode: "mass_motion" }]);
  });
});

test("invalid modes and contradictory author identities or legacy text are rejected", async () => {
  await as("legislative", async () => {
    for (const table of tables) {
      const before = await rows(table);
      for (const invalid of [
        { approval_mode: "all" },
        { approval_mode: null },
        { author_id: "sb-a" },
        { co_author_id: "sb-b" },
        { author: "Existing author name" },
        { co_author: "Existing co-author name" },
      ])
        await expect(document(table, "contradictory", invalid)).rejects.toThrow();
      expect(await rows(table)).toEqual(before);
    }
  });
});

test("ordinary authored documents still require a same-term SB author and preserve text-only legacy edits", async () => {
  await as("legislative", async () => {
    for (const table of tables) {
      await expect(
        document(table, "missing-author", { approval_mode: "authored" }),
      ).rejects.toThrow("Choose one author");
      await expect(
        document(table, "vice-author", {
          approval_mode: "authored",
          author_id: "vice",
        }),
      ).rejects.toThrow("Sangguniang Bayan");
      await expect(
        document(table, "vice-coauthor", {
          approval_mode: "authored",
          author_id: "sb-a",
          co_author_id: "vice",
        }),
      ).rejects.toThrow("Sangguniang Bayan");
      await expect(
        document(table, "past-author", {
          approval_mode: "authored",
          author_id: "past-sb",
        }),
      ).rejects.toThrow("same Legislative Term");
      await document(table, `${table}-authored`, {
        approval_mode: "authored",
        author_id: "sb-a",
        co_author_id: "sb-b",
        author: "Retained author label",
        co_author: "Retained co-author label",
      });
      expect(
        (
          await db.query(
            `insert into ${table}(id,number,title,date_approved,year,author,status,summary,author_id,office_id,content_scope) values($1,$1,'Default authored','2026-11-18',2026,'','Approved','Body','sb-a',$2,'legislative') returning approval_mode`,
            [`${table}-default-authored`, offices["legislative-access"]],
          )
        ).rows,
      ).toEqual([{ approval_mode: "authored" }]);
    }
    await db.exec(
      "update ordinances set title='Legacy title clarified' where id='water-safety'",
    );
    expect(
      (
        await db.query(
          "select author,author_id,approval_mode from ordinances where id='water-safety'",
        )
      ).rows,
    ).toEqual([
      {
        author: original.ordinances.find((r) => r.id === "water-safety")!.row
          .author,
        author_id: null,
        approval_mode: "authored",
      },
    ]);
    const unassigned = (
      await db.query<{ id: string }>(
        "select id from resolutions where term_id is null and session_id is null limit 1",
      )
    ).rows[0].id;
    await db.query("update resolutions set updated_at=now() where id=$1", [
      unassigned,
    ]);
    expect(
      (
        await db.query("select term_id,session_id from resolutions where id=$1", [
          unassigned,
        ])
      ).rows,
    ).toEqual([{ term_id: null, session_id: null }]);
  });
});

test("changing approval modes cannot leave mass-motion authors or bypass the normal author requirement", async () => {
  await as("legislative", async () => {
    for (const table of tables) {
      const id = `${table}-authored`;
      await expect(
        db.query(`update ${table} set approval_mode='mass_motion' where id=$1`, [
          id,
        ]),
      ).rejects.toThrow("mass_motion_authorship");
      await db.query(
        `update ${table} set approval_mode='mass_motion',author_id=null,co_author_id=null,author='',co_author=null where id=$1`,
        [id],
      );
      await expect(
        db.query(`update ${table} set approval_mode='authored' where id=$1`, [
          id,
        ]),
      ).rejects.toThrow("Choose one author");
      await db.query(
        `update ${table} set approval_mode='authored',author_id='sb-a' where id=$1`,
        [id],
      );
      await expect(
        db.query(`update ${table} set author_id=null where id=$1`, [id]),
      ).rejects.toThrow("Choose one author");
    }
  });
});

test("mass motion keeps date, term, committee and referenced-session guards active", async () => {
  await as("legislative", async () => {
    for (const table of tables) {
      await expect(
        document(table, "missing-session", { date_approved: "2026-11-20" }),
      ).rejects.toThrow("No matching session");
      await expect(
        document(table, "ambiguous-session", { date_approved: "2026-11-19" }),
      ).rejects.toThrow("Multiple sessions");
      await expect(
        document(table, "incorrect-session", { session_id: "past-session" }),
      ).rejects.toThrow("Session must match");
      await expect(
        document(table, "past-committee", { committee_id: pastCommittee }),
      ).rejects.toThrow("same Legislative Term");
      await document(table, `${table}-special`, {
        date_approved: "2026-11-19",
        session_id: "special-session",
      });
      await expect(
        db.query(`update ${table} set date_approved='2026-11-19' where id=$1`, [
          `${table}-mass`,
        ]),
      ).rejects.toThrow("Session must match");
    }
    await expect(
      db.exec("update sessions set date='2026-11-20' where id='unique-session'"),
    ).rejects.toThrow("linked documents");
  });
});

test("mass motion grants no additional staff access and cannot be saved with Executive ownership", async () => {
  for (const user of ["executive", "viewer"] as const)
    await as(user, async () => {
      for (const table of tables)
        await expect(document(table, `${user}-forbidden`)).rejects.toThrow();
    });
  await as("superadmin", async () => {
    for (const table of tables)
      await expect(
        document(table, "executive-mass", {
          office_id: offices["municipal-health"],
          content_scope: "executive",
          committee_id: null,
        }),
      ).rejects.toThrow("mass_motion_authorship");
  });
});
