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
      // Redirects inside a streamed (loading.tsx) segment happen client-side.
      await page.waitForURL((url) => url.pathname === dashboard(to));
    });
  }
});
