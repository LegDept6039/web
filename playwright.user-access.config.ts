import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "user-access-form.spec.ts",
  testIgnore: "**/data/**",
  outputDir: "test-results/user-access-form",
  workers: 1,
  reporter: "list",
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3024",
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
    command: "npm run start -- --hostname 127.0.0.1 --port 3024",
    url: "http://127.0.0.1:3024/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      CONTENT_SOURCE: "supabase",
      SUPABASE_URL: "https://fixture.supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture_test",
      PORTAL_AUTH_TEST_FIXTURE: "1",
      PORTAL_PAGINATION_TEST_FIXTURE: "1",
      NODE_OPTIONS: "--import=./tests/fixtures/supabase.mjs",
    },
  },
});
