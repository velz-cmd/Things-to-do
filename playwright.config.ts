import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: isCI ? 120_000 : 60_000,
  expect: {
    timeout: isCI ? 20_000 : 10_000,
  },
  use: {
    // Always hit the local webServer in CI — never a remote APP_URL.
    baseURL: process.env.CI
      ? "http://localhost:3000"
      : process.env.APP_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: isCI ? 45_000 : 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
