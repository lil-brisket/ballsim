import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  loadPlayerDrawerAction: vi.fn(),
  loadTeamDrawerAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/s1/league",
  useSearchParams: () => new URLSearchParams(),
}));

import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import {
  LeagueSnapshotPanel,
  LeagueStandingsSnapshot,
} from "@/components/league/LeagueTier1Panels";
import { MyTeamContextStrip } from "@/components/league/LeagueHeader";
import { LeagueTransactionsBriefing } from "@/components/league/LeagueTier2Panels";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import type { StandingsRowEnriched } from "@/state/standings-selectors";

const sampleRow: StandingsRowEnriched = {
  teamId: "t1",
  abbreviation: "BOS",
  city: "Boston",
  name: "Celtics",
  wins: 42,
  losses: 21,
  winPercentage: 0.667,
  streak: { type: "W", count: 4 },
  conferenceId: "c1",
  conferenceName: "Eastern Conference",
  divisionId: "d1",
  divisionName: "Atlantic",
  conferenceRank: 3,
  leagueRank: 5,
  gamesBackConference: 2.5,
  gamesBackLeague: 6,
  isUserTeam: true,
  playoffLabel: "playoff",
  branding: null,
};

function wrap(ui: React.ReactNode) {
  return <EntityDrawerProvider saveId="s1">{ui}</EntityDrawerProvider>;
}

describe("League Hub panels", () => {
  it("renders my team context strip", () => {
    render(
      wrap(
        <MyTeamContextStrip
          saveId="s1"
          teamId="t1"
          city="Boston"
          name="Celtics"
          abbreviation="BOS"
          wins={42}
          losses={21}
          conferenceRank={3}
          conferenceName="Eastern Conference"
          gamesBack={2.5}
          streakLabel="W4"
          leagueLeader={{ abbreviation: "OKC", wins: 48, losses: 15 }}
          cutoffTeam={{ abbreviation: "ATL", wins: 38, losses: 25 }}
        />,
      ),
    );
    expect(screen.getByText(/Your Team/i)).toBeTruthy();
    expect(screen.getByText(/42–21/)).toBeTruthy();
    expect(screen.getByText(/View Team/i)).toBeTruthy();
    expect(screen.getByText(/League Leader/i)).toBeTruthy();
  });

  it("renders standings snapshot with team entity link", () => {
    render(
      wrap(
        <LeagueStandingsSnapshot
          saveId="s1"
          rows={[sampleRow]}
          cutoffRank={8}
          includesUserOutsideTop={false}
        />,
      ),
    );
    expect(screen.getByText("BOS")).toBeTruthy();
    expect(screen.getByText(/View Standings/i)).toBeTruthy();
  });

  it("renders snapshot metrics", () => {
    render(
      wrap(
        <LeagueSnapshotPanel
          snapshot={{
            leaderAbbreviation: "OKC",
            leaderRecord: "48–15",
            userRank: 5,
            userRecord: "42–21",
            bestRecord: "48–15",
            worstRecord: "12–51",
            playoffRaceLabel: "Contending",
            mode: "regular",
            championAbbreviation: null,
          }}
        />,
      ),
    );
    expect(screen.getByText(/League Snapshot/i)).toBeTruthy();
    expect(screen.getByText(/#5/)).toBeTruthy();
  });

  it("shows empty transactions briefing", () => {
    render(wrap(<LeagueTransactionsBriefing saveId="s1" rows={[]} />));
    expect(screen.getByText(/No recent transactions/i)).toBeTruthy();
  });
});

describe("TransactionRow entity links", () => {
  it("renders two-sided trade with team and player links", () => {
    render(
      wrap(
        <TransactionRow
          saveId="s1"
          row={{
            id: "trade_1",
            type: "PlayerTraded",
            occurredOn: "2026-01-08",
            description: "BOS ↔ NYK",
            players: [
              { id: "p1", name: "Player A" },
              { id: "p2", name: "Player B" },
            ],
            teams: [
              { id: "t1", name: "Boston Celtics", abbreviation: "BOS" },
              { id: "t2", name: "New York Knicks", abbreviation: "NYK" },
            ],
            tradeSides: [
              {
                team: {
                  id: "t1",
                  name: "Boston Celtics",
                  abbreviation: "BOS",
                },
                players: [{ id: "p2", name: "Player B" }],
                assets: [],
              },
              {
                team: {
                  id: "t2",
                  name: "New York Knicks",
                  abbreviation: "NYK",
                },
                players: [{ id: "p1", name: "Player A" }],
                assets: [],
              },
            ],
            eventIds: ["e1", "e2"],
          }}
        />,
      ),
    );
    expect(screen.getByText("Trade")).toBeTruthy();
    expect(screen.getByText("Player A")).toBeTruthy();
    expect(screen.getByText("Player B")).toBeTruthy();
    expect(screen.getAllByText(/acquired/i).length).toBe(2);
  });
});
