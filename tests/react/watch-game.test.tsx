import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
}));

import { GameRow } from "@/components/basketball/GameRow";
import { LeagueGameRow } from "@/components/basketball/LeagueGameRow";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import {
  BASE_PLAY_MS,
  WatchGameClient,
} from "@/components/game/watch/WatchGameClient";
import { WatchGameUnavailable } from "@/components/game/watch/WatchGameUnavailable";
import type {
  WatchGameView,
  WatchHighlight,
  WatchPlay,
  WatchPlayKind,
  WatchSide,
} from "@/state/watch-game-view";

const BRANDING = {
  primaryColor: "#0B1F3A",
  secondaryColor: "#C4CED4",
  accentColor: "#F5B800",
  logoId: "shield",
} as never;

function play(
  index: number,
  partial: {
    period: number;
    clock: number;
    poss: number;
    kind: WatchPlayKind;
    side: WatchSide;
    playerId: string;
    player2Id?: string | null;
    text: string;
    points: number;
    homeScore: number;
    awayScore: number;
    highlights?: WatchHighlight[];
  },
): WatchPlay {
  const minutes = Math.floor(partial.clock / 60);
  const seconds = String(partial.clock % 60).padStart(2, "0");
  return {
    index,
    periodLabel: `Q${partial.period}`,
    clockLabel: `${minutes}:${seconds}`,
    player2Id: null,
    highlights: [],
    ...partial,
  } as WatchPlay;
}

// AWY (side 1) beats HOM (side 0) 10-8.
const PLAYS: WatchPlay[] = [
  play(0, {
    period: 1,
    clock: 700,
    poss: 1,
    kind: "three_made",
    side: 0,
    playerId: "h1",
    player2Id: "h2",
    text: "J. Smith makes 3-pt shot (K. Lee assists)",
    points: 3,
    homeScore: 3,
    awayScore: 0,
  }),
  play(1, {
    period: 1,
    clock: 660,
    poss: 2,
    kind: "two_made",
    side: 1,
    playerId: "a1",
    text: "M. Jones makes 2-pt shot",
    points: 2,
    homeScore: 3,
    awayScore: 2,
  }),
  play(2, {
    period: 1,
    clock: 600,
    poss: 3,
    kind: "two_made",
    side: 1,
    playerId: "a2",
    player2Id: "a1",
    text: "T. Reed makes 2-pt shot (M. Jones assists)",
    points: 2,
    homeScore: 3,
    awayScore: 4,
    highlights: ["lead_change"],
  }),
  play(3, {
    period: 1,
    clock: 540,
    poss: 4,
    kind: "two_made",
    side: 0,
    playerId: "h2",
    text: "K. Lee makes 2-pt shot",
    points: 2,
    homeScore: 5,
    awayScore: 4,
  }),
  play(4, {
    period: 1,
    clock: 480,
    poss: 5,
    kind: "ft_made",
    side: 1,
    playerId: "a1",
    text: "M. Jones makes free throw",
    points: 1,
    homeScore: 5,
    awayScore: 5,
    highlights: ["tie"],
  }),
  play(5, {
    period: 1,
    clock: 420,
    poss: 6,
    kind: "shooting_foul",
    side: 1,
    playerId: "a2",
    player2Id: "h1",
    text: "Shooting foul on T. Reed (J. Smith fouled)",
    points: 0,
    homeScore: 5,
    awayScore: 5,
  }),
  play(6, {
    period: 1,
    clock: 420,
    poss: 6,
    kind: "ft_made",
    side: 0,
    playerId: "h1",
    text: "J. Smith makes free throw",
    points: 1,
    homeScore: 6,
    awayScore: 5,
  }),
  play(7, {
    period: 1,
    clock: 300,
    poss: 7,
    kind: "substitution",
    side: 0,
    playerId: "h2",
    player2Id: "h3",
    text: "B. Bench checks in for K. Lee",
    points: 0,
    homeScore: 6,
    awayScore: 5,
  }),
  play(8, {
    period: 2,
    clock: 650,
    poss: 8,
    kind: "two_missed",
    side: 1,
    playerId: "a1",
    text: "M. Jones misses 2-pt shot",
    points: 0,
    homeScore: 6,
    awayScore: 5,
  }),
  play(9, {
    period: 2,
    clock: 650,
    poss: 8,
    kind: "defensive_rebound",
    side: 0,
    playerId: "h1",
    text: "J. Smith defensive rebound",
    points: 0,
    homeScore: 6,
    awayScore: 5,
  }),
  play(10, {
    period: 2,
    clock: 500,
    poss: 9,
    kind: "three_made",
    side: 1,
    playerId: "a1",
    player2Id: "a2",
    text: "M. Jones makes 3-pt shot (T. Reed assists)",
    points: 3,
    homeScore: 6,
    awayScore: 8,
    highlights: ["lead_change"],
  }),
  play(11, {
    period: 2,
    clock: 400,
    poss: 10,
    kind: "turnover",
    side: 0,
    playerId: "h3",
    player2Id: "a2",
    text: "B. Bench turnover (T. Reed steals)",
    points: 0,
    homeScore: 6,
    awayScore: 8,
  }),
  play(12, {
    period: 2,
    clock: 300,
    poss: 11,
    kind: "two_made",
    side: 0,
    playerId: "h3",
    text: "B. Bench makes 2-pt shot",
    points: 2,
    homeScore: 8,
    awayScore: 8,
    highlights: ["tie"],
  }),
  play(13, {
    period: 2,
    clock: 200,
    poss: 12,
    kind: "two_made",
    side: 1,
    playerId: "a2",
    text: "T. Reed makes 2-pt shot",
    points: 2,
    homeScore: 8,
    awayScore: 10,
  }),
];

