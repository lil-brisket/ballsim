import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { KNOWN_ISSUES } from "./known-issues";
import { expect, test } from "./fixtures";

/** Main screens with no serious or critical axe (WCAG 2.1 AA) violations. */
const SCREENS = [
  "",
  "/roster",
  "/roster?view=table",
  "/roster?tab=free-agents",
  "/league",
  "/finances",
  "/media",
  "/draft",
];

/** Open the roster sheet's Detail tab (the widest grid). */
async function openDetailTab(page: Page) {
  await page
    .getByRole("navigation", { name: "Sheet tabs" })
    .getByRole("button", { name: "Detail" })
    .click();
  await expect(page.getByRole("columnheader", { name: /^BBIQ/ })).toBeVisible();
}

const CASES: ReadonlyArray<[label: string, path: string, prepare?: Prepare]> = [
  ...SCREENS.map((path): [string, string] => [path || "/", path]),
  ["/roster (detail tab)", "/roster", openDetailTab],
];

type Prepare = (page: Page) => Promise<void>;

for (const [label, path, prepare] of CASES) {
  test(`accessible: ${label}`, async ({ page, dashboard }, testInfo) => {
    const known = KNOWN_ISSUES[`${testInfo.project.name} a11y ${label}`];
    if (known) test.fail(true, known);

    await page.goto(dashboard(path), { waitUntil: "networkidle" });
    await prepare?.(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) =>
          `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target.join(" ")})`,
      );
    if (blocking.length > 0) {
      await testInfo.attach("axe", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
    }
    expect(blocking).toEqual([]);
  });
}
