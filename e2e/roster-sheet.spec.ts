import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The Roster tab's default Sheet view. Read-only: opens the page, moves the
 * selection, flips the rating display (a per-browser preference) and opens
 * the player card; nothing is saved to the league.
 */

const RATING_KEY = "ballsim:rating-display";

const grid = (page: Page) => page.getByRole("grid", { name: "Roster sheet" });
const selectedName = (page: Page) =>
  page
    .getByRole("region", { name: "Selected player" })
    .getByRole("heading", { level: 3 });

/** Visible text of the first row's skill cell (4th data column: INS). */
const skillCell = (page: Page) =>
  grid(page)
    .locator("tbody tr[data-player-id]")
    .first()
    .locator("td")
    .nth(4)
    .locator("[data-tier] > [aria-hidden]");

async function openSheet(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(grid(page)).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  // Start every test from the defaults (sheet view, letter grades).
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("e2e-sheet-init")) {
      sessionStorage.setItem("e2e-sheet-init", "1");
      localStorage.removeItem("ballsim:rating-display");
      localStorage.removeItem("ballsim:roster-view");
    }
  });
});

test("Roster opens on the sheet with a selected player", async ({
  page,
  dashboard,
}) => {
  await openSheet(page, dashboard("/roster"));
  await expect(
    page.getByRole("navigation", { name: "Sheet tabs" }),
  ).toBeVisible();
  await expect(selectedName(page)).not.toHaveText("");
  await expect(grid(page).locator('tr[aria-selected="true"]')).toHaveCount(1);
});

test("ArrowDown selects the next player", async ({ page, dashboard }) => {
  await openSheet(page, dashboard("/roster"));
  const before = (await selectedName(page).textContent()) ?? "";
  await grid(page).focus();
  await page.keyboard.press("ArrowDown");
  await expect(selectedName(page)).not.toHaveText(before);
  await page.keyboard.press("ArrowUp");
  await expect(selectedName(page)).toHaveText(before);
});

test("Rating display switches grades to ratings and persists", async ({
  page,
  dashboard,
}) => {
  await openSheet(page, dashboard("/roster"));
  const cell = skillCell(page);
  await expect(cell).toHaveText(/^[A-F][+-]?$/);

  const display = page.getByRole("group", { name: "Rating display" });
  await display.getByRole("button", { name: "Ratings" }).click();
  await expect(cell).toHaveText(/^\d+$/);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), RATING_KEY),
  ).toBe("ratings");

  await page.reload({ waitUntil: "networkidle" });
  await expect(skillCell(page)).toHaveText(/^\d+$/);
  await expect(
    page
      .getByRole("group", { name: "Rating display" })
      .getByRole("button", { name: "Ratings" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Enter opens the player card and Escape closes it", async ({
  page,
  dashboard,
}) => {
  await openSheet(page, dashboard("/roster"));
  await grid(page).focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog").first();
  await expect(card).toBeVisible();
  await expect(card.getByRole("img", { name: /^Overall \d+$/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("?view=table shows the classic roster view", async ({
  page,
  dashboard,
}) => {
  await page.goto(dashboard("/roster?view=table"), {
    waitUntil: "networkidle",
  });
  // The classic roster management view (cards, with its own Table toggle).
  await expect(page.getByPlaceholder(/^Filter by name/)).toBeVisible();
  await expect(grid(page)).toHaveCount(0);
});

for (const tab of ["Simple", "Detail"]) {
  test(`${tab} tab does not scroll the page sideways`, async ({
    page,
    dashboard,
  }) => {
    await openSheet(page, dashboard("/roster"));
    await page
      .getByRole("navigation", { name: "Sheet tabs" })
      .getByRole("button", { name: tab })
      .click();
    await expect(grid(page).getByRole("columnheader").nth(1)).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
  });
}
