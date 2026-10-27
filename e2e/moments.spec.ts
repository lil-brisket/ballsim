import { expect, test } from "./fixtures";

/**
 * Moments in the seeded offseason save (free agency: the Finals are over and
 * development has run). They open by themselves one at a time (awards night,
 * championship, then progression), close with Escape and stay closed after a
 * reload. Their pages keep replay buttons. The suite runs with reduced
 * motion, so each moment is one summary card ending in Done.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "moments: desktop only");
});

test("awards, championship and progression open once, in order", async ({
  page,
  offseasonSave,
}) => {
  await page.goto(offseasonSave(), { waitUntil: "networkidle" });
  const awards = page.getByRole("dialog", { name: "Awards night" });
  const champion = page.getByRole("dialog", { name: "Championship" });
  const progression = page.getByRole("dialog", { name: "Progression reveal" });

  await expect(awards).toBeVisible();
  await expect(champion).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(awards).toHaveCount(0);

  await expect(champion).toBeVisible();
  await expect(progression).toHaveCount(0);
  await expect(champion.getByRole("button", { name: /^Done/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(champion).toHaveCount(0);

  await expect(progression).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(progression).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(offseasonSave("/development?tab=progression"), {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: /Replay progression/ }).click();
  await expect(progression).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(offseasonSave("/playoffs"), { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Replay championship/ }).click();
  await expect(champion).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(offseasonSave("/awards"), { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /awards night/ }).click();
  await expect(awards).toBeVisible();
});

test("no moments before the season has ended", async ({
  page,
  regularSeasonSave,
}) => {
  await page.goto(regularSeasonSave(), { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
