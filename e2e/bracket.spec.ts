import { expect, test } from "./fixtures";

/**
 * The playoff bracket in the seeded playoffs save (opening round live): the
 * connected tree on wide screens with keyboard access to a series' games,
 * one round at a time on phones.
 */
test("desktop: series open their games from the keyboard", async ({
  page,
  playoffsSave,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "tree: desktop");
  await page.goto(playoffsSave("/playoffs"), { waitUntil: "networkidle" });
  const bracket = page.getByLabel("Playoff bracket");
  await expect(bracket).toBeVisible();

  // Laid out as a tree: no two series cards overlap, none spills out of
  // the bracket (jsdom tests cannot see layout).
  const boxes = await bracket
    .locator("[data-focus-item]")
    .evaluateAll((slots) =>
      slots.map((slot) => {
        const r = slot.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
    );
  const frame = (await bracket.boundingBox())!;
  for (const [i, a] of boxes.entries()) {
    expect(a.top).toBeGreaterThanOrEqual(frame.y - 1);
    expect(a.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
    for (const b of boxes.slice(i + 1)) {
      const overlap =
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom;
      expect(overlap, "series cards overlap").toBe(false);
    }
  }

  const first = bracket.locator("[data-focus-item]").first();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(first).not.toBeFocused();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link").first()).toHaveAttribute(
    "href",
    /\/games\//,
  );
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});

test("phone: one round at a time", async ({ page, playoffsSave }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "rounds: phone");
  await page.goto(playoffsSave("/playoffs"), { waitUntil: "networkidle" });
  const tabs = page.getByRole("navigation", { name: "Playoff rounds" });
  await expect(tabs).toBeVisible();
  const buttons = tabs.getByRole("button");
  expect(await buttons.count()).toBeGreaterThan(1);
  const pressed = tabs.locator('button[aria-pressed="true"]');
  const before = await pressed.textContent();
  await buttons.last().click();
  await expect(pressed).not.toHaveText(before ?? "");
});
