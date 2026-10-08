import { defineConfig } from "@playwright/test";
import base from "./playwright.auth.config";
export default defineConfig({
  ...base,
  outputDir: "test-results/public",
  timeout: 90000,
  expect: { timeout: 15000 },
  testMatch: "portal.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:3004" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3004",
    url: "http://127.0.0.1:3004",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      CONTENT_SOURCE: "mock",
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
