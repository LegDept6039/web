import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server)) throw new Error("Expected one fixture server.");

export default defineConfig({
  ...administration,
  testMatch: "executive-previews.spec.ts",
  testIgnore: "**/data/**",
  outputDir: "test-results/executive-previews",
  use: { ...administration.use, baseURL: "http://127.0.0.1:3030" },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3030",
    url: "http://127.0.0.1:3030/login",
    env: {
      ...server.env,
      PORTAL_DEPARTMENT_BRANCHES_TEST_FIXTURE: "1",
      PORTAL_EXECUTIVE_PREVIEW_TEST_FIXTURE: "1",
    },
  },
});
