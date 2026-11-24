import { test, expect } from "@playwright/test";
import {
  databaseMessage,
  passwordError,
  errorCode,
} from "../../lib/auth/diagnostics";

test("diagnostics retain database errors while removing credential-shaped content", () => {
  const result = databaseMessage({
    code: "42501",
    message:
      "permission denied for table staff_accounts; Bearer sensitive-token sb_secret_privatevalue abcdefghijkl.abcdefghijkl.signature test@example.test password=private https://example.test?secret=hidden",
  });
  expect(result).toContain("permission denied for table staff_accounts");
  for (const secret of [
    "sensitive-token",
    "privatevalue",
    "abcdefghijkl",
    "test@example.test",
    "password=private",
    "secret=hidden",
  ])
    expect(result).not.toContain(secret);
  expect(
    databaseMessage({ message: "an arbitrary transport payload" }),
  ).toBeUndefined();
});

test("authentication failures preserve distinct Supabase error meanings", () => {
  expect(passwordError({ code: "invalid_credentials" })).toContain(
    "Invalid username or password",
  );
  expect(passwordError({ code: "email_not_confirmed" })).toContain(
    "Ask your administrator",
  );
  expect(passwordError({ code: "over_request_rate_limit" })).toContain(
    "Too many",
  );
});

test("session recovery only targets terminal refresh errors and this project's session cookies", async () => {
  const { invalidRefreshToken, sessionCookieName } =
    await import("../../lib/auth/session-cookies");
  expect(invalidRefreshToken({ code: "refresh_token_not_found" })).toBe(true);
  expect(invalidRefreshToken({ code: "refresh_token_already_used" })).toBe(
    true,
  );
  for (const error of [
    { status: 503 },
    { code: "invalid_credentials" },
    new Error("network"),
    null,
  ])
    expect(invalidRefreshToken(error)).toBe(false);
  for (const name of [
    "sb-project-auth-token",
    "sb-project-auth-token.0",
    "sb-project-auth-token.12",
  ])
    expect(sessionCookieName("https://project.supabase.co", name)).toBe(true);
  for (const name of [
    "sb-other-auth-token",
    "sb-project-auth-token-code-verifier",
    "sb-project-auth-token.other",
  ])
    expect(sessionCookieName("https://project.supabase.co", name)).toBe(false);
});

test("network failures are distinct from rejected credentials and missing codes stay absent", () => {
  for (const code of [undefined, null, "undefined", "null", 0])
    expect(errorCode({ code })).toBeUndefined();
  expect(errorCode({ code: "invalid_credentials" })).toBe(
    "invalid_credentials",
  );
  expect(
    passwordError({
      status: 0,
      code: undefined,
      name: "AuthRetryableFetchError",
    }),
  ).toContain("Unable to reach");
  expect(passwordError({ status: 0 })).not.toContain("undefined");
  expect(passwordError({ status: 503 })).toContain("temporarily unavailable");
  expect(passwordError({ status: 400, code: "invalid_credentials" })).toContain(
    "Invalid username or password",
  );
});
