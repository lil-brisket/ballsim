import type { Page, TestInfo } from "@playwright/test";
import { KNOWN_ISSUES } from "./known-issues";
import { collectProblems, expect, horizontalOverflow, test } from "./fixtures";
import { OUTER_ROUTES, PRODUCTION_SERVER, SAVE_ROUTES } from "./routes";

/**
 * Every page loads without a server error or console error and never scrolls
 * sideways. Failures keep a full-page screenshot with overflowing elements
 * outlined in red.
 */
async function expectLoadsCleanly(page: Page, url: string, testInfo: TestInfo) {
  const problems = collectProblems(page);
  const response = await page.goto(url, { waitUntil: "networkidle" });

  expect(response?.status(), "HTTP status").toBeLessThan(400);
  // An unfinished save redirects every page to onboarding, which would
  // otherwise pass as a clean load.
  const save = url.match(/^\/dashboard\/[^/]+/)?.[0];
  if (save) {
    expect(new URL(page.url()).pathname, "stayed in the save").toMatch(
      new RegExp(`^${save}(/|$)`),
    );
  }
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
}

for (const route of [...SAVE_ROUTES.map((r) => `save:${r}`), ...OUTER_ROUTES]) {
  const label = route.startsWith("save:") ? route.slice(5) || "/" : route;
  test(`loads cleanly: ${label}`, async ({ page, dashboard }, testInfo) => {
    const known = KNOWN_ISSUES[`${testInfo.project.name} ${label}`];
    if (known) test.fail(true, known);
    test.skip(
      route.startsWith("/dev/") && PRODUCTION_SERVER,
      "dev pages are not served by a production build",
    );

    const url = route.startsWith("save:") ? dashboard(route.slice(5)) : route;
    await expectLoadsCleanly(page, url, testInfo);
  });
}

/**
 * The same pages in the other seasons' phases (seeded saves only). Layout
 * is covered at every width above; one width is enough here.
 */
test.describe("later phases", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "phases: desktop only");
  });

  for (const route of SAVE_ROUTES) {
    const label = route || "/";
    test(`playoffs loads cleanly: ${label}`, async ({
      page,
      playoffsSave,
    }, testInfo) => {
      await expectLoadsCleanly(page, playoffsSave(route), testInfo);
    });
    test(`offseason loads cleanly: ${label}`, async ({
      page,
      offseasonSave,
    }, testInfo) => {
      await expectLoadsCleanly(page, offseasonSave(route), testInfo);
    });
  }
});
