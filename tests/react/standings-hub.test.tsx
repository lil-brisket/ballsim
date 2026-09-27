import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  loadPlayerDrawerAction: vi.fn(),
  loadTeamDrawerAction: vi.fn(),
  takeOverFranchiseAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/s1/standings",
  useSearchParams: () => new URLSearchParams(),
}));

import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { LeagueLeaders } from "@/components/standings/LeagueLeaders";
import { PlayoffRaceWidget } from "@/components/standings/PlayoffRaceWidget";
import { StandingsControls } from "@/components/standings/StandingsControls";
import { StandingsTable } from "@/components/standings/StandingsTable";
import type { LeagueLeadersView } from "@/state/league-leaders-selectors";
import type {
  PlayoffRaceView,
  StandingsGroup,
  StandingsPageView,
  StandingsRowEnriched,
} from "@/state/standings-selectors";

function wrap(ui: React.ReactNode) {
  return <EntityDrawerProvider saveId="s1">{ui}</EntityDrawerProvider>;
}

const row = (
  overrides: Partial<StandingsRowEnriched> = {},
): StandingsRowEnriched => ({
  teamId: "t1",
  abbreviation: "BOS",
  city: "Boston",
  name: "Celtics",
  wins: 12,
  losses: 4,
  winPercentage: 0.75,
  streak: { type: "W", count: 3 },
  conferenceId: "c1",
  conferenceName: "East",
  divisionId: "d1",
  divisionName: "Atlantic",
  conferenceRank: 1,
  leagueRank: 1,
  divisionRank: 1,
  gamesBackConference: 0,
  gamesBackLeague: 0,
  gamesBackDivision: 0,
  gamesPlayed: 16,
  pointsFor: 1760,
  pointsAgainst: 1600,
  pointDifferential: 160,
  ppg: 110,
  oppPpg: 100,
  net: 10,
  isUserTeam: false,
  playoffLabel: "playoff",
  branding: null,
  ...overrides,
});

describe("StandingsControls", () => {
  it("renders view and stats options with aria-current on the active pill", () => {
    const { unmount } = render(
      wrap(
        <StandingsControls
          saveId="s1"
          view="conference"
          stats="advanced"
          divisionsEnabled={true}
          searchParams={{
            view: "conference",
            stats: "advanced",
            error: "boom",
          }}
        />,
      ),
    );
    const conference = screen.getByTestId("standings-view-conference");
    expect(conference.getAttribute("aria-current")).toBe("page");
    expect(conference.getAttribute("href")).toContain("view=conference");
    expect(conference.getAttribute("href")).toContain("stats=advanced");
    expect(conference.getAttribute("href")).not.toContain("error=");

    const overall = screen.getByTestId("standings-view-overall");
    expect(overall.getAttribute("href")).toContain("stats=advanced");
    expect(overall.getAttribute("href") ?? "").not.toMatch(/[?&]view=/);

    expect(screen.getByTestId("standings-reset")).toBeTruthy();
    unmount();
  });

  it("hides the Division pill when divisions are disabled", () => {
    const { unmount } = render(
      wrap(
        <StandingsControls
          saveId="s1"
          view="overall"
          stats="standard"
          divisionsEnabled={false}
        />,
      ),
    );
    expect(screen.queryByTestId("standings-view-division")).toBeNull();
    expect(screen.queryByTestId("standings-reset")).toBeNull();
    unmount();
  });
});

describe("StandingsTable", () => {
  const group: StandingsGroup = {
    id: "league",
    name: "League",
    kind: "overall",
    cutoffRank: 1,
    rows: [
      row(),
      row({
        teamId: "t2",
        abbreviation: "DAL",
        city: "Dallas",
        name: "Desperados",
        leagueRank: 2,
        wins: 11,
        losses: 5,
        winPercentage: 0.688,
        gamesBackLeague: 1,
        playoffLabel: "na",
        ppg: 108,
        oppPpg: 104,
        net: 4,
      }),
    ],
  };

  const page: Pick<
    StandingsPageView,
    "mode" | "stats" | "playoffTeamCount" | "ownedTeamIds"
  > = {
    mode: "regular",
    stats: "standard",
    playoffTeamCount: 1,
    ownedTeamIds: ["t1"],
  };

  it("renders standard columns", () => {
    render(wrap(<StandingsTable saveId="s1" group={group} page={page} />));
    expect(screen.getByTestId("standings-col-w")).toBeTruthy();
    expect(screen.getByTestId("standings-col-pct")).toBeTruthy();
    expect(screen.queryByTestId("standings-col-ppg")).toBeNull();
  });

  it("renders advanced columns", () => {
    render(
      wrap(
        <StandingsTable
          saveId="s1"
          group={group}
          page={{ ...page, stats: "advanced" }}
        />,
      ),
    );
    expect(screen.getByTestId("standings-col-ppg")).toBeTruthy();
    expect(screen.getByTestId("standings-col-ortg")).toBeTruthy();
    expect(screen.getByTestId("standings-col-drtg")).toBeTruthy();
  });
});

describe("LeagueLeaders", () => {
  it("renders six empty cards and the no-qualifier note", () => {
    const view: LeagueLeadersView = {
      minGames: 1,
      minFgAttempts: 3,
      allEmpty: true,
      cards: [
        { key: "ppg", label: "PPG", leader: null },
        { key: "rpg", label: "RPG", leader: null },
        { key: "apg", label: "APG", leader: null },
        { key: "spg", label: "SPG", leader: null },
        { key: "bpg", label: "BPG", leader: null },
        { key: "fgPct", label: "FG%", leader: null },
      ],
    };
    render(wrap(<LeagueLeaders saveId="s1" view={view} />));
    expect(screen.getByTestId("standings-leader-ppg")).toBeTruthy();
    expect(screen.getByText("No qualified players yet.")).toBeTruthy();
  });
});

describe("PlayoffRaceWidget", () => {
  it("renders the divider after the cutoff team entry", () => {
    const view: PlayoffRaceView = {
      applicable: true,
      cutoffRank: 1,
      playoffTeamCount: 1,
      above: [
        {
          teamId: "t1",
          abbreviation: "BOS",
          city: "Boston",
          name: "Celtics",
          wins: 12,
          losses: 4,
          winPercentage: 0.75,
          leagueRank: 1,
          inField: true,
          isUserTeam: true,
          branding: null,
        },
      ],
      below: [
        {
          teamId: "t2",
          abbreviation: "DAL",
          city: "Dallas",
          name: "Desperados",
          wins: 11,
          losses: 5,
          winPercentage: 0.688,
          leagueRank: 2,
          inField: false,
          isUserTeam: false,
          branding: null,
        },
      ],
    };
    render(wrap(<PlayoffRaceWidget saveId="s1" view={view} />));
    const divider = screen.getByTestId("playoff-race-divider");
    const boston = screen.getByTestId("playoff-race-team-t1");
    const dallas = screen.getByTestId("playoff-race-team-t2");
    expect(
      boston.compareDocumentPosition(divider) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      divider.compareDocumentPosition(dallas) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
