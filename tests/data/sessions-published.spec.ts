import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

test.describe.configure({ mode: "serial" });
const migration = "202611230031_sessions_published.sql";
const migrationSQL = readFileSync(`supabase/migrations/${migration}`, "utf8");
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  legislative: "00000000-0000-4000-8000-000000000002",
  executive: "00000000-0000-4000-8000-000000000003",
  viewer: "00000000-0000-4000-8000-000000000004",
};
const term = "10000000-0000-4000-8000-000000000001";
let db: PGlite;
let offices: Record<string, string>;
let original: { id: string; row: Record<string, unknown> }[];
let related: unknown[];
let policies: unknown[];

async function as(user: keyof typeof users | "anon", run: () => Promise<void>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user === "anon" ? "" : users[user],
  ]);
  await db.exec(`set role ${user === "anon" ? "anon" : "authenticated"}`);
  try {
    await run();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
  }
}
async function sessions() {
  return (
    await db.query<{ id: string; row: Record<string, unknown> }>(
      "select id,to_jsonb(s) row from sessions s order by id",
    )
  ).rows;
}
async function policySnapshot() {
  return (
    await db.query(
      `select * from pg_policies where schemaname='public' order by tablename,policyname`,
    )
  ).rows;
}
async function triggerSnapshot() {
  return (
    await db.query(`select tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger
      where tgrelid='public.sessions'::regclass order by tgname`)
  ).rows;
}
async function publishedDefault() {
  return (
    await db.query<{
      column_default: string;
    }>(`select column_default from information_schema.columns
      where table_schema='public' and table_name='sessions' and column_name='published'`)
  ).rows[0].column_default;
}
async function position(scope: string, office: string | null) {
  return (
    await db.query<{ position: number }>(
      `select coalesce(max(sort_order),0)+1 position from sessions
      where published and content_scope=$1 and office_id is not distinct from $2::uuid`,
      [scope, office],
    )
  ).rows[0].position;
}
async function insertSession(
  id: string,
  scope: string,
  office: string | null,
  published?: boolean,
) {
  const args: unknown[] = [id, scope, office, await position(scope, office)];
  if (published !== undefined) args.push(published);
  return db.query(
    `insert into sessions(id,name,number,type,date,description,image,content_scope,office_id,sort_order${published === undefined ? "" : ",published"})
    values($1,$1,'90','Regular session','2026-11-23','','/images/department-placeholder.svg',$2,$3,$4${published === undefined ? "" : ",$5"}) returning id,published,sort_order,term_id`,
    args,
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
        // This predates term support and deliberately has no covering term.
        await db.query(
          `insert into sessions(id,name,number,type,date,description,agenda,image,content_scope,office_id,published,sort_order)
          values('legacy-unassigned-draft','Historical session','Old','Regular session','2024-01-15','Retain history',array['Original agenda'],'/images/retained-history.webp','legislative',$1,false,0)`,
          [offices["legislative-access"]],
        );
      });
    }
  }
  await as("superadmin", async () => {
    await db.query(
      "insert into legislative_terms(id,name,start_date,end_date) values($1,'17th','2025-07-01','2028-06-30')",
      [term],
    );
    for (const [id, published, date] of [
      ["existing-published", true, "2026-11-20"],
      ["older-draft", false, "2026-11-16"],
      ["newer-draft", false, "2026-11-23"],
    ] as const)
      await db.query(
        `insert into sessions(id,name,number,type,date,description,agenda,image,content_scope,office_id,published,sort_order)
      values($1,$1,$1,'Regular session',$2,'Preserved description',array['Preserved agenda'],'/images/preserved-session.webp','legislative',$3,$4,$5)`,
        [
          id,
          date,
          offices["legislative-access"],
          published,
          published
            ? await position("legislative", offices["legislative-access"])
            : 0,
        ],
      );
    await db.query(
      `insert into sessions(id,name,number,type,date,description,image,content_scope,office_id,published,sort_order)
      values('executive-draft','Executive history','EX','Regular session','2026-11-23','','/images/executive.webp','executive',$1,false,0)`,
      [offices["municipal-health"]],
    );
    await db.query(
      `insert into municipal_documents(id,title,date,description,document_type,session_id,file_url,content_scope,office_id,published,sort_order)
      values('linked-session-agenda','Preserved agenda','2026-11-23','Keep this linked file','agenda','newer-draft','https://fixture.supabase.test/preserved-agenda.pdf','legislative',$1,true,1)`,
      [offices["legislative-access"]],
    );
  });
  original = await sessions();
  related = (
    await db.query(
      "select to_jsonb(d) row from municipal_documents d order by id",
    )
  ).rows;
  policies = await policySnapshot();
});

test.afterAll(async () => {
  await db.close();
});

test("unexpected trigger state fails without changing records or schema", async () => {
  await db.exec("alter table sessions disable trigger assign_legislative_term");
  const beforeTriggers = await triggerSnapshot();
  await expect(db.exec(migrationSQL)).rejects.toThrow(
    "Unexpected session ordering or term trigger state",
  );
  await db.exec("rollback");
  expect(await sessions()).toEqual(original);
  expect(await publishedDefault()).toBe("false");
  expect(await triggerSnapshot()).toEqual(beforeTriggers);
  expect(await policySnapshot()).toEqual(policies);
  await db.exec("alter table sessions enable trigger assign_legislative_term");
});

