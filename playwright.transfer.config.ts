import { defineConfig } from "@playwright/test";
import base from "./playwright.terms.config";

const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");

export default defineConfig({
  ...base,
  testMatch: ["legislative-transfer.spec.ts"],
  outputDir: "test-results/legislative-transfer",
  use: { ...base.use, baseURL: "http://127.0.0.1:3019" },
  webServer: {
    ...server,
    env: { ...server.env, PORTAL_TRANSFER_TEST_FIXTURE: "1" },
    command: "npm run start -- --hostname 127.0.0.1 --port 3019",
    url: "http://127.0.0.1:3019/login",
  },
});
