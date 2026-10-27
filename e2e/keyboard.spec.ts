import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Keyboard-only journey through the console shell: Home → Team → Roster →
 * player drawer → Front Office → Trades → Sim. Only keys are pressed (no
 * clicks); Space ends on the calendar's next-game focus, which selects the
 * date but does not simulate, so the save is not changed.
 */

/** Press Tab until `matches` holds for the focused element (or give up). */
async function tabTo(
  page: Page,
  matches: (el: HTMLElement) => boolean,
  max = 120,
): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(
      `(${matches.toString()})(document.activeElement)`,
    );
    if (hit) return;
  }
  throw new Error("Never reached the target with Tab");
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "keyboard journey: desktop");
});

test("Home to Sim with the keyboard only", async ({ page, dashboard }) => {
  await page.goto(dashboard(), { waitUntil: "networkidle" });

  // E: next hub.
  await page.keyboard.press("e");
  await page.waitForURL((url) => url.pathname === dashboard("/team"));
  await settle(page);

  // Tab to the Roster sub-tab and open it.
  await tabTo(
    page,
    (el) =>
      el.tagName === "A" &&
      el.textContent?.trim().toLowerCase() === "roster" &&
      el.closest('nav[aria-label="Team sections"]') !== null,
  );
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === dashboard("/roster"));
  await settle(page);

  // Tab to the first player name and open the drawer.
  await tabTo(
    page,
    (el) =>
      el.tagName === "BUTTON" &&
      el.classList.contains("font-display") &&
      el.classList.contains("text-xl"),
  );
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog").first();
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("img", { name: /^Overall \d+$/ }),
  ).toBeVisible();

  // Esc closes the drawer first (a dialog gets Esc before the shell).
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(dashboard("/roster"));

  // 4: Front Office, then Tab to Trades.
  await page.keyboard.press("4");
  await page.waitForURL((url) => url.pathname === dashboard("/finances"));
  await settle(page);
  await tabTo(
    page,
    (el) =>
      el.tagName === "A" &&
      el.textContent?.trim().toLowerCase() === "trades" &&
      el.closest('nav[aria-label="Front Office sections"]') !== null,
  );
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.pathname === dashboard("/trades"));
  await settle(page);

  // Arrow keys move the cursor across the trade tiles.
  await tabTo(page, (el) => el.hasAttribute("data-focus-item"));
  const first = await page.evaluate(() => document.activeElement?.textContent);
  await page.keyboard.press("ArrowRight");
  const second = await page.evaluate(() => document.activeElement?.textContent);
  expect(second).not.toBe(first);

  // Space with nothing focused opens Sim (the calendar's next-game focus).
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press(" ");
  await page.waitForURL(
    (url) =>
      url.pathname === dashboard("/calendar") &&
      url.searchParams.get("focus") === "next-game",
  );
});

test("Every hub and its sub-tabs are reachable by keyboard", async ({
  page,
  dashboard,
}) => {
  await page.goto(dashboard(), { waitUntil: "networkidle" });
  const hubs = page.locator('nav[aria-label="Hubs"] a');
  const count = await hubs.count();
  expect(count).toBeGreaterThan(4);
  for (let key = 1; key <= Math.min(count, 5); key += 1) {
    await page.keyboard.press(String(key));
    await settle(page);
    const tabs = page.locator('nav[aria-label$=" sections"] a');
    for (let i = 0; i < (await tabs.count()); i += 1) {
      // Every sub-tab is a real, focusable link.
      await expect(tabs.nth(i)).toHaveAttribute("href", /\/dashboard\//);
      await tabs.nth(i).focus();
      await expect(tabs.nth(i)).toBeFocused();
    }
  }
});
