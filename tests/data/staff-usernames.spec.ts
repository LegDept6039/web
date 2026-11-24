import { expect, test } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

test.describe.configure({ mode: "serial" });
const migration = "202611230033_staff_usernames.sql";
const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
const users = {
  superadmin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  viewer: "00000000-0000-4000-8000-000000000003",
  inactive: "00000000-0000-4000-8000-000000000004",
  deleted: "00000000-0000-4000-8000-000000000005",
  reset: "00000000-0000-4000-8000-000000000006",
  reserved: "00000000-0000-4000-8000-000000000007",
  collision: "00000000-0000-4000-8000-000000000008",
  truncated: "00000000-0000-4000-8000-000000000009",
  empty: "00000000-0000-4000-8000-000000000010",
};
type Staff = keyof typeof users;
const sessions = Object.fromEntries(
  Object.keys(users).map((key) => [key, randomUUID()]),
) as Record<Staff, string>;
const fallback = (id: string) => `staff-${id.replaceAll("-", "")}`;
let db: PGlite;
let office: string;
let before: Awaited<ReturnType<typeof snapshot>>;

async function as<T>(
  role: Staff | "anon" | "service_role",
  run: () => Promise<T>,
) {
  const staff = role !== "anon" && role !== "service_role" ? role : null;
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [
      staff ? users[staff] : "",
      JSON.stringify(
        staff ? { sub: users[staff], session_id: sessions[staff] } : {},
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
async function rows(table: string) {
  return (
    await db.query(
      `select to_jsonb(r) row from ${table} r order by to_jsonb(r)::text`,
    )
  ).rows;
}
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of [
    "auth.users",
    "auth.sessions",
    "user_office_access",
    "staff_password_resets",
    "staff_browser_sessions",
    "departments",
    "news",
    "barangays",
    "sk_profiles",
    "sessions",
    "officials",
  ])
    result[table] = await rows(table);
  result.staff = (
    await db.query(
      "select to_jsonb(a)-array['username','updated_at'] row from staff_accounts a order by user_id",
    )
  ).rows;
  return result;
}
async function account(id = users.editor) {
  return (
    await db.query<Record<string, unknown>>(
      "select to_jsonb(a) row from staff_accounts a where user_id=$1",
      [id],
    )
  ).rows[0];
}
async function manage(
  target: Staff,
  username: string | null,
  role = "editor",
  access = [{ office_id: office, permission_level: "editor" }],
) {
  return db.query(
    "select manage_staff_account($1,$2,true,'Updated staff',$3::jsonb,$4,false,true)",
    [users[target], role, JSON.stringify(access), username],
  );
}

test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema auth to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text,encrypted_password text,raw_user_meta_data jsonb);
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
  const emails: Record<Staff, string> = {
    superadmin: "SUPERADMIN@one.test",
    editor: "Alex@one.test",
    viewer: "alex@two.test",
    inactive: "inactive@example.test",
    deleted: "名@example.test",
    reset: "a@example.test",
    reserved: `${fallback(users.superadmin)}@example.test`,
    collision: `alex-${users.editor.replaceAll("-", "")}@example.test`,
    truncated: `${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(3)}@example.test`,
    empty: "",
  };
  for (const [key, id] of Object.entries(users)) {
    const name = key as Staff;
    await db.query("insert into auth.users values($1,$2,$3,$4::jsonb)", [
      id,
      emails[name],
      `retained-password-${name}`,
      '{"username":"forged-admin","role":"superadmin"}',
    ]);
    await db.query(
      "insert into auth.sessions values($1,$2,clock_timestamp()-interval '1 hour')",
      [sessions[name], id],
    );
    await db.query(
      "update staff_accounts set display_name=$1,role=$2,active=$3,deleted_at=case when $4 then now() else null end where user_id=$5",
      [
        name,
        name === "superadmin" ? name : name === "viewer" ? "viewer" : "editor",
        !["inactive", "deleted"].includes(name),
        name === "deleted",
        id,
      ],
    );
  }
  office = (
    await db.query<{ id: string }>(
      "select id from departments where slug='municipal-health' union all select department_id from department_slug_aliases where slug='municipal-health' limit 1",
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
    await db.query("select start_staff_session($1)", ["e".repeat(64)]);
  });
  await db.query(
    `insert into staff_password_resets(user_id,generation,state,initiated_by,temp_password_hash,activated_at,expires_at)
    values($1,$2,'pending',$3,$4,clock_timestamp(),clock_timestamp()+interval '30 minutes')`,
    [users.reset, randomUUID(), users.superadmin, "a".repeat(64)],
  );
  before = await snapshot();
});
test.afterAll(async () => await db.close());

