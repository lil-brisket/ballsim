import { defineConfig } from "@playwright/test";

/**
 * Browser checks against a running app (`npm run test:e2e`). Uses the newest
 * save in the local database (or E2E_SAVE_ID). Read-only: no spec advances
 * time or submits a form.
 *
 * Failures keep a screenshot and a trace under test-results/. Visual
 * baselines live in the gitignored screenshots/baselines/ because they depend
 * on the local save; refresh them with `npm run test:e2e:update`.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  // The dev server compiles each route on first visit; keep load modest.
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "screenshots/baselines/{projectName}/{arg}{ext}",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    navigationTimeout: 90_000,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 375, height: 812 }, hasTouch: true },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
