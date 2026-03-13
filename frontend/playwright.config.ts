import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Prism E2E tests.
 *
 * The suite expects the Next.js dev server to be reachable at
 * http://localhost:3000 and the FastAPI backend at http://localhost:8000.
 * All backend calls are intercepted via page.route() mocks — a live
 * FastAPI instance is NOT required for these tests.
 *
 * Run:
 *   pnpm test:e2e          # headless
 *   pnpm test:e2e:ui       # interactive UI mode
 *   pnpm test:e2e:report   # open HTML report after a run
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // Each test file runs sequentially to avoid port conflicts with the dev server.
  fullyParallel: false,

  // Hard-fail if test.only is accidentally committed.
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Block Service Workers so page.route() intercepts all fetch calls.
    serviceWorkers: "block",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    // Reuse an already-running dev server in local development.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
