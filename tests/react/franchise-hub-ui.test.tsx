import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FacilitiesSummarySection } from "@/components/franchise/FacilitiesSummarySection";
import { FinanceSnapshotCard } from "@/components/franchise/FinanceSnapshotCard";
import { RelocationSummarySection } from "@/components/franchise/RelocationSummarySection";
import type {
  FranchiseFacilitiesSummary,
  FranchiseFinanceSnapshot,
  FranchiseRelocationSummary,
} from "@/state/franchise-hub-selectors";
import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";

afterEach(() => {
  cleanup();
});

const facilities: FranchiseFacilitiesSummary = {
  levels: FACILITY_CATEGORIES.map((category) => ({
    category,
    level: category === "arena" ? 3 : 1,
    upgrading: category === "practice",
  })),
  upgradingCount: 1,
  availableUpgradeCount: 4,
  weeklyOpex: 55_000,
  arenaCapacity: 18_000,
};

const finance: FranchiseFinanceSnapshot = {
  cash: 12_000_000,
  health: "stable",
  runwayWeeks: 8,
  projectedCash: 10_500_000,
};

function relocation(
  overrides: Partial<FranchiseRelocationSummary>,
): FranchiseRelocationSummary {
  return {
    state: "not_available",
    statusLabel: "not relevant",
    marketSize: 55,
    estimatedFee: 25_000_000,
    cooldownSeasonsRemaining: 0,
    primaryDriver: null,
    href: null,
    ...overrides,
  };
}

describe("Franchise hub UI", () => {
  it("renders renovation levels and a facilities destination without a form", () => {
    const { container } = render(
      <FacilitiesSummarySection summary={facilities} saveId="save_1" />,
    );
    expect(screen.getByText("Renovation")).toBeTruthy();
    expect(screen.getByText("Manage Facilities")).toBeTruthy();
    expect(screen.getByText("arena")).toBeTruthy();
    expect(screen.getByText(/1 upgrade in progress/)).toBeTruthy();
    expect(
      screen.getByRole("link").getAttribute("href"),
    ).toBe("/dashboard/save_1/facilities");
    expect(container.querySelector("form")).toBeNull();
  });

  it("links finances snapshot to the finances page without a form", () => {
    const { container } = render(
      <FinanceSnapshotCard snapshot={finance} saveId="save_1" />,
    );
    expect(screen.getByText("View Finances")).toBeTruthy();
    expect(screen.getByText("8 weeks")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/dashboard/save_1/finances",
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("does not offer Explore Relocation when href is null", () => {
    render(
      <RelocationSummarySection summary={relocation({ state: "not_available" })} />,
    );
    expect(screen.getByText("Relocation")).toBeTruthy();
    expect(screen.queryByText("Explore Relocation")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to the live relocation workflow when href is set", () => {
    const { container } = render(
      <RelocationSummarySection
        summary={relocation({
          state: "eligible",
          statusLabel: "strong case",
          href: "/dashboard/save_1/relocation",
          primaryDriver: "Weak local market",
        })}
      />,
    );
    expect(screen.getByText("Explore Relocation")).toBeTruthy();
    expect(screen.getByText("Weak local market")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/dashboard/save_1/relocation",
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows in-progress copy without a link when href is null", () => {
    render(
      <RelocationSummarySection
        summary={relocation({
          state: "in_progress",
          statusLabel: "in progress",
          href: null,
        })}
      />,
    );
    expect(screen.getByText("Relocation is underway.")).toBeTruthy();
    expect(screen.queryByText("Explore Relocation")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
