import { KNOWN_ISSUES } from "./known-issues";
import { collectProblems, expect, horizontalOverflow, test } from "./fixtures";
import { OUTER_ROUTES, SAVE_ROUTES } from "./routes";

/**
 * Every page loads without a server error or console error and never scrolls
 * sideways. Failures keep a full-page screenshot with overflowing elements
 * outlined in red.
 */
for (const route of [...SAVE_ROUTES.map((r) => `save:${r}`), ...OUTER_ROUTES]) {
  const label = route.startsWith("save:") ? route.slice(5) || "/" : route;
  test(`loads cleanly: ${label}`, async ({ page, dashboard }, testInfo) => {
    const known = KNOWN_ISSUES[`${testInfo.project.name} ${label}`];
    if (known) test.fail(true, known);

    const problems = collectProblems(page);
    const url = route.startsWith("save:") ? dashboard(route.slice(5)) : route;
    const response = await page.goto(url, { waitUntil: "networkidle" });

    expect(response?.status(), "HTTP status").toBeLessThan(400);
    // Snapshot first: outlining offenders edits the DOM, which React would
    // report as a hydration mismatch on a page still hydrating.
    const errors = [...problems];
    const overflow = await horizontalOverflow(page);
    if (errors.length > 0 || overflow.length > 0) {
      await testInfo.attach("page", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
    expect(errors, "console errors and 5xx responses").toEqual([]);
    expect(overflow, "elements wider than the viewport").toEqual([]);
  });
}
