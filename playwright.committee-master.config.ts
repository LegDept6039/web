import { defineConfig } from "@playwright/test";
import base from "./playwright.terms.config";
const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");
export default defineConfig({
  ...base,
  testMatch: ["committee-master-browser.spec.ts"],
  use: { ...base.use, baseURL: "http://127.0.0.1:3020" },
  webServer: {
    ...server,
    env: { ...server.env, PORTAL_COMMITTEE_MASTER_TEST_FIXTURE: "1" },
    command: "npm run start -- --hostname 127.0.0.1 --port 3020",
    url: "http://127.0.0.1:3020/login",
  },
  outputDir: "test-results/committee-master",
});
