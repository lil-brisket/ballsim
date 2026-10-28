import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/**
 * The breaking-news strip under the hub bar: on in the seeded offseason save
 * (early free agency), off in the regular season away from the deadline.
 * Layout at every width is covered by the smoke spec.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop" && testInfo.project.name !== "mobile",
    "ticker: desktop and phone",
  );
});

test("free agency ticker in early free agency", async ({
  page,
  offseasonSave,
}) => {
  await page.goto(offseasonSave("/free-agency"), { waitUntil: "networkidle" });
  const ticker = page.getByRole("list", { name: "Free agency moves" });
  await expect(ticker).toBeAttached();
  await expect(page.getByText(/Day \d of free agency/)).toBeAttached();
  // One entry per move (a signing emits two events).
  const entries = await ticker.getByRole("listitem").allInnerTexts();
  expect(new Set(entries).size).toBe(entries.length);

  // The a11y spec's screens never show the strip; check it here.
  const results = await new AxeBuilder({ page })
    .include('section[aria-label="Free agency"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.nodes[0]?.target.join(" ")}`);
  expect(blocking).toEqual([]);
});

test("no ticker away from the deadline", async ({
  page,
  regularSeasonSave,
}) => {
  await page.goto(regularSeasonSave(), { waitUntil: "networkidle" });
  await expect(page.getByRole("list", { name: /moves$/ })).toHaveCount(0);
});
