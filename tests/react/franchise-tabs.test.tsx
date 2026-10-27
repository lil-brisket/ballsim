import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  FranchiseLedgerTable,
  toFranchiseIdentityChanges,
} from "@/components/franchise/FranchiseLedgerTable";
import { FranchiseViews } from "@/components/franchise/FranchiseViews";
import {
  FRANCHISE_TREND_SEASONS,
  toFranchiseTrends,
} from "@/components/franchise/FranchiseTrends";
import { MarketComparison } from "@/components/franchise/MarketComparison";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import type { DestinationEvaluation } from "@/state/market-destination";

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

describe("FranchiseViews", () => {
  it("links Overview, Ownership, History and Relocation under /franchise", () => {
    render(<FranchiseViews saveId="save_1" active="history" />);

    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("href"),
    ).toBe("/dashboard/save_1/franchise");
    expect(
      screen.getByRole("link", { name: "Ownership" }).getAttribute("href"),
    ).toBe("/dashboard/save_1/franchise/ownership");
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
      season(2028, {
        city: "Seattle",
        relocated: true,
        franchiseValue: 340_000_000,
        fanSentiment: 30,
      }),
      season(2029, {
        city: "Seattle",
        name: "Storm",
        franchiseValue: 360_000_000,
        fanSentiment: 45,
      }),
    ]);

    expect(changes).toEqual([
      {
        seasonYear: 2028,
        kind: "relocation",
        from: "Toronto Falcons",
        to: "Seattle Falcons",
        valueBefore: 300_000_000,
        valueAfter: 340_000_000,
        sentimentBefore: 50,
        sentimentAfter: 30,
      },
      {
        seasonYear: 2029,
        kind: "rebrand",
        from: "Seattle Falcons",
        to: "Seattle Storm",
        valueBefore: 340_000_000,
        valueAfter: 360_000_000,
        sentimentBefore: 30,
        sentimentAfter: 45,
      },
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

describe("Franchise trends", () => {
  it("ends value and sentiment at today's figures; win % uses completed seasons", () => {
    const trends = toFranchiseTrends(
      [
        season(2026, { wins: 30, losses: 52, netIncome: -5_000_000 }),
        season(2027, { wins: 50, losses: 32, netIncome: 8_000_000 }),
      ],
      { franchiseValue: 330_000_000, fanSentiment: 42 },
    );

    const byLabel = Object.fromEntries(trends.map((t) => [t.label, t]));
    expect(byLabel["Franchise value"]?.values).toEqual([
      300_000_000, 300_000_000, 330_000_000,
    ]);
    expect(byLabel["Franchise value"]?.direction).toBe("up");
    expect(byLabel["Fan sentiment"]?.values).toEqual([50, 50, 42]);
    expect(byLabel["Fan sentiment"]?.direction).toBe("down");
    expect(byLabel["Win %"]?.values).toHaveLength(2);
    expect(byLabel["Win %"]?.change).toBe("+24%");
    expect(byLabel["Net income"]?.values).toEqual([-5_000_000, 8_000_000]);
  });

  it("caps history at the trend window and needs two points", () => {
    const many = Array.from({ length: FRANCHISE_TREND_SEASONS + 5 }, (_, i) =>
      season(2000 + i),
    );
    const trends = toFranchiseTrends(many, {
      franchiseValue: 1,
      fanSentiment: 1,
    });
    expect(trends.find((t) => t.label === "Win %")?.values).toHaveLength(
      FRANCHISE_TREND_SEASONS,
    );

    expect(
      toFranchiseTrends([], { franchiseValue: 1, fanSentiment: 1 }),
    ).toEqual([]);
  });
});

describe("MarketComparison", () => {
  function destination(city: string, delta: number): DestinationEvaluation {
    return {
      city,
      name: "Falcons",
      abbreviation: city.slice(0, 3).toUpperCase(),
      marketSize: 60 + delta,
      marketSizeDelta: delta,
      marketPotential: (60 + delta) * 2_800_000,
      opportunity: "high",
      risk: "moderate",
      uncertainty: "low",
      reasons: [`${city} is a larger market`],
      credibleImprovement: true,
    };
  }

  it("shows the current market beside at most three destinations", () => {
    render(
      <MarketComparison
        currentCity="Toronto"
        marketSize={60}
        attendanceRealization={0.55}
        destinations={[
          destination("Seattle", 15),
          destination("Denver", 10),
          destination("Austin", 5),
          destination("Omaha", -5),
        ]}
      />,
    );

    expect(screen.getByText("Current market")).toBeTruthy();
    expect(screen.getByText("55%")).toBeTruthy();
    expect(screen.getByText("Seattle")).toBeTruthy();
    expect(screen.getByText("(+15)")).toBeTruthy();
    expect(screen.getByText("Austin")).toBeTruthy();
    expect(screen.queryByText("Omaha")).toBeNull();
  });
});
