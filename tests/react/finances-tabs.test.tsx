import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  upgradeFacilityAction: vi.fn(),
}));

import { FacilityUpgradeList } from "@/components/finances/FacilityUpgradeList";
import { FinancesSubNav } from "@/components/finances/FinancesSubNav";
import type { FacilityRowView } from "@/state/franchise-selectors";

afterEach(() => {
  cleanup();
});

function row(overrides: Partial<FacilityRowView>): FacilityRowView {
  return {
    category: "practice",
    level: 1,
    upgradeWeeksRemaining: 0,
    upgradeCost: 5_000_000,
    ...overrides,
  };
}

describe("FinancesSubNav", () => {
  it("links Overview, Payroll, Activity and Arena & Facilities under /finances", () => {
    render(<FinancesSubNav saveId="save_1" active="facilities" />);

    const hrefs: Record<string, string> = {
      Overview: "/dashboard/save_1/finances",
      Payroll: "/dashboard/save_1/finances/payroll",
      Activity: "/dashboard/save_1/finances/activity",
      "Arena & Facilities": "/dashboard/save_1/finances/facilities",
    };
    for (const [name, href] of Object.entries(hrefs)) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(
        href,
      );
    }
    expect(
      screen
        .getByRole("link", { name: "Arena & Facilities" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});

describe("FacilityUpgradeList", () => {
  it("lists the arena first with current and next-level capacity", () => {
    render(
      <FacilityUpgradeList
        saveId="save_1"
        returnPath="/dashboard/save_1/finances/facilities"
        rows={[
          row({ category: "practice" }),
          row({ category: "arena", level: 2 }),
        ]}
      />,
    );

    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.querySelector("p")?.textContent);
    expect(names).toEqual(["arena", "practice"]);
    expect(
      screen.getByText("Capacity 15,000 → 18,000 seats next level"),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Upgrade/ })).toHaveLength(2);
    const returnInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name="returnPath"]',
    );
    expect(returnInputs[0]?.value).toBe(
      "/dashboard/save_1/finances/facilities",
    );
  });

  it("separates max level from upgrades in progress", () => {
    render(
      <FacilityUpgradeList
        saveId="save_1"
        returnPath="/dashboard/save_1/finances/facilities"
        rows={[
          row({ category: "arena", level: 5, upgradeCost: null }),
          row({
            category: "medical",
            level: 2,
            upgradeWeeksRemaining: 3,
            upgradeCost: null,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Capacity 25,000 seats")).toBeTruthy();
    expect(screen.getByText("Max level")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText(/upgrading \(3 weeks left\)/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
