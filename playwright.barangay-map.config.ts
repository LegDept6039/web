import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one fixture server.");

export default defineConfig({
  ...administration,
  testMatch: "barangay-map.spec.ts",
  testIgnore: "**/data/**",
  outputDir: "test-results/barangay-map",
  timeout: 90000,
  use: {
    ...administration.use,
    baseURL: "http://127.0.0.1:3031",
    actionTimeout: 15000,
  },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3031",
    url: "http://127.0.0.1:3031/barangays/anislag",
    env: { ...server.env, PORTAL_BARANGAY_AFFAIRS_TEST_FIXTURE: "1" },
  },
});