test("incremental migration preserves Auth identities, access, reset state, sessions and content", async () => {
  const audit = await rows("audit_logs");
  await db.exec(sql);
  expect(await snapshot()).toEqual(before);
  const auditAfter = await rows("audit_logs");
  for (const row of audit) expect(auditAfter).toContainEqual(row);
  const names = (
    await db.query<{ user_id: string; username: string }>(
      "select user_id,username from staff_accounts order by user_id",
    )
  ).rows;
  const name = (user: Staff) =>
    names.find((n) => n.user_id === users[user])?.username;
  expect(new Set(names.map((n) => n.username)).size).toBe(names.length);
  expect(name("superadmin")).toBe("superadmin");
  // An adversarial original base reserves the first generated suffix.
  expect(name("editor")).toBe(fallback(users.editor));
  expect(name("viewer")).toBe(`alex-${users.viewer.replaceAll("-", "")}`);
  expect(name("collision")).toBe(`alex-${users.editor.replaceAll("-", "")}`);
  for (const role of ["deleted", "reset", "reserved", "empty"] as const)
    expect(name(role)).toBe(fallback(users[role]));
  expect(name("truncated")).toBe("abcdefghijklmnopqrstuvwxyzabcdefghijklmn");
  for (const row of names)
    expect(row.username).toMatch(/^[a-z0-9][a-z0-9._-]{2,39}$/);
});

test("username resolution stays private and clients cannot assign or rename accounts", async () => {
  await as("anon", async () => {
    await expect(
      db.query("select username,email from staff_accounts"),
    ).rejects.toThrow(/permission denied/);
    await expect(manage("editor", "forged-name")).rejects.toThrow(
      /permission denied/,
    );
  });
  for (const user of [
    "editor",
    "viewer",
    "inactive",
    "deleted",
    "reset",
  ] as const)
    await as(user, async () => {
      expect(
        (await db.query("select user_id,username from staff_accounts")).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            "select user_id from staff_accounts where user_id<>auth.uid()",
          )
        ).rows,
      ).toEqual([]);
      await expect(
        db.query(
          "update staff_accounts set username='forged-name' where user_id=auth.uid()",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(manage(user, "forged-name")).rejects.toThrow(
        /Superadmin access required/,
      );
    });
  await as("service_role", async () => {
    const result = await db.query(
      "select user_id,email from staff_accounts where username='superadmin'",
    );
    expect(result.rows).toEqual([
      { user_id: users.superadmin, email: "SUPERADMIN@one.test" },
    ]);
    await expect(manage("editor", "forged-service-name")).rejects.toThrow(
      /permission denied/,
    );
  });
  await as("superadmin", async () => {
    expect(
      (await db.query("select user_id from staff_accounts")).rows,
    ).toHaveLength(Object.keys(users).length);
  });
});

