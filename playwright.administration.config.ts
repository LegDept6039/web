import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results/admin",
  testDir: "./tests",
  testMatch: [
    "staff-session.spec.ts",
    "department-portraits.spec.ts",
    "admin-authoring.spec.ts",
    "content-workflows.spec.ts",
    "administration.spec.ts",
    "login-resolution.spec.ts",
    "legislative-admin.spec.ts",
    "department-admin.spec.ts",
    "dynamic-department-admin.spec.ts",
    "municipal-contact-admin.spec.ts",
    "barangays-admin.spec.ts",
    "department-social-contacts.spec.ts",
    "department-services-admin.spec.ts",
    "password-reset-admin.spec.ts",
  ],
  workers: 1,
  reporter: "list",
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3003",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3003",
    url: "http://127.0.0.1:3003/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      CONTENT_SOURCE: "supabase",
      SUPABASE_URL: "https://fixture.supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture_test",
      PORTAL_AUTH_TEST_FIXTURE: "1",
      NODE_OPTIONS: "--import=./tests/fixtures/supabase.mjs",
    },
  },
});
