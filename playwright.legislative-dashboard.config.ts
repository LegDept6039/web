import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one administration fixture server.");

export default defineConfig({
  ...administration,
  testMatch: ["legislative-dashboard.spec.ts"],
  testIgnore: "**/data/**",
  outputDir: "test-results/legislative-dashboard",
  timeout: 180000,
  use: { ...administration.use, baseURL: "http://127.0.0.1:3021" },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3021",
    url: "http://127.0.0.1:3021/login",
    env: {
      ...server.env,
      PORTAL_LEGISLATIVE_DASHBOARD_TEST_FIXTURE: "1",
      PORTAL_TEST_CONTENT_DELAY_MS: "1200",
    },
  },
});
