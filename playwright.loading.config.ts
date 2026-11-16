import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";
const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one administration fixture server.");
export default defineConfig({
  ...administration,
  use: { ...administration.use, baseURL: "http://127.0.0.1:3013" },
  testMatch: ["admin-loading.spec.ts"],
  outputDir: "test-results/admin-loading",
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3013",
    url: "http://127.0.0.1:3013/login",
    env: {
      ...server.env,
      PORTAL_TEST_CONTENT_DELAY_MS: "1800",
    },
  },
});
