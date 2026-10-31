import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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

/** Serious or critical axe (WCAG 2.1 AA) findings on the current page. */
async function blockingAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target.join(" ")})`,
    );
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
}

test("Player card Attributes tab shows seven category boxes that follow the rating display", async ({
  page,
  dashboard,
}) => {
  await openSheet(page, dashboard("/roster"));
  await grid(page).focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog").first();
  await expect(card).toBeVisible();
  await card.getByRole("tab", { name: "Attributes" }).click();

  const boxes = card.locator('[aria-label="Category ratings"] > li');
  await expect(boxes).toHaveCount(7);
  const firstValue = boxes.first().locator(".font-display > [aria-hidden]");
  await expect(firstValue).toHaveText(/^[A-F][+-]?$/);

  await card
    .getByRole("group", { name: "Rating display" })
    .getByRole("button", { name: "Ratings" })
    .click();
  await expect(firstValue).toHaveText(/^\d+$/);

  // The best category starts open; its sub-ratings follow the display too.
  await expect(card.getByRole("button", { name: /^Hide details/ })).toHaveCount(
    1,
  );
  await noSidewaysScroll(page);
  expect(await blockingAxe(page)).toEqual([]);
});

test("Player profile and compare pages keep the boxes and table accessible", async ({
  page,
  dashboard,
}) => {
  await openSheet(page, dashboard("/roster"));
  const ids = await grid(page)
    .locator("tbody tr[data-player-id]")
    .evaluateAll((rows) =>
      rows.slice(0, 2).map((row) => row.getAttribute("data-player-id")),
    );
  expect(ids.length).toBe(2);

  await page.goto(dashboard(`/players/${ids[0]}?tab=attributes`), {
    waitUntil: "networkidle",
  });
  await expect(
    page.locator('[aria-label="Category ratings"] > li'),
  ).toHaveCount(7);
  await noSidewaysScroll(page);
  expect(await blockingAxe(page)).toEqual([]);

  await page.goto(dashboard(`/players/compare?a=${ids[0]}&b=${ids[1]}`), {
    waitUntil: "networkidle",
  });
  await expect(page.getByRole("table")).toBeVisible();
  await noSidewaysScroll(page);
  expect(await blockingAxe(page)).toEqual([]);
});

test("Free Agents tab shows the same sheet without roster actions", async ({
  page,
  dashboard,
}) => {
  await page.goto(dashboard("/roster?tab=free-agents"), {
    waitUntil: "networkidle",
  });
  const faGrid = page.getByRole("grid", { name: "Free agent sheet" });
  await expect(faGrid).toBeVisible();
  const header = page.getByRole("region", { name: "Selected player" });
  await expect(selectedName(page)).not.toHaveText("");
  await expect(header.getByText("Free agent", { exact: true })).toBeVisible();
  await expect(
    header.getByRole("link", { name: "View in Free Agency" }),
  ).toBeVisible();
  await expect(header.getByRole("link", { name: "Contracts" })).toHaveCount(0);

  const before = (await selectedName(page).textContent()) ?? "";
  await faGrid.focus();
  await page.keyboard.press("ArrowDown");
  await expect(selectedName(page)).not.toHaveText(before);

  await noSidewaysScroll(page);
  expect(await blockingAxe(page)).toEqual([]);
});
