import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { STAFF_IDLE_MS, validTabToken } from "../../lib/auth/session-policy";
const owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
test("session expiry, ownership, revocation and direct table protection", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; grant usage on schema auth to authenticated;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.staff_accounts(user_id uuid primary key,active boolean,deleted_at timestamptz);
 insert into auth.users values('${owner}'),('${other}');
 insert into staff_accounts values('${owner}',true,null),('${other}',true,null);`);
    await db.exec(
      readFileSync(
        "supabase/migrations/202611050013_staff_sessions.sql",
        "utf8",
      ),
    );
    async function as(id: string) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    }
    const hash = "a".repeat(64);
    async function deadline(touch = false) {
      return (
        await db.query<{ value: number }>(
          "select staff_session_deadline($1,$2) as value",
          [hash, touch],
        )
      ).rows[0].value;
    }
    await as(owner);
    await db.query("select start_staff_session($1)", [hash]);
    expect(await deadline()).toBeGreaterThan(STAFF_IDLE_MS - 10000);
    await expect(
      db.exec("select * from staff_browser_sessions"),
    ).rejects.toThrow();
    await expect(
      db.exec(
        "update staff_browser_sessions set expires_at=now()+interval '1 year'",
      ),
    ).rejects.toThrow();
    await db.exec(
      "reset role; update staff_browser_sessions set expires_at=clock_timestamp()+interval '10 seconds'",
    );
    await as(owner);
    expect(await deadline()).toBeLessThan(11000);
    expect(await deadline(true)).toBeGreaterThan(STAFF_IDLE_MS - 10000);
    await as(other);
    expect(await deadline(true)).toBe(0);
    await db.query("select end_staff_session($1)", [hash]);
    await as(owner);
    expect(await deadline()).toBeGreaterThan(0);
    await db.exec("reset role");
    await db.exec(
      "update staff_browser_sessions set expires_at=clock_timestamp()-interval '1 second'",
    );
    await as(owner);
    expect(await deadline()).toBe(0);
    expect(await deadline(true)).toBe(0);
    await db.query("select start_staff_session($1)", [hash]);
    await db.query("select end_staff_session($1)", [hash]);
    expect(await deadline()).toBe(0);
    await db.exec("reset role; update staff_accounts set active=false");
    await as(owner);
    expect(
      (
        await db.query<{ value: boolean }>(
          "select start_staff_session($1) as value",
          [hash],
        )
      ).rows[0].value,
    ).toBe(false);
    await db.exec("reset role; set role anon");
    await expect(
      db.query("select start_staff_session($1)", [hash]),
    ).rejects.toThrow();
    expect(validTabToken(hash)).toBe(true);
    expect(validTabToken("forged")).toBe(false);
  } finally {
    await db.close();
  }
});
