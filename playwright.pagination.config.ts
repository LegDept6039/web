import { defineConfig } from "@playwright/test";
import base from "./playwright.terms.config";

const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");

export default defineConfig({
  ...base,
  testMatch: ["admin-pagination.spec.ts"],
  outputDir: "test-results/admin-pagination",
  use: { ...base.use, baseURL: "http://127.0.0.1:3023" },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3023",
    url: "http://127.0.0.1:3023/login",
    env: { ...server.env, PORTAL_PAGINATION_TEST_FIXTURE: "1" },
  },
});
