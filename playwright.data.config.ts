import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results/data",
  testDir: "./tests/data",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  timeout: 60000,
});
