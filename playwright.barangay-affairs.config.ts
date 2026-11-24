import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one administration fixture server.");

export default defineConfig({
  ...administration,
  testMatch: ["barangay-affairs.spec.ts"],
  testIgnore: "**/data/**",
  outputDir: "test-results/barangay-affairs",
  use: { ...administration.use, baseURL: "http://127.0.0.1:3022" },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3022",
    url: "http://127.0.0.1:3022/login",
    env: {
      ...server.env,
      PORTAL_BARANGAY_AFFAIRS_TEST_FIXTURE: "1",
    },
  },
});
