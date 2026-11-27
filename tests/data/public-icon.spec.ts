import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("public tab icon stays small enough to decode without blocking navigation", () => {
  const icon = readFileSync("app/icon.png");
  expect(icon.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(icon.subarray(12, 16).toString("ascii")).toBe("IHDR");
  expect(icon.readUInt32BE(16)).toBeLessThanOrEqual(128);
  expect(icon.readUInt32BE(20)).toBeLessThanOrEqual(128);
  expect(icon.byteLength).toBeLessThan(50_000);
});
