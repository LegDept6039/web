import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one fixture server.");

export default defineConfig({
  ...administration,
  testMatch: "contact-numbers.spec.ts",
  testIgnore: "**/data/**",
  outputDir: "test-results/contact-numbers",
  use: { ...administration.use, baseURL: "http://127.0.0.1:3048" },
  webServer: {
    ...server,
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3048",
    url: "http://127.0.0.1:3048/login",
  },
});
