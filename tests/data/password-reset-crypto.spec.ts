import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  equalDigest,
  passwordDigest,
  signResetProof,
  temporaryPassword,
  verifyResetProof,
  type ResetProof,
} from "../../lib/auth/password-reset-crypto";

const key = "unit-test-only-reset-proof-key";
const proof: ResetProof = {
  userId: "10000000-0000-4000-8000-000000000001",
  generation: "20000000-0000-4000-8000-000000000002",
  sessionId: "30000000-0000-4000-8000-000000000003",
  expiresAt: "2026-11-20T12:30:00.000Z",
};

// Synthetic signing lets validation tests isolate payload shape from MAC checks.
// No environment credentials, account passwords or real sessions are read.
function signedPayload(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("hex")}`;
}

test("temporary passwords satisfy the password policy and use independent random values", () => {
  const passwords = Array.from({ length: 256 }, temporaryPassword);
  expect(new Set(passwords).size).toBe(passwords.length);
  expect(
    passwords.every(
      (password) =>
        password.length >= 12 &&
        password.length <= 128 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password) &&
        !/\s/.test(password),
    ),
  ).toBe(true);
});

test("password digests are SHA-256 and equality rejects malformed or unequal values", () => {
  expect(passwordDigest("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const digest = passwordDigest("unit-test-password");
  expect(/^[a-f0-9]{64}$/.test(digest)).toBe(true);
  expect(equalDigest(digest, passwordDigest("unit-test-password"))).toBe(true);
  expect(equalDigest(digest, passwordDigest("another-test-password"))).toBe(
    false,
  );
  for (const invalid of [
    "",
    "a".repeat(63),
    "a".repeat(65),
    "g".repeat(64),
    digest.toUpperCase(),
    `${digest}\n`,
  ]) {
    expect(equalDigest(digest, invalid)).toBe(false);
    expect(equalDigest(invalid, digest)).toBe(false);
  }
});

test("signed reset proofs round-trip and bind the user, generation, session and expiry", () => {
  const signed = signResetProof(proof, key);
  expect(verifyResetProof(signed, key)).toEqual(proof);
  expect(verifyResetProof(signed, "different-unit-test-key")).toBeNull();

  const signature = signed.split(".")[1];
  const replacements: ResetProof = {
    userId: "40000000-0000-4000-8000-000000000004",
    generation: "50000000-0000-4000-8000-000000000005",
    sessionId: "60000000-0000-4000-8000-000000000006",
    expiresAt: "2026-11-20T13:30:00.000Z",
  };
  for (const field of Object.keys(replacements) as (keyof ResetProof)[]) {
    const edited = { ...proof, [field]: replacements[field] };
    const payload = Buffer.from(JSON.stringify(edited)).toString("base64url");
    expect(verifyResetProof(`${payload}.${signature}`, key)).toBeNull();
  }
});

test("proof verification rejects malformed, extra, oversized or tampered token parts", () => {
  const signed = signResetProof(proof, key);
  const [payload, signature] = signed.split(".");
  const changedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  const invalid = [
    "",
    ".",
    payload,
    `${payload}.`,
    `.${signature}`,
    `${payload}.${changedSignature}`,
    `${payload}.${signature.toUpperCase()}`,
    `${signed}.extra`,
    `${signed}.`,
    `${signed}..`,
    "x".repeat(2001),
  ];
  for (const value of invalid) {
    // Assert the result only, so a failure cannot print a token or password.
    expect(verifyResetProof(value, key) === null).toBe(true);
  }
  const badJson = Buffer.from("not JSON").toString("base64url");
  const mac = createHmac("sha256", key).update(badJson).digest("hex");
  expect(verifyResetProof(`${badJson}.${mac}`, key)).toBeNull();
});

test("signed payloads still require valid UUID strings and a valid string expiry", () => {
  const invalidPayloads: unknown[] = [null, [], true, 123, "value", {}];
  for (const field of ["userId", "generation", "sessionId"] as const) {
    for (const invalid of [null, undefined, 123, {}, [], "", "not-a-uuid"]) {
      invalidPayloads.push({ ...proof, [field]: invalid });
    }
  }
  for (const invalid of [null, undefined, 123, {}, [], "", "not-a-date"]) {
    invalidPayloads.push({ ...proof, expiresAt: invalid });
  }
  for (const value of invalidPayloads) {
    expect(verifyResetProof(signedPayload(value), key)).toBeNull();
  }
});
