import { defineConfig } from "@playwright/test";
import base from "./playwright.terms.config";
const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");
export default defineConfig({
  ...base,
  testMatch: ["document-relations.spec.ts"],
  outputDir: "test-results/document-relations",
  use: { ...base.use, baseURL: "http://127.0.0.1:3021" },
  webServer: {
    ...server,
    env: { ...server.env, PORTAL_DOCUMENT_SESSION_TEST_FIXTURE: "1" },
    command: "npm run start -- --hostname 127.0.0.1 --port 3021",
    url: "http://127.0.0.1:3021/login",
  },
});
