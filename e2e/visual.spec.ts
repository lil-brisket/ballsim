import { expect, test } from "./fixtures";

/**
 * Visual regression for the main screens: compares against the baselines in
 * screenshots/baselines/ and writes expected/actual/diff images on failure.
 * Refresh deliberately with `npm run test:e2e:update` after an intended
 * visual change.
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
  await page.goto("/dev/broadcast-ui", { waitUntil: "networkidle" });
  await expect(page).toHaveScreenshot("broadcast-ui.png", { fullPage: true });
});