test("a backfill failure rolls back publication and restores both temporary trigger changes", async () => {
  await db.exec(`create function public.test_session_preservation_failure() returns trigger language plpgsql as $$
    begin if new.id='newer-draft' and new.published then new.description='Unexpected rewrite'; end if;return new;end$$;
    create trigger x_test_session_preservation_failure before update on sessions for each row execute function test_session_preservation_failure();`);
  const beforeTriggers = await triggerSnapshot();
  const beforeAudit = (await db.query("select * from audit_logs order by id"))
    .rows;
  await expect(db.exec(migrationSQL)).rejects.toThrow(
    "Session publication preservation check failed",
  );
  await db.exec("rollback");
  expect(await sessions()).toEqual(original);
  expect(await triggerSnapshot()).toEqual(beforeTriggers);
  expect(await publishedDefault()).toBe("false");
  expect((await db.query("select * from audit_logs order by id")).rows).toEqual(
    beforeAudit,
  );
  await db.exec(
    "drop trigger x_test_session_preservation_failure on sessions;drop function test_session_preservation_failure()",
  );
});

test("publishes all drafts, appends within scope and preserves terms, references, files and published positions", async () => {
  const beforeTriggers = await triggerSnapshot();
  await db.exec(migrationSQL);
  const after = await sessions();
  expect(after.map((r) => r.id)).toEqual(original.map((r) => r.id));
  for (const record of after) {
    const prior = original.find((r) => r.id === record.id)!.row;
    expect(record.row.published).toBe(true);
    const omitMutable = (row: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(row).filter(
          ([key]) => !["published", "sort_order", "updated_at"].includes(key),
        ),
      );
    expect(omitMutable(record.row)).toEqual(omitMutable(prior));
    if (prior.published) expect(record.row).toEqual(prior);
  }
  const byID = Object.fromEntries(after.map((r) => [r.id, r.row]));
  const priorPosition = Number(
    original.find((r) => r.id === "existing-published")!.row.sort_order,
  );
  expect(byID["existing-published"].sort_order).toBe(priorPosition);
  expect(byID["newer-draft"].sort_order).toBe(priorPosition + 1);
  expect(byID["older-draft"].sort_order).toBe(priorPosition + 2);
  expect(byID["legacy-unassigned-draft"].sort_order).toBe(priorPosition + 3);
  expect(byID["legacy-unassigned-draft"].term_id).toBeNull();
  expect(byID["executive-draft"].sort_order).toBe(1);
  expect(byID["newer-draft"].term_id).toBe(term);
  expect(
    (
      await db.query(
        "select to_jsonb(d) row from municipal_documents d order by id",
      )
    ).rows,
  ).toEqual(related);
  expect(await triggerSnapshot()).toEqual(beforeTriggers);
  expect(await policySnapshot()).toEqual(policies);
  expect(await publishedDefault()).toBe("true");
  await as("anon", async () => {
    expect(
      (
        await db.query<{ id: string }>("select id from sessions order by id")
      ).rows.map((r) => r.id),
    ).toEqual(original.map((r) => r.id));
  });
});

test("authorized saves default to published and reject attempts to create or restore a draft atomically", async () => {
  await as("legislative", async () => {
    const created = await insertSession(
      "automatic-publication",
      "legislative",
      offices["legislative-access"],
    );
    expect(created.rows[0]).toMatchObject({
      id: "automatic-publication",
      published: true,
      term_id: term,
    });
    const before = await sessions();
    await expect(
      insertSession(
        "forged-draft",
        "legislative",
        offices["legislative-access"],
        false,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update sessions set published=false,sort_order=0 where id='automatic-publication'",
      ),
    ).rejects.toThrow("sessions_always_published");
    expect(await sessions()).toEqual(before);
    expect(
      (
        await db.query(
          "update sessions set name='Updated published session' where id='automatic-publication' returning published",
        )
      ).rows,
    ).toEqual([{ published: true }]);
  });
});

test("publication does not grant Executive users, viewers, anonymous users or revoked staff write access", async () => {
  const before = await sessions();
  for (const user of ["executive", "viewer", "anon"] as const)
    await as(user, async () => {
      const update = db.query(
        "update sessions set name='Forbidden change' where id='newer-draft' returning id",
      );
      if (user === "anon")
        await expect(update).rejects.toThrow("permission denied");
      else expect((await update).rows).toEqual([]);
      await expect(
        insertSession(
          `forbidden-${user}`,
          "legislative",
          offices["legislative-access"],
        ),
      ).rejects.toThrow();
    });
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.legislative,
  ]);
  await as("legislative", async () => {
    expect(
      (
        await db.query(
          "update sessions set name='Revoked change' where id='newer-draft' returning id",
        )
      ).rows,
    ).toEqual([]);
    await expect(
      insertSession(
        "forbidden-revoked",
        "legislative",
        offices["legislative-access"],
      ),
    ).rejects.toThrow();
  });
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.legislative,
  ]);
  expect(await sessions()).toEqual(before);
});

test("normal ordering, term assignment and linked-session date guards remain active after the migration", async () => {
  await as("legislative", async () => {
    await expect(
      db.query(
        "update sessions set date='2030-01-01' where id='automatic-publication'",
      ),
    ).rejects.toThrow("No Legislative Term covers this date");
    await expect(
      db.query("update sessions set date='2026-11-24' where id='newer-draft'"),
    ).rejects.toThrow("This session date is used by linked documents");
    await expect(
      db.query("delete from sessions where id='newer-draft'"),
    ).rejects.toThrow("foreign key constraint");
    await db.query(
      "update sessions set sort_order=1 where id='automatic-publication'",
    );
    expect(
      (
        await db.query(
          "select sort_order,published from sessions where id='automatic-publication'",
        )
      ).rows,
    ).toEqual([{ sort_order: 1, published: true }]);
    expect(
      (
        await db.query(
          "select sort_order from sessions where id='existing-published'",
        )
      ).rows,
    ).toEqual([
      {
        sort_order:
          Number(
            original.find((r) => r.id === "existing-published")!.row.sort_order,
          ) + 1,
      },
    ]);
  });
  expect(await policySnapshot()).toEqual(policies);
});
