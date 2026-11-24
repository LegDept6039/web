import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { normalizeUsername } from "../../lib/auth/username";
import { passwordError } from "../../lib/auth/diagnostics";

function moduleExports(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, (...args: never[]) => unknown> = {};
  runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Error,
      require(name: string) {
        if (!(name in dependencies))
          throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
      },
    },
  );
  return exports;
}

const userId = "00000000-0000-4000-8000-000000000001";
const identity = { userId, email: "private-auth-id@example.invalid" };

test("username validation canonicalizes case and rejects email and malformed names", () => {
  expect(normalizeUsername("  Council.Editor_1-2  ")).toBe(
    "council.editor_1-2",
  );
  expect(normalizeUsername("a".repeat(40))).toHaveLength(40);
  for (const input of [
    null,
    "",
    "ab",
    "a".repeat(41),
    "a@example.com",
    "_staff",
    "staff name",
    "stáff",
    "a/b",
  ])
    expect(() => normalizeUsername(input)).toThrow("Use 3 to 40 characters");
});

test("the private username resolver uses only the exact canonical account mapping", async () => {
  const requests: unknown[] = [];
  let row: unknown = {
    user_id: userId,
    username: "staff.editor",
    email: identity.email,
  };
  let error: unknown = null;
  const query = {
    select: (columns: string) => {
      requests.push(columns);
      return query;
    },
    eq: (key: string, value: string) => {
      requests.push([key, value]);
      return query;
    },
    maybeSingle: async () => ({ data: row, error }),
  };
  const loaded = moduleExports("lib/auth/username-server.ts", {
    "server-only": {},
    "./username": { normalizeUsername },
    "./admin": {
      authAdminClient: () => ({
        from: (table: string) => {
          requests.push(table);
          return query;
        },
      }),
    },
  });
  const resolve = loaded.usernameIdentity as unknown as (
    name: string,
  ) => Promise<unknown>;
  expect(await resolve("  STAFF.Editor ")).toEqual(identity);
  expect(requests).toEqual([
    "staff_accounts",
    "user_id,username,email",
    ["username", "staff.editor"],
  ]);
  row = null;
  expect(await resolve("staff.editor")).toBeNull();
  row = { user_id: userId, username: "different", email: identity.email };
  expect(await resolve("staff.editor").catch((error) => error.message)).toBe(
    "Staff sign-in lookup is unavailable.",
  );
  error = { message: `Do not expose ${identity.email}` };
  expect(await resolve("staff.editor").catch((error) => error.message)).toBe(
    "Staff sign-in lookup is unavailable.",
  );
});

async function attempt(options: {
  username?: string;
  identity?: typeof identity | null;
  lookupError?: boolean;
  authenticatedId?: string;
}) {
  const calls: { passwords: unknown[]; names: string[]; signedOut: boolean } = {
    passwords: [],
    names: [],
    signedOut: false,
  };
  const loaded = moduleExports("app/login/actions.ts", {
    "@/lib/auth/username": { normalizeUsername },
    "@/lib/auth/username-server": {
      usernameIdentity: async (name: string) => {
        calls.names.push(name);
        if (options.lookupError) throw new Error("private service detail");
        return options.identity ?? null;
      },
    },
    "@/lib/auth/server": {
      authClient: async () => ({
        auth: {
          signInWithPassword: async (input: unknown) => {
            calls.passwords.push(input);
            return options.authenticatedId
              ? {
                  data: { user: { id: options.authenticatedId }, session: {} },
                  error: null,
                }
              : {
                  data: {},
                  error: { code: "invalid_credentials", status: 400 },
                };
          },
          signOut: async () => {
            calls.signedOut = true;
          },
        },
      }),
    },
    "@/lib/auth/session-policy": { validTabToken: () => true },
    "@/lib/auth/diagnostics": {
      authDiagnostic: () => undefined,
      errorCode: () => undefined,
      passwordError,
    },
    "@/lib/auth/password-reset": {},
    "@/lib/auth/password-reset-crypto": {},
    "@/lib/auth/staff-session": {},
    "@/lib/auth/config": {},
    "@/lib/auth/resolve-staff": {},
    "next/navigation": {},
    "next/headers": {},
  });
  const form = new FormData();
  form.set("username", options.username ?? " STAFF.Editor ");
  form.set("password", "incorrect-password");
  const login = loaded.login as unknown as (
    previous: string,
    form: FormData,
  ) => Promise<string>;
  return { message: await login("", form), ...calls };
}

test("unknown usernames and wrong passwords use the password endpoint with the same public error", async () => {
  const wrong = await attempt({ identity });
  const unknown = await attempt({});
  expect(wrong.names).toEqual(["staff.editor"]);
  expect(wrong.passwords).toEqual([
    { email: identity.email, password: "incorrect-password" },
  ]);
  expect(unknown.passwords).toEqual([
    {
      email: "unknown-staff@staff.pinamungajan.invalid",
      password: "incorrect-password",
    },
  ]);
  expect(wrong.message).toBe(
    "Unable to sign in. Invalid username or password.",
  );
  expect(unknown.message).toBe(wrong.message);
  expect(wrong.message).not.toContain(identity.email);
});

test("username sign-in fails closed on mismatched Auth identities or lookup failure", async () => {
  for (const account of [identity, null]) {
    const result = await attempt({
      identity: account,
      authenticatedId: "different-auth-id",
    });
    expect(result.signedOut).toBe(true);
    expect(result.message).toBe(
      "Unable to sign in. Invalid username or password.",
    );
  }
  const unavailable = await attempt({ lookupError: true });
  expect(unavailable.passwords).toEqual([]);
  expect(unavailable.message).toBe(
    "The sign-in service is unavailable. Please try again later.",
  );
  const email = await attempt({ username: "staff@example.com" });
  expect(email.names).toEqual([]);
  expect(email.passwords).toEqual([]);
  expect(email.message).toBe("Enter your username and password.");
});
