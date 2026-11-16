import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";
const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected fixture server.");
export default defineConfig({
  ...administration,
  testMatch: ["legislative-workspace.spec.ts", "legislative-admin.spec.ts"],
  timeout: 180000,
  testIgnore: "**/data/**",
  outputDir: "test-results/legislative-workspace",
  use: {
    ...administration.use,
    actionTimeout: 15000,
    baseURL: "http://127.0.0.1:3014",
  },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3014",
    url: "http://127.0.0.1:3014/login",
  },
});
