import AxeBuilder from "@axe-core/playwright";
import { KNOWN_ISSUES } from "./known-issues";
import { expect, test } from "./fixtures";

/** Main screens with no serious or critical axe (WCAG 2.1 AA) violations. */
const SCREENS = ["", "/roster", "/league", "/finances", "/media", "/draft"];

for (const path of SCREENS) {
  const label = path || "/";
  test(`accessible: ${label}`, async ({ page, dashboard }, testInfo) => {
    const known = KNOWN_ISSUES[`${testInfo.project.name} a11y ${label}`];
    if (known) test.fail(true, known);

    await page.goto(dashboard(path), { waitUntil: "networkidle" });
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
