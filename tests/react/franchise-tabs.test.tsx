import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  FranchiseLedgerTable,
  toFranchiseIdentityChanges,
} from "@/components/franchise/FranchiseLedgerTable";
import { FranchiseSubNav } from "@/components/franchise/FranchiseSubNav";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";

afterEach(() => {
  cleanup();
});

function season(
  seasonYear: number,
  overrides: Partial<FranchiseSeasonRecord> = {},
): FranchiseSeasonRecord {
  return {
    seasonId: `season_${seasonYear}`,
    seasonYear,
    wins: 41,
    losses: 41,
    playoffResult: "missed",
    championship: false,
    revenue: 150_000_000,
    expenses: 140_000_000,
    netIncome: 10_000_000,
    payroll: 120_000_000,
    leagueRank: 15,
    attendance: 700_000,
    businessFunds: 20_000_000,
    fanSentiment: 50,
    reputation: 50,
    facilityLevels: {
      arena: 1,
      practice: 1,
      training: 1,
      medical: 1,
      youth: 1,
      fan: 1,
    },
    relocated: false,
    city: "Toronto",
    name: "Falcons",
    notableEventIds: [],
    franchiseValue: 300_000_000,
    ...overrides,
  } as FranchiseSeasonRecord;
}

describe("FranchiseSubNav", () => {
  it("links Overview, History and Relocation under /franchise", () => {
    render(<FranchiseSubNav saveId="save_1" active="history" />);

    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("href"),
    ).toBe("/dashboard/save_1/franchise");
    expect(
      screen.getByRole("link", { name: "History" }).getAttribute("href"),
    ).toBe("/dashboard/save_1/franchise/history");
    expect(
      screen.getByRole("link", { name: "Relocation" }).getAttribute("href"),
    ).toBe("/dashboard/save_1/franchise/relocation");
    expect(
      screen
        .getByRole("link", { name: "History" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});

describe("Franchise history", () => {
  it("lists identity changes between consecutive seasons", () => {
    const changes = toFranchiseIdentityChanges([
      season(2026),
      season(2027),
      season(2028, { city: "Seattle", relocated: true }),
      season(2029, { city: "Seattle", name: "Storm" }),
    ]);

    expect(changes).toEqual([
      { seasonYear: 2028, from: "Toronto Falcons", to: "Seattle Falcons" },
      { seasonYear: 2029, from: "Seattle Falcons", to: "Seattle Storm" },
    ]);
  });

  it("renders the ledger newest first and marks relocated seasons", () => {
    render(
      <FranchiseLedgerTable
        seasons={[season(2026), season(2027, { relocated: true })]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]?.textContent).toContain("2027");
    expect(rows[0]?.textContent).toContain("relocated");
    expect(rows[1]?.textContent).toContain("2026");
    expect(rows[1]?.textContent).not.toContain("relocated");
  });
});
