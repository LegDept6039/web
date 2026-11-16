import { defineConfig } from "@playwright/test";
import legislative from "./playwright.legislative.config";
const server = legislative.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected fixture server.");
export default defineConfig({
  ...legislative,
  testMatch: ["transparency.spec.ts", "legislative-workspace.spec.ts"],
  outputDir: "test-results/transparency",
  use: { ...legislative.use, baseURL: "http://127.0.0.1:3016" },
  webServer: {
    ...server,
    command: "npm run start -- --hostname 127.0.0.1 --port 3016",
    url: "http://127.0.0.1:3016/login",
  },
});