const VIEW: WatchGameView = {
  gameId: "game_1" as never,
  date: "2026-11-01",
  competitionType: "regular_season" as never,
  home: {
    teamId: "t_h" as never,
    side: 0,
    city: "Harbor",
    name: "Waves",
    abbreviation: "HOM",
    branding: BRANDING,
  },
  away: {
    teamId: "t_a" as never,
    side: 1,
    city: "Visitor",
    name: "Hawks",
    abbreviation: "AWY",
    branding: BRANDING,
  },
  finalScore: { home: 8, away: 10 },
  periodScores: [
    { home: 6, away: 5 },
    { home: 2, away: 5 },
  ],
  players: [
    {
      playerId: "h1" as never,
      side: 0,
      fullName: "Jalen Smith",
      shortName: "J. Smith",
      started: true,
      finalMinutes: 20,
    },
    {
      playerId: "h2" as never,
      side: 0,
      fullName: "Kyle Lee",
      shortName: "K. Lee",
      started: true,
      finalMinutes: 12,
    },
    {
      playerId: "h3" as never,
      side: 0,
      fullName: "Ben Bench",
      shortName: "B. Bench",
      started: false,
      finalMinutes: 8,
    },
    {
      playerId: "a1" as never,
      side: 1,
      fullName: "Marcus Jones",
      shortName: "M. Jones",
      started: true,
      finalMinutes: 22,
    },
    {
      playerId: "a2" as never,
      side: 1,
      fullName: "Tom Reed",
      shortName: "T. Reed",
      started: true,
      finalMinutes: 18,
    },
  ],
  plays: PLAYS,
  keyMoments: [
    {
      kind: "lead_change",
      playIndex: 10,
      periodLabel: "Q2",
      clockLabel: "8:20",
      side: 1,
      title: "Away takes the lead",
      detail: "AWY leads 8-6",
    },
    {
      kind: "injury",
      playIndex: null,
      periodLabel: null,
      clockLabel: null,
      side: 1,
      title: "T. Reed injured",
      detail: "Ankle sprain (minor)",
    },
  ],
  shotSummary: {
    home: { total: emptyLine(), byPeriod: [] },
    away: { total: emptyLine(), byPeriod: [] },
    players: [],
  },
  injuries: [],
};

