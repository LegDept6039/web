import { defineConfig } from "@playwright/test";
import base from "./playwright.legislative.config";
const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");
export default defineConfig({
  ...base,
  testMatch: ["legislative-terms-browser.spec.ts"],
  webServer: {
    ...server,
    env: { ...server.env, PORTAL_TERM_TEST_FIXTURE: "1" },
  },
  outputDir: "test-results/terms",
});
