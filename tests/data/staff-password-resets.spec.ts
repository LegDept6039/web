import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const migration = "202611200026_staff_password_resets.sql";
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
  otherAdmin: "00000000-0000-4000-8000-000000000004",
};
type Staff = keyof typeof users;
const sessions: Record<Staff, string> = {
  superadmin: randomUUID(),
  editor: randomUUID(),
  viewer: randomUUID(),
  otherAdmin: randomUUID(),
};
const digest = "e".repeat(64);
let db: PGlite;
let office: string;
let before: unknown;

async function as<T>(
  role: Staff | "service_role" | "anon",
  run: () => Promise<T>,
  sessionId?: string,
): Promise<T> {
  const staff = role !== "service_role" && role !== "anon" ? role : null;
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [
      staff ? users[staff] : "",
      JSON.stringify(
        staff
          ? { sub: users[staff], session_id: sessionId ?? sessions[staff] }
          : {},
      ),
    ],
  );
  await db.exec(`set role ${staff ? "authenticated" : role}`);
  try {
    return await run();
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false)",
    );
  }
}

async function bool(sql: string, values: unknown[] = []) {
  return (await db.query<{ value: boolean }>(`select ${sql} as value`, values))
    .rows[0].value;
}
async function snapshot() {
  return Promise.all(
    [
      "staff_accounts",
      "user_office_access",
      "services",
      "departments",
      "audit_logs",
    ].map(
      async (table) =>
        (
          await db.query(
            `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
          )
        ).rows,
    ),
  );
}
async function begin(target: Staff = "editor", generation = randomUUID()) {
  await as("service_role", async () =>
    expect(
      await bool("begin_staff_password_reset($1,$2,$3,$4,$5)", [
        users.superadmin,
        sessions.superadmin,
        users[target],
        generation,
        digest,
      ]),
    ).toBe(true),
  );
  return generation;
}
async function activate(target: Staff, generation: string) {
  await as("service_role", async () =>
    expect(
      await bool("activate_staff_password_reset($1,$2)", [
        users[target],
        generation,
      ]),
    ).toBe(true),
  );
}
async function freshSession(target: Staff) {
  const id = randomUUID();
  await db.query(
    "insert into auth.sessions(id,user_id,created_at) values($1,$2,clock_timestamp())",
    [id, users[target]],
  );
  return id;
}
async function status(target: Staff, sessionId?: string) {
  return as(
    target,
    async () =>
      (
        await db.query<{
          value: {
            required: boolean;
            ready: boolean;
            generation: string | null;
            state: string | null;
            expires_at: string | null;
            session_id: string;
          };
        }>("select password_reset_status() value")
      ).rows[0].value,
    sessionId,
  );
}
async function claim(target: Staff, generation: string, session: string) {
  return as("service_role", () =>
    bool("claim_staff_password_change($1,$2,$3)", [
      users[target],
      generation,
      session,
    ]),
  );
}
async function finish(target: Staff, generation: string) {
  return as("service_role", () =>
    bool("finish_staff_password_change($1,$2)", [users[target], generation]),
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
    .filter((file) => file.endsWith(".sql") && file < migration)
    .sort()) {
    if (file === "202609300002_media.sql") continue;
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    if (file === "202610010005_legislative_modules.sql")
      await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  }
  for (const [role, id] of Object.entries(users)) {
    await db.query("insert into auth.users values($1,$2)", [
      id,
      `${role}@test.local`,
    ]);
    await db.query(
      "insert into auth.sessions values($1,$2,clock_timestamp()-interval '1 day')",
      [sessions[role as Staff], id],
    );
  }
  await db.query(
    "update staff_accounts set role='superadmin',active=true where user_id in ($1,$2)",
    [users.superadmin, users.otherAdmin],
  );
  office = (
    await db.query<{ id: string }>(
      "select id from departments where department='executive' and active and published and archived_at is null order by id limit 1",
    )
  ).rows[0].id;
  await as("superadmin", async () => {
    for (const role of ["editor", "viewer"] as const)
      await db.query(
        "select manage_staff($1,$2,true,$2,$3::jsonb,false,true)",
        [
          users[role],
          role,
          JSON.stringify([{ office_id: office, permission_level: role }]),
        ],
      );
    await db.query(
      "insert into services(id,name,description,body,icon,office,office_id) values('reset-private-service','Private service','Summary','Private body','FileText','Office',$1)",
      [office],
    );
  });
  before = await snapshot();
  // Supabase can grant service_role ALL on newly created public tables by default.
  await db.exec(
    "alter default privileges in schema public grant all on tables to service_role",
  );
  await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
});
test.afterAll(async () => await db.close());
test.beforeEach(async () => {
  await db.exec(
    "delete from staff_password_resets;delete from staff_browser_sessions",
  );
});

test("migration preserves existing account permissions, content and audit history", async () => {
  expect(await snapshot()).toEqual(before);
  const own = await status("editor");
  expect(own).toMatchObject({
    required: false,
    ready: true,
    state: null,
    generation: null,
    expires_at: null,
    session_id: sessions.editor,
  });
  await as("editor", async () => {
    expect(
      await bool("can_manage_collection('services','executive',$1,'write')", [
        office,
      ]),
    ).toBe(true);
    expect(
      (await db.query("select * from user_office_access")).rows,
    ).toHaveLength(1);
  });
});

test("only privileged server RPCs can mutate reset state; ordinary staff cannot reset another user", async () => {
  for (const role of ["editor", "viewer", "superadmin", "anon"] as const)
    await as(role, async () => {
      await expect(
        db.query("select begin_staff_password_reset($1,$2,$3,$4,$5)", [
          users.superadmin,
          sessions.superadmin,
          users.editor,
          randomUUID(),
          digest,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.exec("select * from staff_password_resets"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.exec("update staff_password_resets set state='complete'"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        db.query("select finish_staff_password_change($1,$2)", [
          users.editor,
          randomUUID(),
        ]),
      ).rejects.toMatchObject({ code: "42501" });
    });
  await as("service_role", async () => {
    expect(
      (await db.query("select * from staff_password_resets")).rows,
    ).toEqual([]);
    await expect(
      db.exec("update staff_password_resets set state='failed'"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.exec("delete from staff_password_resets"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "insert into staff_password_resets(user_id,generation,state,initiated_by) values($1,$2,'issuing',$3)",
        [users.editor, randomUUID(), users.superadmin],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("select begin_staff_password_reset($1,$2,$3,$4,$5)", [
        users.editor,
        sessions.editor,
        users.viewer,
        randomUUID(),
        digest,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("select begin_staff_password_reset($1,$2,$3,$4,$5)", [
        users.superadmin,
        sessions.editor,
        users.editor,
        randomUUID(),
        digest,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("select begin_staff_password_reset($1,$2,$3,$4,$5)", [
        users.superadmin,
        sessions.superadmin,
        users.superadmin,
        randomUUID(),
        digest,
      ]),
    ).rejects.toMatchObject({ code: "22023" });
  });
});

test("issuing a reset immediately blocks existing CMS, storage, membership and tab-session access", async () => {
  const tab = "c".repeat(64);
  await as("editor", async () =>
    expect(await bool("start_staff_session($1)", [tab])).toBe(true),
  );
  const beforeAccess = (
    await db.query(
      "select to_jsonb(a) row from staff_accounts a where user_id=$1",
      [users.editor],
    )
  ).rows;
  const generation = await begin();
  expect(
    (
      await db.query(
        "select to_jsonb(a) row from staff_accounts a where user_id=$1",
        [users.editor],
      )
    ).rows,
  ).toEqual(beforeAccess);
  expect(
    (
      await db.query("select * from staff_browser_sessions where user_id=$1", [
        users.editor,
      ])
    ).rows,
  ).toEqual([]);
  expect(await status("editor")).toMatchObject({
    required: true,
    ready: false,
    generation,
    state: "issuing",
  });
  await as("editor", async () => {
    for (const expression of [
      "can_manage_office($1,'read')",
      "can_manage_office($1,'write')",
      "can_manage_collection('services','executive',$1,'write')",
    ])
      expect(await bool(expression, [office])).toBe(false);
    expect(await bool("can_read_transparency()")).toBe(false);
    expect(await bool("can_manage_transparency()")).toBe(false);
    expect(await bool("start_staff_session($1)", [tab])).toBe(false);
    expect(
      (
        await db.query<{ deadline: number | null }>(
          "select staff_session_deadline($1,true) deadline",
          [tab],
        )
      ).rows[0].deadline,
    ).toBeNull();
    expect(
      (
        await db.query(
          "select id from services where id='reset-private-service'",
        )
      ).rows,
    ).toEqual([]);
    expect((await db.exec("select * from user_office_access"))[0].rows).toEqual(
      [],
    );
    expect(
      (
        await db.query(
          "update services set body='Forbidden' where id='reset-private-service' returning id",
        )
      ).rows,
    ).toEqual([]);
    await expect(
      db.query(
        "insert into services(name,description,body,icon,office,office_id) values('Forbidden','Summary','Body','FileText','Office',$1)",
        [office],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "insert into storage.objects values('municipal-news-staging',$1)",
        [`news/${office}/${users.editor}/photo.webp`],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await db.query("select user_id from staff_accounts where user_id=$1", [
          users.editor,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select id from services where published and office_id is null",
        )
      ).rows.length,
    ).toBeGreaterThan(0);
  });
});

test("temporary reset activation lasts 30 minutes and old or expired sessions cannot claim it", async () => {
  const generation = await begin();
  await activate("editor", generation);
  const times = (
    await db.query<{ duration: number }>(
      "select extract(epoch from expires_at-activated_at) duration from staff_password_resets where user_id=$1",
      [users.editor],
    )
  ).rows[0];
  expect(Number(times.duration)).toBeCloseTo(1800, 1);
  await expect(
    claim("editor", generation, sessions.editor),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    claim("editor", generation, sessions.viewer),
  ).rejects.toMatchObject({ code: "42501" });
  const fresh = await freshSession("editor");
  await db.query(
    "update staff_password_resets set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",
    [users.editor],
  );
  await expect(claim("editor", generation, fresh)).rejects.toMatchObject({
    code: "42501",
  });
  expect(await status("editor", fresh)).toMatchObject({
    required: true,
    ready: false,
    state: "pending",
  });
});

test("replacement invalidates generation and rejects stale completion, while operations cannot overlap", async () => {
  const oldGeneration = await begin();
  await expect(begin()).rejects.toMatchObject({ code: "55000" });
  await activate("editor", oldGeneration);
  const oldTemporarySession = await freshSession("editor");
  const newGeneration = await begin();
  await as(
    "service_role",
    async () =>
      await expect(
        db.query("select activate_staff_password_reset($1,$2)", [
          users.editor,
          oldGeneration,
        ]),
      ).rejects.toMatchObject({ code: "55000" }),
  );
  await activate("editor", newGeneration);
  await expect(
    claim("editor", oldGeneration, oldTemporarySession),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    claim("editor", newGeneration, oldTemporarySession),
  ).rejects.toMatchObject({ code: "42501" });
  const current = await freshSession("editor");
  expect(await claim("editor", newGeneration, current)).toBe(true);
  await expect(begin()).rejects.toMatchObject({ code: "55000" });
  await expect(finish("editor", oldGeneration)).rejects.toMatchObject({
    code: "42501",
  });
  // An Auth request accepted before expiry may complete after that deadline.
  await db.query(
    "update staff_password_resets set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",
    [users.editor],
  );
  expect(await finish("editor", newGeneration)).toBe(true);
});

test("completion clears the digest, audits actor/target and blocks all old and refreshed JWTs", async () => {
  const originalAccess = (
    await db.query(
      "select office_id,permission_level from user_office_access where user_id=$1",
      [users.editor],
    )
  ).rows;
  const generation = await begin();
  await activate("editor", generation);
  const temporarySession = await freshSession("editor");
  expect(await claim("editor", generation, temporarySession)).toBe(true);
  expect(await finish("editor", generation)).toBe(true);
  expect(
    (
      await db.query(
        "select temp_password_hash,state from staff_password_resets where user_id=$1",
        [users.editor],
      )
    ).rows,
  ).toEqual([{ temp_password_hash: null, state: "complete" }]);
  for (const stale of [sessions.editor, temporarySession]) {
    expect(await status("editor", stale)).toMatchObject({
      required: false,
      ready: false,
      state: "complete",
    });
    await as(
      "editor",
      async () => {
        await db.query("select set_config('request.jwt.claims',$1,false)", [
          JSON.stringify({
            sub: users.editor,
            session_id: stale,
            iat: Math.floor(Date.now() / 1000) + 10000,
          }),
        ]);
        expect(await bool("can_manage_office($1,'write')", [office])).toBe(
          false,
        );
        expect(
          (
            await db.query(
              "select id from services where id='reset-private-service'",
            )
          ).rows,
        ).toEqual([]);
      },
      stale,
    );
  }
  const nextLogin = await freshSession("editor");
  expect(await status("editor", nextLogin)).toMatchObject({
    required: false,
    ready: true,
    state: "complete",
  });
  await as(
    "editor",
    async () => {
      expect(await bool("can_manage_office($1,'write')", [office])).toBe(true);
      expect(
        (
          await db.query(
            "select office_id,permission_level from user_office_access where user_id=$1",
            [users.editor],
          )
        ).rows,
      ).toEqual(originalAccess);
      expect(await bool("start_staff_session($1)", ["d".repeat(64)])).toBe(
        true,
      );
    },
    nextLogin,
  );
  const audit = (
    await db.query<{
      user_id: string;
      action: string;
      entity_id: string;
      description: string;
    }>(
      "select user_id,action,entity_id,description from audit_logs where action in ('password_reset_started','password_reset_completed') and entity_id=$1 order by id desc limit 2",
      [users.editor],
    )
  ).rows;
  expect(audit.map((r) => [r.user_id, r.action, r.entity_id])).toEqual([
    [users.editor, "password_reset_completed", users.editor],
    [users.superadmin, "password_reset_started", users.editor],
  ]);
  expect(JSON.stringify(audit)).not.toContain(digest);
  await db.query("delete from auth.sessions where id=$1", [nextLogin]);
  expect(await status("editor", nextLogin)).toMatchObject({ ready: false });
});

test("reset never enables disabled staff and disabling during reset blocks completion", async () => {
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.editor,
  ]);
  await expect(begin()).rejects.toMatchObject({ code: "22023" });
  expect(
    (
      await db.query("select active from staff_accounts where user_id=$1", [
        users.editor,
      ])
    ).rows,
  ).toEqual([{ active: false }]);
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.editor,
  ]);
  const generation = await begin();
  await activate("editor", generation);
  const fresh = await freshSession("editor");
  expect(await claim("editor", generation, fresh)).toBe(true);
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.editor,
  ]);
  await expect(finish("editor", generation)).rejects.toMatchObject({
    code: "42501",
  });
  expect(
    (
      await db.query("select active from staff_accounts where user_id=$1", [
        users.editor,
      ])
    ).rows,
  ).toEqual([{ active: false }]);
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.editor,
  ]);
});

test("a resetting Superadmin loses admin RPCs and all privileged policy paths", async () => {
  const legislative = (
    await db.query<{ id: string }>(
      "select id from departments where department='legislative' and active and archived_at is null",
    )
  ).rows[0].id;
  const paths = [
    ["can_upload_news($1)", `news/${office}/${users.superadmin}/photo.webp`],
    [
      "can_upload_legislative_pdf($1)",
      `legislative/${legislative}/${users.superadmin}/ordinances/${randomUUID()}.pdf`,
    ],
    [
      "can_upload_transparency_pdf($1)",
      `transparency/${users.superadmin}/${randomUUID()}.pdf`,
    ],
  ];
  await as("superadmin", async () => {
    for (const [fn, path] of paths) expect(await bool(fn, [path])).toBe(true);
    expect(
      await bool("can_manage_content('legislative',$1,'write')", [legislative]),
    ).toBe(true);
  });
  await as("service_role", async () =>
    expect(
      await bool("begin_staff_password_reset($1,$2,$3,$4,$5)", [
        users.otherAdmin,
        sessions.otherAdmin,
        users.superadmin,
        randomUUID(),
        digest,
      ]),
    ).toBe(true),
  );
  await as("superadmin", async () => {
    expect(await bool("is_superadmin()")).toBe(false);
    expect(await bool("can_read_transparency()")).toBe(false);
    expect(
      await bool("can_manage_content('legislative',$1,'write')", [legislative]),
    ).toBe(false);
    for (const [fn, path] of paths) expect(await bool(fn, [path])).toBe(false);
    for (const table of [
      "officials",
      "ordinances",
      "resolutions",
      "news",
      "sessions",
      "services",
      "departments",
      "programs",
      "committees",
      "hearings",
      "document_categories",
      "municipal_documents",
      "department_contacts",
    ])
      for (const operation of ["read", "create", "write", "delete"])
        expect(
          await bool("can_manage_collection($1,'legislative',$2,$3)", [
            table,
            legislative,
            operation,
          ]),
        ).toBe(false);
    expect((await db.query("select * from audit_logs")).rows).toEqual([]);
    expect((await db.query("select * from committee_master")).rows).toEqual([]);
    await expect(
      db.query(
        "select manage_staff($1,'superadmin',true,'Forged','[]'::jsonb)",
        [users.viewer],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("insert into committee_master(name) values('Forbidden')"),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await db.query(
          "update municipal_contact_settings set telephone='Forbidden' returning id",
        )
      ).rows,
    ).toEqual([]);
  });
  await as(
    "service_role",
    async () =>
      await expect(
        db.query("select begin_staff_password_reset($1,$2,$3,$4,$5)", [
          users.superadmin,
          sessions.superadmin,
          users.editor,
          randomUUID(),
          digest,
        ]),
      ).rejects.toMatchObject({ code: "42501" }),
  );
});

test("definitive external failures stay locked until a replacement reset and normal account changes serialize too", async () => {
  const generation = await begin();
  await as("service_role", async () =>
    expect(
      await bool("fail_staff_password_reset($1,$2)", [
        users.editor,
        generation,
      ]),
    ).toBe(true),
  );
  expect(await status("editor")).toMatchObject({
    required: true,
    ready: false,
    state: "failed",
  });
  const next = await begin();
  expect(next).not.toBe(generation);
  await as(
    "service_role",
    async () =>
      await expect(
        db.query("select fail_staff_password_reset($1,$2)", [
          users.editor,
          generation,
        ]),
      ).rejects.toMatchObject({ code: "55000" }),
  );
  await db.exec("delete from staff_password_resets");
  const ownChange = randomUUID();
  await as("service_role", async () =>
    expect(
      await bool("begin_staff_password_update($1,$2,$3,$4)", [
        users.editor,
        sessions.editor,
        ownChange,
        null,
      ]),
    ).toBe(true),
  );
  expect(await status("editor")).toMatchObject({
    required: true,
    ready: false,
    state: "completing",
  });
  await expect(begin()).rejects.toMatchObject({ code: "55000" });
  expect(await finish("editor", ownChange)).toBe(true);
  expect(
    (
      await db.query(
        "select action from audit_logs where entity_id=$1 order by id desc limit 1",
        [users.editor],
      )
    ).rows,
  ).toEqual([{ action: "password_changed" }]);
});
