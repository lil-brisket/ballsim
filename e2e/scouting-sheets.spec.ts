import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/**
 * The scouting sheets: the draft prospect pool and another team's roster.
 * Read-only: opens pages, moves the selection and flips the rating display
 * (a per-browser preference); nothing is saved to the league.
 */

const prospectGrid = (page: Page) =>
  page.getByRole("grid", { name: "Prospect pool sheet" });

async function blockingAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target.join(" ")} ${v.nodes[0]?.html.slice(0, 300)})`,
    );
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
}

/** Offseason moments (awards night and so on) open on their own; close them. */
async function closeMoments(page: Page) {
  const dialog = page.getByRole("dialog");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await dialog.first().waitFor({ state: "visible", timeout: 2_000 });
    } catch {
      return;
    }
    await page.keyboard.press("Escape");
    await expect(dialog)
      .toHaveCount(0, { timeout: 1_000 })
      .catch(() => {});
  }
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("e2e-scouting-init")) {
      sessionStorage.setItem("e2e-scouting-init", "1");
      localStorage.removeItem("ballsim:rating-display");
      localStorage.removeItem("ballsim:prospect-view");
    }
  });
});

test("Draft prospect pool opens on the sheet with grade ranges", async ({
  page,
  draftSave,
}) => {
  await page.goto(draftSave("/draft"), { waitUntil: "networkidle" });
  await closeMoments(page);
  await expect(prospectGrid(page)).toBeVisible();
  const rows = prospectGrid(page).locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(1);
  await expect(
    prospectGrid(page).locator('tr[aria-selected="true"]'),
  ).toHaveCount(1);
  // Scouted categories read as a grade or a grade range, never a bare "??".
  await expect(prospectGrid(page).locator("tbody")).toContainText(/[A-F][+-]?/);
  await noSidewaysScroll(page);
  expect(await blockingAxe(page)).toEqual([]);
});

test("Prospect pool: ArrowDown moves the selection, Cards view returns", async ({
  page,
  draftSave,
}) => {
  await page.goto(draftSave("/draft"), { waitUntil: "networkidle" });
  await closeMoments(page);
  const selected = prospectGrid(page).locator('tr[aria-selected="true"]');
  const before = await selected.getAttribute("data-player-id");
  await prospectGrid(page).focus();
  await page.keyboard.press("ArrowDown");
  await expect(selected).not.toHaveAttribute(
    "data-player-id",
    before ?? "none",
  );

  // Undrafted prospects have no player card: no button, no Enter shortcut.
  await expect(page.getByRole("button", { name: "Open card" })).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Prospect pool view" })
    .getByRole("link", { name: "Cards" })
    .click();
  await expect(prospectGrid(page)).toHaveCount(0);
});

test("Another team's roster is a read-only sheet", async ({
  page,
  regularSeasonSave,
}) => {
  await page.goto(regularSeasonSave("/league"), {
    waitUntil: "networkidle",
  });
  // Any team that is not the user's opens a drawer with a "View roster" link.
  const teamButtons = page
    .getByRole("table", { name: "Standings snapshot" })
    .locator("tbody")
    .getByRole("button");
  const count = await teamButtons.count();
  let opened = false;
  for (let index = 0; index < count && !opened; index += 1) {
    await teamButtons.nth(index).click();
    const link = page.getByRole("link", { name: "View roster" });
    await link
      .first()
      .waitFor({ state: "visible", timeout: 5_000 })
      .catch(() => {});
    const href =
      (await link.count()) > 0 ? await link.first().getAttribute("href") : null;
    if (href?.includes("/league/teams/")) {
      await link.first().click();
      opened = true;
      break;
    }
    await page.keyboard.press("Escape");
  }
  expect(opened).toBe(true);

  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Team rosters" }),
  ).toBeVisible();
  // Public info shows; the roster actions and Contracts link do not.
  const header = page.getByRole("region", { name: "Selected player" });
  await expect(header.getByRole("button", { name: "Open card" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Contracts" })).toHaveCount(0);
  await noSidewaysScroll(page);
  expect(await blockingAxe(page)).toEqual([]);
});

test("League hub links every team's roster", async ({
  page,
  regularSeasonSave,
}) => {
  await page.goto(regularSeasonSave("/league"), { waitUntil: "networkidle" });
  const links = page
    .getByRole("navigation", { name: "Team rosters" })
    .getByRole("link");
  expect(await links.count()).toBeGreaterThan(2);
  const hrefs = await links.evaluateAll((items) =>
    items.map((item) => item.getAttribute("href") ?? ""),
  );
  const other = hrefs.find((href) => href.includes("/league/teams/"));
  expect(other).toBeTruthy();
  expect(hrefs.some((href) => href.endsWith("/roster"))).toBe(true);
  await page.goto(other!, { waitUntil: "networkidle" });
  await expect(page.getByRole("grid")).toBeVisible();
});

test("Settings shows the Grades or Ratings option", async ({
  page,
  dashboard,
}) => {
  await page.goto(dashboard("/settings"), { waitUntil: "networkidle" });
  const display = page.getByRole("group", { name: "Rating display" });
  await expect(display).toBeVisible();
  await display.getByRole("button", { name: "Ratings" }).click();
  await expect(page.getByText(/now showing ratings/i)).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText(/now showing ratings/i)).toBeVisible();
});
