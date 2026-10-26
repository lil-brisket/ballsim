import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  loadPlayerDrawerAction: vi.fn(),
  loadTeamDrawerAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/s1/league/player-stats",
  useSearchParams: () => new URLSearchParams(),
}));

import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import {
  LeaguePlayerStatsTable,
  LeagueTeamStatsTable,
} from "@/components/league/LeagueStatsTables";
import type {
  PlayerStatsRow,
  PlayerStatsView,
  TeamStatsView,
} from "@/state/league-stats-selectors";

afterEach(cleanup);

function wrap(ui: React.ReactNode) {
  return <EntityDrawerProvider saveId="s1">{ui}</EntityDrawerProvider>;
}

function playerRow(id: string, ppg: number): PlayerStatsRow {
  return {
    playerId: id,
    firstName: "Test",
    lastName: id,
    teamId: "t1",
    teamAbbreviation: "BOS",
    isUserTeam: false,
    values: {
      gp: 10,
      mpg: 30,
      ppg,
      rpg: 5,
      apg: 4,
      spg: 1,
      bpg: 0.5,
      tov: 2,
      fgPct: 48.2,
      threePct: null,
      ftPct: 80,
    },
  };
}

describe("LeagueTeamStatsTable", () => {
  it("renders sortable headers with the active sort flipped", () => {
    const view: TeamStatsView = {
      sort: { key: "ppg", dir: "desc" },
      gamesPlayed: 2,
      rows: [
        {
          teamId: "t1",
          city: "Boston",
          name: "Harriers",
          abbreviation: "BOS",
          branding: null,
          isUserTeam: true,
          values: {
            gp: 2,
            winPct: 0.5,
            ppg: 103,
            oppPpg: 95,
            net: 8,
            fgPct: 50,
            threePct: null,
            ftPct: 75,
            rpg: 8,
            apg: 20,
            spg: 7,
            bpg: 4,
            tov: 12,
          },
        },
      ],
    };
    render(wrap(<LeagueTeamStatsTable saveId="s1" view={view} />));
    const ppg = screen.getByTestId("league-stats-col-ppg");
    expect(ppg.getAttribute("aria-sort")).toBe("descending");
    expect(ppg.querySelector("a")!.getAttribute("href")).toBe(
      "/dashboard/s1/league/team-stats?sort=ppg&dir=asc",
    );
    expect(screen.getByText("+8.0")).toBeTruthy();
    expect(screen.getByText(".500")).toBeTruthy();
  });

  it("shows an empty state before games are played", () => {
    render(
      <LeagueTeamStatsTable
        saveId="s1"
        view={{ sort: { key: "ppg", dir: "desc" }, gamesPlayed: 0, rows: [] }}
      />,
    );
    expect(
      screen.getByText("No regular-season games played yet."),
    ).toBeTruthy();
  });
});

describe("LeaguePlayerStatsTable", () => {
  it("offers show all when the list is capped and keeps it while sorting", () => {
    const base: PlayerStatsView = {
      sort: { key: "ppg", dir: "desc" },
      rows: [playerRow("p1", 30), playerRow("p2", 25)],
      totalQualified: 80,
      showAll: false,
      minGames: 5,
      minAttemptsPerGame: 1,
    };
    const { unmount } = render(
      wrap(<LeaguePlayerStatsTable saveId="s1" view={base} />),
    );
    expect(
      screen.getByTestId("league-player-stats-toggle").getAttribute("href"),
    ).toBe("/dashboard/s1/league/player-stats?sort=ppg&dir=desc&show=all");
    unmount();

    render(
      wrap(
        <LeaguePlayerStatsTable
          saveId="s1"
          view={{ ...base, showAll: true }}
        />,
      ),
    );
    expect(
      screen
        .getByTestId("league-stats-col-rpg")
        .querySelector("a")!
        .getAttribute("href"),
    ).toBe("/dashboard/s1/league/player-stats?show=all&sort=rpg");
    expect(screen.getByText("Show top 50")).toBeTruthy();
  });
});
