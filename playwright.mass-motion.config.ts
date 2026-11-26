import { defineConfig } from "@playwright/test";
import base from "./playwright.legislative.config";

const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Fixture server required");

export default defineConfig({
  ...base,
  testMatch: ["mass-motion.spec.ts"],
  outputDir: "test-results/mass-motion",
  use: { ...base.use, baseURL: "http://127.0.0.1:3031" },
  webServer: {
    ...server,
    env: { ...server.env, PORTAL_MASS_MOTION_TEST_FIXTURE: "1" },
    command: "npm run start -- --hostname 127.0.0.1 --port 3031",
    url: "http://127.0.0.1:3031/login",
  },
});
