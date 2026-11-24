import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server)) throw new Error("Expected one fixture server.");

export default defineConfig({
  ...administration,
  testMatch: "cms-branches.spec.ts",
  testIgnore: "**/data/**",
  outputDir: "test-results/cms-branches",
  timeout: 120000,
  use: { ...administration.use, baseURL: "http://127.0.0.1:3027", actionTimeout: 15000 },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3027",
    url: "http://127.0.0.1:3027/login",
    env: { ...server.env, PORTAL_DEPARTMENT_BRANCHES_TEST_FIXTURE: "1" },
  },
});