test("Superadmin account edits update username and access atomically and audit the rename", async () => {
  const authBefore = await rows("auth.users");
  const resetBefore = await rows("staff_password_resets");
  const browserBefore = await rows("staff_browser_sessions");
  await as("superadmin", async () => {
    await manage("editor", "renamed.editor");
  });
  const updated = (await account()).row as Record<string, unknown>;
  expect(updated).toMatchObject({
    username: "renamed.editor",
    role: "editor",
    active: true,
    transparency_access: true,
  });
  expect(await rows("auth.users")).toEqual(authBefore);
  expect(await rows("staff_password_resets")).toEqual(resetBefore);
  expect(await rows("staff_browser_sessions")).toEqual(browserBefore);
  expect(
    (
      await db.query(
        "select action,entity_id,user_id,description from audit_logs where action='username_changed'",
      )
    ).rows,
  ).toEqual([
    {
      action: "username_changed",
      entity_id: users.editor,
      user_id: users.superadmin,
      description: `Staff username changed from ${fallback(users.editor)} to renamed.editor`,
    },
  ]);
  const preserved = await account();
  const access = await rows("user_office_access");
  const audit = await rows("audit_logs");
  await as("superadmin", async () => {
    await expect(manage("editor", "superadmin", "admin", [])).rejects.toThrow(
      /unique constraint/,
    );
    for (const name of [
      null,
      "",
      "ab",
      "WrongCase",
      "name@example.test",
      "a".repeat(41),
      fallback(users.viewer),
    ])
      await expect(manage("editor", name, "admin", [])).rejects.toThrow(
        /username/,
      );
    await expect(
      manage("superadmin", "renamed-root", "editor", []),
    ).rejects.toThrow(/own superadmin access/);
    await expect(
      db.query(
        "select manage_staff_account($1,'editor',true,'Unknown','[]','unknown-name')",
        [randomUUID()],
      ),
    ).rejects.toThrow(/Account not found/);
  });
  expect(await account()).toEqual(preserved);
  expect(await rows("user_office_access")).toEqual(access);
  expect(await rows("audit_logs")).toEqual(audit);
  await as("superadmin", async () => {
    await db.query(
      "select manage_staff($1,'editor',true,'Legacy editor',$2::jsonb,false,true)",
      [
        users.editor,
        JSON.stringify([{ office_id: office, permission_level: "editor" }]),
      ],
    );
  });
  expect(((await account()).row as Record<string, unknown>).username).toBe(
    "renamed.editor",
  );
});

test("Auth provisioning ignores mutable metadata and email changes retain the assigned username", async () => {
  const fresh = randomUUID();
  await db.query(
    "insert into auth.users values($1,'private-auth@example.invalid','unchanged-hash',$2::jsonb)",
    [fresh, '{"username":"superadmin","role":"superadmin","active":true}'],
  );
  expect((await account(fresh)).row).toMatchObject({
    username: fallback(fresh),
    role: "viewer",
    active: false,
  });
  const assigned = (await account()).row as Record<string, unknown>;
  await db.query(
    "update auth.users set email='changed@example.invalid',raw_user_meta_data=$1::jsonb where id=$2",
    ['{"username":"forged-rename"}', users.editor],
  );
  expect((await account()).row).toMatchObject({
    username: assigned.username,
    role: assigned.role,
    active: assigned.active,
    display_name: assigned.display_name,
    email: "changed@example.invalid",
  });
  await db.exec("grant update on staff_accounts to service_role");
  await as("service_role", async () => {
    await expect(
      db.query(
        "update staff_accounts set username='service-rename' where user_id=$1",
        [users.editor],
      ),
    ).rejects.toThrow(/Superadmin access required/);
  });
  await db.exec("revoke update on staff_accounts from service_role");
});

test("revoked Superadmin credentials cannot rename an account", async () => {
  const saved = await account();
  await db.query("update staff_accounts set active=false where user_id=$1", [
    users.superadmin,
  ]);
  await as("superadmin", async () => {
    await expect(manage("editor", "revoked-rename")).rejects.toThrow(
      /Superadmin access required/,
    );
  });
  await db.query("update staff_accounts set active=true where user_id=$1", [
    users.superadmin,
  ]);
  await db.query(
    `insert into staff_password_resets(user_id,generation,state,initiated_by,temp_password_hash,activated_at,expires_at)
    values($1,$2,'pending',$1,$3,clock_timestamp(),clock_timestamp()+interval '30 minutes')`,
    [users.superadmin, randomUUID(), "b".repeat(64)],
  );
  await as("superadmin", async () => {
    await expect(manage("editor", "reset-rename")).rejects.toThrow(
      /Superadmin access required/,
    );
  });
  expect(await account()).toEqual(saved);
});
