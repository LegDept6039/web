import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

export default defineConfig({
  ...administration,
  outputDir: "test-results/service-forms",
  testMatch: ["service-form-attachments.spec.ts"],
  testIgnore: ["**/data/**"],
  use: { ...administration.use, baseURL: "http://127.0.0.1:3047" },
  webServer: {
    ...(administration.webServer as object),
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3047",
    url: "http://127.0.0.1:3047/login",
    reuseExistingServer: false,
  },
});