function emptyLine() {
  return {
    points: 0,
    fgm: 0,
    fga: 0,
    twoPm: 0,
    twoPa: 0,
    threePm: 0,
    threePa: 0,
    ftm: 0,
    fta: 0,
    assistedFgm: 0,
  };
}

const FINAL_SCORE_LABEL = "Score: AWY 10, HOM 8";
const START_SCORE_LABEL = "Score: AWY 0, HOM 0";

function renderClient() {
  return render(<WatchGameClient view={VIEW} saveId="save_test" />);
}

function advance(plays: number, speed = 1) {
  act(() => {
    vi.advanceTimersByTime((plays * BASE_PLAY_MS) / speed);
  });
}

function progressText(revealed: number) {
  return `${revealed} / ${PLAYS.length} plays`;
}

function feed() {
  return within(screen.getByTestId("play-feed"));
}

function statCells(playerName: string): string[] {
  const row = screen
    .getAllByRole("row")
    .find((candidate) => candidate.textContent?.includes(playerName));
  expect(row).toBeDefined();
  return within(row!)
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "");
}

describe("WatchGameClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts at 0-0 with no plays and no final score visible", () => {
    renderClient();
    expect(screen.getByRole("group", { name: START_SCORE_LABEL })).toBeTruthy();
    expect(screen.queryByLabelText(FINAL_SCORE_LABEL)).toBeNull();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText(progressText(0))).toBeTruthy();
    expect(feed().queryByText(/makes/)).toBeNull();
    expect(screen.queryByText("Final")).toBeNull();
    expect(screen.queryByText("T. Reed injured")).toBeNull();
  });

  it("reveals one play per BASE_PLAY_MS at 1x and stops on Pause", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(1);
    expect(screen.getByText(progressText(1))).toBeTruthy();
    expect(
      feed().getByText("J. Smith makes 3-pt shot (K. Lee assists)"),
    ).toBeTruthy();
    advance(2);
    expect(screen.getByText(progressText(3))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    advance(5);
    expect(screen.getByText(progressText(3))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("reveals four plays in the same time at 4x", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "4x" }));
    expect(
      screen.getByRole("button", { name: "4x" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "1x" }).getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(BASE_PLAY_MS);
    });
    expect(screen.getByText(progressText(4))).toBeTruthy();
  });

  it("auto-stops at the end, shows Final, and only then shows the injury", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(PLAYS.length - 1);
    expect(screen.getByText(progressText(PLAYS.length - 1))).toBeTruthy();
    expect(screen.queryByText("Final")).toBeNull();
    expect(screen.queryByText("T. Reed injured")).toBeNull();

    advance(1);
    expect(screen.getByText(progressText(PLAYS.length))).toBeTruthy();
    expect(screen.getByText("Final")).toBeTruthy();
    expect(screen.getByRole("group", { name: FINAL_SCORE_LABEL })).toBeTruthy();
    expect(screen.getByText("T. Reed injured")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Play" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    advance(5);
    expect(screen.getByText(progressText(PLAYS.length))).toBeTruthy();
  });

  it("skips to the end and restarts to 0-0", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Skip to end" }));
    expect(screen.getByRole("group", { name: FINAL_SCORE_LABEL })).toBeTruthy();
    expect(screen.getByText("Final")).toBeTruthy();
    expect(screen.getByText("Away takes the lead")).toBeTruthy();
    expect(screen.getByText("T. Reed injured")).toBeTruthy();
    expect(screen.getAllByText("MIN")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByRole("group", { name: START_SCORE_LABEL })).toBeTruthy();
    expect(screen.queryByText("Final")).toBeNull();
    expect(screen.queryByText("T. Reed injured")).toBeNull();
    expect(screen.queryByText("MIN")).toBeNull();
    expect(screen.getByText(progressText(0))).toBeTruthy();
  });

  it("updates the live box score as plays are revealed", () => {
    renderClient();
    expect(statCells("J. Smith")[1]).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(1);
    expect(statCells("J. Smith")[1]).toBe("3");
    expect(statCells("K. Lee")[3]).toBe("1");
    advance(6);
    expect(statCells("J. Smith")[1]).toBe("4");
    // Substitution at play 7 puts B. Bench on the floor.
    expect(statCells("B. Bench")[0]).not.toContain("on court");
    advance(1);
    expect(statCells("B. Bench")[0]).toContain("on court");
    expect(statCells("K. Lee")[0]).not.toContain("on court");
  });

  it("jumps the feed to a key moment and pauses", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(12);
    expect(screen.getByText(progressText(12))).toBeTruthy();
    expect(feed().getByText("B. Bench turnover (T. Reed steals)")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /Away takes the lead/ }),
    );
    expect(screen.getByText(progressText(11))).toBeTruthy();
    expect(
      feed().getByText("M. Jones makes 3-pt shot (T. Reed assists)"),
    ).toBeTruthy();
    expect(feed().queryByText("B. Bench turnover (T. Reed steals)")).toBeNull();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    advance(3);
    expect(screen.getByText(progressText(11))).toBeTruthy();
  });

  it("shows highlight badges once the plays are revealed", () => {
    renderClient();
    expect(feed().queryByText("Lead change")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(3);
    expect(feed().getByText("Lead change")).toBeTruthy();
    expect(feed().queryByText("Tie")).toBeNull();
    advance(2);
    expect(feed().getByText("Tie")).toBeTruthy();
  });

  it("groups a possession into one row and shows substitutions on their own", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Skip to end" }));
    const foul = feed().getByText("Shooting foul on T. Reed (J. Smith fouled)");
    const freeThrow = feed().getByText("J. Smith makes free throw");
    expect(foul.closest("li")).toBe(freeThrow.closest("li"));
    const sub = feed().getByText("B. Bench checks in for K. Lee");
    expect(sub.closest("li")).not.toBe(foul.closest("li"));
    expect(feed().getByText("End of Q1")).toBeTruthy();
  });
});

