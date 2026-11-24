import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one fixture server.");

export default defineConfig({
  ...administration,
  testMatch: "admin-action-icons.spec.ts",
  testIgnore: "**/data/**",
  outputDir: "test-results/admin-action-icons",
  timeout: 180000,
  use: { ...administration.use, baseURL: "http://127.0.0.1:3025" },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3025",
    url: "http://127.0.0.1:3025/login",
    env: {
      ...server.env,
      PORTAL_TERM_TEST_FIXTURE: "1",
      PORTAL_LEGISLATIVE_DASHBOARD_TEST_FIXTURE: "1",
      PORTAL_BARANGAY_AFFAIRS_TEST_FIXTURE: "1",
      PORTAL_ACTION_ICONS_TEST_FIXTURE: "1",
    },
  },
});
