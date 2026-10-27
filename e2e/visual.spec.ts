import { expect, test } from "./fixtures";
import { PRODUCTION_SERVER } from "./routes";

/**
 * Visual regression for the main screens: compares against the baselines
 * (see playwright.config.ts for where they live) and writes
 * expected/actual/diff images on failure. Refresh deliberately after an
 * intended visual change: `npm run test:e2e:update` for your own save, the
 * "E2E baselines" workflow for the seeded league.
 */
const SCREENS: ReadonlyArray<[name: string, path: string]> = [
  ["home", ""],
  ["roster", "/roster"],
  ["league", "/league"],
  ["finances", "/finances"],
  ["free-agency", "/free-agency"],
  ["draft", "/draft"],
];

for (const [name, path] of SCREENS) {
  test(`looks unchanged: ${name}`, async ({ page, dashboard }) => {
    await page.goto(dashboard(path), { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}

test("looks unchanged: ui showcase", async ({ page }) => {
  test.skip(
    PRODUCTION_SERVER,
    "dev pages are not served by a production build",
  );
  await page.goto("/dev/broadcast-ui", { waitUntil: "networkidle" });
  await expect(page).toHaveScreenshot("broadcast-ui.png", { fullPage: true });
});
