import { expect, test } from "./fixtures";

/**
 * Moments in the seeded offseason save (free agency, development has run):
 * the progression reveal opens by itself once, closes with Escape and stays
 * closed after a reload. The page keeps a replay button.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "moments: desktop only");
});

test("progression reveal opens once after development", async ({
  page,
  offseasonSave,
}) => {
  await page.goto(offseasonSave(), { waitUntil: "networkidle" });
  const reveal = page.getByRole("dialog", { name: "Progression reveal" });
  await expect(reveal).toBeVisible();
  // The suite runs with reduced motion: one summary card, so Done.
  await expect(reveal.getByRole("button", { name: /^Done/ })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(reveal).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(offseasonSave("/development?tab=progression"), {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: /Replay progression/ }).click();
  await expect(reveal).toBeVisible();
});

test("no reveal before the season has ended", async ({
  page,
  regularSeasonSave,
}) => {
  await page.goto(regularSeasonSave(), { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
