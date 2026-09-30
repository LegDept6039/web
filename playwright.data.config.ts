import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/data",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  timeout: 60000,
});
