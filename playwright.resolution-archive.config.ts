import { defineConfig } from "@playwright/test";
import base from "./playwright.administration.config";

const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");

export default defineConfig({
  ...base,
  testMatch: ["resolution-archive.spec.ts"],
  testIgnore: ["**/data/**"],
  outputDir: "test-results/resolution-archive",
  use: { ...base.use, baseURL: "http://127.0.0.1:3041" },
  webServer: {
    ...server,
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3041",
    url: "http://127.0.0.1:3041/legislative/resolutions",
    env: {
      ...server.env,
      PORTAL_RESOLUTION_ARCHIVE_TEST_FIXTURE: "1",
      RESOLUTION_ARCHIVE_FIXTURE_STATE: "tmp/resolution-archive-state.json",
      RESOLUTION_ARCHIVE_FIXTURE_LOG: "tmp/resolution-archive-requests.jsonl",
      NODE_OPTIONS: "--import=./tests/fixtures/resolution-archive.mjs",
    },
  },
});
