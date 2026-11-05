import { expect, test } from "./fixtures";
import { LEGACY_REDIRECTS } from "./routes";

test.describe("legacy routes", () => {
  // Routing does not depend on the viewport.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop only");
  });

  for (const [from, to] of LEGACY_REDIRECTS) {
    test(`${from} lands on ${to}`, async ({ page, dashboard }) => {
      const response = await page.goto(dashboard(from));
      expect(response?.status()).toBeLessThan(400);
      // Some redirects happen client-side, after the document has started streaming.
      await page.waitForURL((url) => url.pathname === dashboard(to));
    });
  }
});
