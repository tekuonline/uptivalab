import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
});
