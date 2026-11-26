import { defineConfig } from "@playwright/test";
import base from "./playwright.administration.config";

const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");

export default defineConfig({
  ...base,
  testMatch: ["session-detail.spec.ts"],
  outputDir: "test-results/session-detail",
  use: { ...base.use, baseURL: "http://127.0.0.1:3037" },
  webServer: {
    ...server,
    env: { ...server.env, PORTAL_SESSION_DETAIL_TEST_FIXTURE: "1" },
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3037",
    url: "http://127.0.0.1:3037/legislative/sessions",
  },
});
