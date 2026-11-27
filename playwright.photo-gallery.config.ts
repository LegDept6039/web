import { defineConfig } from "@playwright/test";
import administration from "./playwright.administration.config";

const server = administration.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one fixture server.");

export default defineConfig({
  ...administration,
  testMatch: "photo-gallery.spec.ts",
  testIgnore: "**/data/**",
  outputDir: "test-results/photo-gallery",
  timeout: 120000,
  use: {
    ...administration.use,
    baseURL: "http://127.0.0.1:3046",
    actionTimeout: 15000,
  },
  webServer: {
    ...server,
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3046",
    url: "http://127.0.0.1:3046/login",
    env: { ...server.env, PORTAL_GALLERY_TEST_FIXTURE: "1" },
  },
});