describe("WatchGameUnavailable", () => {
  it("explains the missing log and links back to the box score", () => {
    render(<WatchGameUnavailable saveId="save_test" gameId="game_1" />);
    expect(screen.getByText("Play-by-play not recorded")).toBeTruthy();
    expect(
      screen.getByText(/Only your team's games from this season/),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Box score/ }).getAttribute("href"),
    ).toBe("/dashboard/save_test/games/game_1");
    expect(
      screen.getByRole("link", { name: "Schedule" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/schedule");
    cleanup();
  });
});

describe("Watch entry-point links", () => {
  const gameRow = (canWatch?: boolean) => (
    <EntityDrawerProvider saveId="save_test">
      <GameRow
        saveId="save_test"
        gameId="game_1"
        date="2026-11-01"
        home
        opponentAbbreviation="RIV"
        teamScore={110}
        opponentScore={102}
        won
        canOpenResult
        canWatch={canWatch}
      />
    </EntityDrawerProvider>
  );
  const leagueRow = (canWatch?: boolean) => (
    <EntityDrawerProvider saveId="save_test">
      <LeagueGameRow
        saveId="save_test"
        gameId="game_1"
        date="2026-11-01"
        homeTeamId="t_h"
        awayTeamId="t_a"
        homeAbbreviation="HOM"
        awayAbbreviation="AWY"
        homeScore={100}
        awayScore={90}
        status="final"
        canWatch={canWatch}
      />
    </EntityDrawerProvider>
  );

  it("GameRow shows Watch only when canWatch is true", () => {
    const { container, unmount } = render(gameRow(true));
    expect(
      screen.getByRole("link", { name: "Watch" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/games/game_1/watch");
    expect(container.querySelector("a a")).toBeNull();
    unmount();
    render(gameRow());
    expect(screen.queryByRole("link", { name: "Watch" })).toBeNull();
    cleanup();
  });

  it("LeagueGameRow shows Watch only when canWatch is true", () => {
    const { unmount } = render(leagueRow(true));
    expect(
      screen.getByRole("link", { name: "Watch" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/games/game_1/watch");
    unmount();
    render(leagueRow(false));
    expect(screen.queryByRole("link", { name: "Watch" })).toBeNull();
    cleanup();
  });
});
