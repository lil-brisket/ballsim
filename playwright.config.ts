import { defineConfig } from "@playwright/test";
import { E2E_SAVES } from "./e2e/seed-saves";

const ci = Boolean(process.env.CI);
/** Running against the `npm run e2e:seed` league (always in CI). */
const seeded = process.env.E2E_SAVE_ID === E2E_SAVES.regularSeason;
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Browser checks against a running app (`npm run test:e2e`). Read-only: no
 * spec advances time or submits a form.
 *
 * CI seeds prisma/e2e.db (`npm run e2e:seed`), builds, serves it with
 * `npm run start` and sets E2E_SAVE_ID to the seeded regular-season save.
 * Locally the specs use the newest save in your database unless E2E_SAVE_ID
 * is set; specs for the seeded playoff and offseason saves skip when those
 * saves are missing. To run the seeded suite locally, set
 * DATABASE_URL=file:./prisma/e2e.db for both the server and the tests.
 *
 * Failures keep a screenshot and a trace under test-results/. Visual
 * baselines for the seeded league are committed under e2e/baselines/ per
 * platform; only the linux ones are kept (CI refreshes them with the "E2E
 * baselines" workflow). Baselines for your own save live in the gitignored
 * screenshots/baselines/; refresh with `npm run test:e2e:update`.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      stylePath: "e2e/screenshot.css",
    },
  },
  // The dev server compiles each route on first visit; keep load modest.
  // CI serves a production build.
  workers: ci ? 4 : 2,
  retries: ci ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: seeded
    ? "e2e/baselines/{platform}/{projectName}/{arg}{ext}"
    : "screenshots/baselines/{projectName}/{arg}{ext}",
  use: {
    baseURL,
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
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "wide", use: { viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: ci ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
});
