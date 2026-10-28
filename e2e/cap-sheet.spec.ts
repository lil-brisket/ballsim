import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/**
 * Cap sheet on Finances › Payroll (seeded regular season): payroll bar with
 * its limits, the season grid, keyboard access to the player drawer and
 * axe on the new section. Overflow at every width is covered by smoke.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop" && testInfo.project.name !== "mobile",
    "cap sheet: desktop and phone",
  );
});

test("payroll bar, season grid and player drawer", async ({
  page,
  regularSeasonSave,
}) => {
  await page.goto(regularSeasonSave("/finances/payroll"), {
    waitUntil: "networkidle",
  });
  await expect(page.getByRole("img", { name: /payroll/i })).toBeVisible();

  const grid = page.getByRole("table", { name: "Cap sheet" });
  await expect(grid).toBeVisible();
  // Planning season plus later ones as column headers.
  expect(
    await grid.getByRole("columnheader", { name: /^\d{4}$/ }).count(),
  ).toBeGreaterThan(1);

  const firstPlayer = grid
    .getByRole("button")
    .or(grid.getByRole("link"))
    .first();
  await firstPlayer.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").first()).toBeVisible();
  await page.keyboard.press("Escape");

  const results = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.nodes[0]?.target.join(" ")}`);
  expect(blocking).toEqual([]);
});
