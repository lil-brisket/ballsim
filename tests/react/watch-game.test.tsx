import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
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
  PERIOD_BREAK_MS,
  PLAY_PACING_MS,
  TIP_OFF_MS,
  TRANSITION_MS,
  playDelayMs,
} from "@/components/game/watch/playback-pacing";
import { WatchGameClient } from "@/components/game/watch/WatchGameClient";
import { WatchGameUnavailable } from "@/components/game/watch/WatchGameUnavailable";
import { TeamThemeScope } from "@/components/ui";
import { buildCourtPalette } from "@/state/court-palette";
import { stepPossession } from "@/state/watch-court-frame";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";
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
    hasBranding: true,
  },
  away: {
    teamId: "t_a" as never,
    side: 1,
    city: "Visitor",
    name: "Hawks",
    abbreviation: "AWY",
    branding: BRANDING,
    hasBranding: true,
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
      lastName: "Smith",
      position: "PG",
      started: true,
      finalMinutes: 20,
    },
    {
      playerId: "h2" as never,
      side: 0,
      fullName: "Kyle Lee",
      shortName: "K. Lee",
      lastName: "Lee",
      position: "SG",
      started: true,
      finalMinutes: 12,
    },
    {
      playerId: "h3" as never,
      side: 0,
      fullName: "Ben Bench",
      shortName: "B. Bench",
      lastName: "Bench",
      position: "SF",
      started: false,
      finalMinutes: 8,
    },
    {
      playerId: "a1" as never,
      side: 1,
      fullName: "Marcus Jones",
      shortName: "M. Jones",
      lastName: "Jones",
      position: "PG",
      started: true,
      finalMinutes: 22,
    },
    {
      playerId: "a2" as never,
      side: 1,
      fullName: "Tom Reed",
      shortName: "T. Reed",
      lastName: "Reed",
      position: "SF",
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

const FINAL_IN_SCOREBOARD = { selector: "#watch-scoreboard-status" };
const scoreboardFinal = () => screen.queryByText("Final", FINAL_IN_SCOREBOARD);
const slider = () => screen.getByRole("slider", { name: "Playback position" });

/** Plays revealed so far, read from the scrubber. */
function currentRevealed(): number {
  return Number(slider().getAttribute("aria-valuenow"));
}

function expectRevealed(revealed: number) {
  expect(currentRevealed()).toBe(revealed);
}

/** Opens the overflow menu and chooses one of its items. */
function chooseFromMenu(name: string) {
  fireEvent.click(
    screen.getByRole("button", { name: "More playback options" }),
  );
  fireEvent.click(
    within(screen.getByRole("menu")).getByRole(
      name === "Shot chart" ? "menuitemcheckbox" : "menuitem",
      { name },
    ),
  );
}

/**
 * Advances fake time by each next play's own pacing, one play at a time
 * (each reveal schedules the following timeout after React re-renders).
 */
function advance(plays: number, speed = 1) {
  const from = currentRevealed();
  for (let k = 0; k < plays; k += 1) {
    act(() => {
      vi.advanceTimersByTime(playDelayMs(VIEW, from + k) / speed);
    });
  }
}

function feed() {
  return within(screen.getByTestId("play-feed"));
}

/** Switches the stats area to one of its tabs. */
function openTab(name: "Play-by-play" | "Box score" | "Shot chart") {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Game stats" })).getByRole(
      "button",
      { name },
    ),
  );
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
    expectRevealed(0);
    expect(feed().queryByText(/makes/)).toBeNull();
    expect(scoreboardFinal()).toBeNull();
    expect(screen.queryByText("T. Reed injured")).toBeNull();
  });

  it("reveals plays at their own pacing at 1x and stops on Pause", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(1);
    expectRevealed(1);
    expect(
      feed().getByText("J. Smith makes 3-pt shot (K. Lee assists)"),
    ).toBeTruthy();
    advance(2);
    expectRevealed(3);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    advance(5);
    expectRevealed(3);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("plays four times faster at 4x", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "4x" }));
    expect(
      screen.getByRole("button", { name: "4x" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "1x" }).getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    // Tip-off plus three plays, each a quarter of its 1x pacing.
    advance(4, 4);
    expectRevealed(4);
    act(() => {
      vi.advanceTimersByTime(playDelayMs(VIEW, 4) / 4 - 1);
    });
    expectRevealed(4);
  });

  it("paces each play by kind and pauses between periods", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(TIP_OFF_MS - 1);
    });
    expectRevealed(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expectRevealed(1);

    // Play 0 is a made three that opens the game: it holds for the full shot
    // pacing plus the ball's trip up the floor from centre court.
    act(() => {
      vi.advanceTimersByTime(PLAY_PACING_MS.three_made + TRANSITION_MS - 1);
    });
    expectRevealed(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expectRevealed(2);

    expect(playDelayMs(VIEW, 7)).toBe(PLAY_PACING_MS.ft_made);
    // The substitution at play 7 is also the last play of Q1.
    expect(playDelayMs(VIEW, 8)).toBe(
      PLAY_PACING_MS.substitution + PERIOD_BREAK_MS,
    );
    const periodEnd = PLAYS.findIndex(
      (p, i) => PLAYS[i + 1] && PLAYS[i + 1]!.period !== p.period,
    );
    expect(periodEnd).toBeGreaterThanOrEqual(0);
    expect(playDelayMs(VIEW, periodEnd + 1)).toBe(
      PLAY_PACING_MS[PLAYS[periodEnd]!.kind] + PERIOD_BREAK_MS,
    );
  });

  it("resumes a paused play with the time it had left", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(1);
    const delay = playDelayMs(VIEW, 1);
    act(() => {
      vi.advanceTimersByTime(delay / 2);
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => {
      vi.advanceTimersByTime(delay * 4);
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => {
      vi.advanceTimersByTime(delay / 2 - 1);
    });
    expectRevealed(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expectRevealed(2);
  });

  it("keeps the time left of a play through a speed change", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(1);
    const delay = playDelayMs(VIEW, 1);
    act(() => {
      vi.advanceTimersByTime(delay / 2);
    });
    fireEvent.click(screen.getByRole("button", { name: "2x" }));
    act(() => {
      vi.advanceTimersByTime(delay / 4 - 1);
    });
    expectRevealed(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expectRevealed(2);
  });

  it("clears the pending step on unmount", () => {
    const { unmount } = renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("auto-stops at the end, shows Final, and only then shows the injury", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    advance(PLAYS.length - 1);
    expectRevealed(PLAYS.length - 1);
    expect(scoreboardFinal()).toBeNull();
    expect(screen.queryByText("T. Reed injured")).toBeNull();

    advance(1);
    expectRevealed(PLAYS.length);
    expect(screen.getByText("Final", FINAL_IN_SCOREBOARD)).toBeTruthy();
    expect(screen.getByRole("group", { name: FINAL_SCORE_LABEL })).toBeTruthy();
    expect(screen.getByText("T. Reed injured")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Play" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    advance(5);
    expectRevealed(PLAYS.length);
  });

  it("skips to the end and restarts to 0-0", () => {
    renderClient();
    chooseFromMenu("Skip to end");
    expect(screen.getByRole("group", { name: FINAL_SCORE_LABEL })).toBeTruthy();
    expect(screen.getByText("Final", FINAL_IN_SCOREBOARD)).toBeTruthy();
    expect(screen.getByText("Away takes the lead")).toBeTruthy();
    expect(screen.getByText("T. Reed injured")).toBeTruthy();
    openTab("Box score");
    expect(screen.getAllByText("MIN")).toHaveLength(2);

    chooseFromMenu("Restart");
    expect(screen.getByRole("group", { name: START_SCORE_LABEL })).toBeTruthy();
    expect(scoreboardFinal()).toBeNull();
    expect(screen.queryByText("MIN")).toBeNull();
    openTab("Play-by-play");
    expect(screen.queryByText("T. Reed injured")).toBeNull();
    expectRevealed(0);
  });

  describe("linescore", () => {
    function linescore() {
      return within(screen.getByRole("table", { name: "Points by quarter" }));
    }
    /** Text of each cell in a team's row, minus the screen-reader suffix. */
    function lineCells(abbreviation: string): string[] {
      const row = linescore()
        .getAllByRole("row")
        .find((r) => r.textContent?.startsWith(abbreviation));
      expect(row).toBeDefined();
      return within(row!)
        .getAllByRole("cell")
        .map((cell) => (cell.textContent ?? "").replace("not played", ""));
    }

    it("sums to the final score for each team", () => {
      renderClient();
      chooseFromMenu("Skip to end");
      for (const [abbr, total] of [
        ["AWY", VIEW.finalScore.away],
        ["HOM", VIEW.finalScore.home],
      ] as const) {
        const cells = lineCells(abbr);
        const periods = cells.slice(0, -1).map((c) => (c === "–" ? 0 : +c));
        expect(cells.at(-1)).toBe(String(total));
        expect(periods.reduce((a, b) => a + b, 0)).toBe(total);
        expect(cells.slice(0, 2)).toEqual(
          abbr === "AWY" ? ["5", "5"] : ["6", "2"],
        );
        expect(cells.slice(2)).toEqual(["–", "–", String(total)]);
      }
    });

    it("shows dashes for unplayed periods mid-game and before tip-off", () => {
      renderClient();
      expect(lineCells("AWY")).toEqual(["–", "–", "–", "–", "0"]);
      expect(lineCells("HOM")).toEqual(["–", "–", "–", "–", "0"]);

      const firstPeriod = PLAYS.filter((p) => p.period === 1).length;
      for (let i = 0; i < firstPeriod; i += 1) {
        fireEvent.keyDown(document, { key: "." });
      }
      expectRevealed(firstPeriod);
      expect(lineCells("AWY")).toEqual(["5", "–", "–", "–", "5"]);
      expect(lineCells("HOM")).toEqual(["6", "–", "–", "–", "6"]);
    });

    it("leaves the by-quarter table out of the shot summary", () => {
      renderClient();
      chooseFromMenu("Skip to end");
      openTab("Shot chart");
      expect(screen.queryByText("By quarter")).toBeNull();
      expect(
        screen.queryByRole("table", { name: "Shot summary by quarter" }),
      ).toBeNull();
      expect(
        screen.getAllByRole("table", { name: "Points by quarter" }),
      ).toHaveLength(1);
    });
  });

  it("updates the live box score as plays are revealed", () => {
    renderClient();
    openTab("Box score");
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
    expectRevealed(12);
    expect(feed().getByText("B. Bench turnover (T. Reed steals)")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /Away takes the lead/ }),
    );
    expectRevealed(11);
    expect(
      feed().getByText("M. Jones makes 3-pt shot (T. Reed assists)"),
    ).toBeTruthy();
    expect(feed().queryByText("B. Bench turnover (T. Reed steals)")).toBeNull();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    advance(3);
    expectRevealed(11);
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
    chooseFromMenu("Skip to end");
    const foul = feed().getByText("Shooting foul on T. Reed (J. Smith fouled)");
    const freeThrow = feed().getByText("J. Smith makes free throw");
    expect(foul.closest("li")).toBe(freeThrow.closest("li"));
    const sub = feed().getByText("B. Bench checks in for K. Lee");
    expect(sub.closest("li")).not.toBe(foul.closest("li"));
    expect(feed().getByText("End of Q1")).toBeTruthy();
  });

  describe("stats tabs", () => {
    it("has one tab row, defaulting to Play-by-play", () => {
      renderClient();
      const nav = within(
        screen.getByRole("navigation", { name: "Game stats" }),
      );
      expect(nav.getAllByRole("button").map((b) => b.textContent)).toEqual([
        "Play-by-play",
        "Box score",
        "Shot chart",
      ]);
      expect(
        nav
          .getByRole("button", { name: "Play-by-play" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByTestId("play-feed")).toBeTruthy();
      expect(screen.queryByText("MIN")).toBeNull();
    });

    it("shows the box score and the shot summary on their tabs", () => {
      renderClient();
      chooseFromMenu("Skip to end");
      openTab("Box score");
      expect(screen.getAllByText("MIN")).toHaveLength(2);
      expect(screen.queryByTestId("play-feed")).toBeNull();
      openTab("Shot chart");
      expect(screen.queryByText("MIN")).toBeNull();
      expect(
        screen.getByRole("heading", { name: "Shot summary" }),
      ).toBeTruthy();
      openTab("Play-by-play");
      expect(screen.getByTestId("play-feed")).toBeTruthy();
    });
  });

  describe("play-by-play feed rows", () => {
    it("jumps to a past row's last play", () => {
      renderClient();
      chooseFromMenu("Skip to end");
      // Possession 6 holds plays 5 and 6.
      fireEvent.click(
        feed().getByRole("button", { name: /Shooting foul on T\. Reed/ }),
      );
      expectRevealed(7);
      expect(feed().queryByText("B. Bench checks in for K. Lee")).toBeNull();
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    });

    it("highlights key-moment rows and shows the post-game injury only at the end", () => {
      renderClient();
      expect(screen.queryByText("Away takes the lead")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      advance(10);
      expect(screen.queryByText("Away takes the lead")).toBeNull();
      advance(1);
      const row = feed().getByRole("button", { name: /Away takes the lead/ });
      expect(row.className).toContain("bg-team");
      expect(within(row).getByText("AWY leads 8-6")).toBeTruthy();
      expect(
        within(row).getByText("M. Jones makes 3-pt shot (T. Reed assists)"),
      ).toBeTruthy();
      expect(screen.queryByText("T. Reed injured")).toBeNull();

      chooseFromMenu("Skip to end");
      const injury = feed().getByText("T. Reed injured");
      expect(injury.closest("button")).toBeNull();
      expect(feed().getAllByRole("listitem")[0]!.textContent).toContain(
        "T. Reed injured",
      );
    });

    it("shows the points scored and a body-size clock", () => {
      renderClient();
      chooseFromMenu("Skip to end");
      const row = feed().getByRole("button", {
        name: /M\. Jones makes 3-pt shot/,
      });
      expect(within(row).getByText("+3")).toBeTruthy();
      expect(within(row).getByText("Score")).toBeTruthy();
      const clock = within(row).getByText("Q2 8:20");
      expect(clock.className).not.toContain("text-xs");
      expect(clock.className).not.toContain("font-mono");
      const miss = feed().getByRole("button", {
        name: /M\. Jones misses 2-pt shot/,
      });
      expect(within(miss).queryByText(/^\+\d/)).toBeNull();
    });

    it("has no separate key moments panel", () => {
      renderClient();
      chooseFromMenu("Skip to end");
      expect(screen.queryByText("No key moments yet.")).toBeNull();
      expect(screen.queryByRole("heading", { name: "Key moments" })).toBeNull();
    });
  });
});

describe("WatchGameClient court", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const button = (name: string) =>
    screen.getByRole("button", { name }) as HTMLButtonElement;
  const tokenLabels = () =>
    screen
      .getAllByTestId("court-token")
      .map((token) => token.getAttribute("aria-label"));
  const card = () => within(screen.getByTestId("court-player-card"));
  const cardStats = () =>
    card()
      .getAllByRole("definition")
      .map((cell) => Number(cell.textContent));

  it("steps by possession and pauses playback", () => {
    renderClient();
    expect(button("Previous possession").disabled).toBe(true);
    fireEvent.click(button("Play"));
    advance(5);
    expectRevealed(5);

    // Plays 5-6 are one possession (foul + free throw).
    fireEvent.click(button("Next possession"));
    expectRevealed(7);
    expect(button("Play")).toBeTruthy();
    advance(3);
    expectRevealed(7);

    // The substitution at play 7 comes along with the next possession.
    fireEvent.click(button("Next possession"));
    expectRevealed(10);
    fireEvent.click(button("Previous possession"));
    expectRevealed(7);
    fireEvent.click(button("Previous possession"));
    expectRevealed(5);

    chooseFromMenu("Skip to end");
    expect(button("Next possession").disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "More playback options" }),
    );
    expect(
      screen
        .getByRole("menuitem", { name: "Skip to end" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  });

  it("shows playing, paused and replay-complete states", () => {
    renderClient();
    const status = () => screen.getByTestId("court-status").textContent;
    expect(status()).toBe("Paused");
    fireEvent.click(button("Play"));
    expect(status()).toBe("Live");
    fireEvent.click(button("Pause"));
    expect(status()).toBe("Paused");
    chooseFromMenu("Skip to end");
    expect(status()).toBe("Replay complete");
    // The scoreboard keeps the only "Final".
    expect(screen.getAllByText("Final")).toHaveLength(1);
    expect(slider().getAttribute("aria-valuetext")).toBe(
      `${PLAYS.length} of ${PLAYS.length} plays`,
    );
  });

  it("follows a key-moment jump", () => {
    renderClient();
    chooseFromMenu("Skip to end");
    fireEvent.click(
      screen.getByRole("button", { name: /Away takes the lead/ }),
    );
    expectRevealed(11);
    expect(tokenLabels()).toContain("Marcus Jones, Visitor Hawks, 6 pts");
  });

  it("selects a player: card stats match the live box score", () => {
    renderClient();
    fireEvent.click(screen.getByRole("button", { name: /^Jalen Smith,/ }));
    expect(card().getByText("Jalen Smith")).toBeTruthy();
    expect(card().getByText(/PG · Harbor Waves · On court/)).toBeTruthy();
    openTab("Box score");
    const row = screen
      .getAllByRole("row")
      .find((candidate) => candidate.textContent?.includes("J. Smith"))!;
    expect(row.getAttribute("data-selected")).toBe("true");

    for (const expected of [1, 2, 3, 4, 5, 7, 10, 11]) {
      fireEvent.click(button("Next possession"));
      expectRevealed(expected);
      const live = buildLiveBoxScore(VIEW, expected).home.rows.find(
        (r) => r.playerId === "h1",
      )!;
      expect(cardStats()).toEqual([
        live.points,
        live.rebounds,
        live.assists,
        live.steals,
        live.blocks,
        live.turnovers,
      ]);
    }

    fireEvent.click(card().getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("court-player-card")).toBeNull();
    expect(row.getAttribute("data-selected")).toBeNull();
  });

  it("clicking the selected token again clears the selection", () => {
    renderClient();
    const token = () => screen.getByRole("button", { name: /^Kyle Lee,/ });
    fireEvent.click(token());
    expect(token().getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(token());
    expect(token().getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByTestId("court-player-card")).toBeNull();
  });

  it("shows an end-of-period card over the court between periods only", () => {
    renderClient();
    expect(screen.queryByTestId("court-period-card")).toBeNull();
    fireEvent.click(button("Play"));
    advance(7);
    expect(screen.queryByTestId("court-period-card")).toBeNull();
    advance(1);
    expectRevealed(8);
    expect(screen.getByTestId("court-period-card").textContent).toBe(
      "End of Q1 · AWY 5 – HOM 6",
    );
    advance(1);
    expect(screen.queryByTestId("court-period-card")).toBeNull();
  });

  const ballSpot = () => {
    const ball = screen.getByTestId("court-ball");
    return ball.style.transform;
  };

  it("ends on a Final card and a bright logo", () => {
    renderClient();
    chooseFromMenu("Skip to end");
    expect(screen.getByTestId("court-period-card").textContent).toBe(
      `Final · AWY ${VIEW.finalScore.away} – HOM ${VIEW.finalScore.home}`,
    );
    expect(
      screen.getByTestId("court-centre-logo").getAttribute("data-final"),
    ).toBe("true");
    expect(screen.queryByTestId("court-possession")).toBeNull();
  });

  it("choreographs plays the timer reveals and snaps on a jump", () => {
    const original = Element.prototype.animate;
    const cancels: ReturnType<typeof vi.fn>[] = [];
    const animate = vi.fn(() => {
      const cancel = vi.fn();
      cancels.push(cancel);
      return {
        cancel,
        pause: vi.fn(),
        play: vi.fn(),
        updatePlaybackRate: vi.fn(),
        playState: "running",
      };
    });
    Element.prototype.animate = animate as never;
    try {
      renderClient();
      fireEvent.click(button("Play"));
      advance(2);
      expect(animate).toHaveBeenCalled();
      const count = animate.mock.calls.length;
      fireEvent.click(button("Next possession"));
      expect(animate).toHaveBeenCalledTimes(count);
      expect(cancels.every((cancel) => cancel.mock.calls.length === 1)).toBe(
        true,
      );
    } finally {
      Element.prototype.animate = original;
    }
  });

  it("lands on the same court after restart and skip as after playing through", () => {
    renderClient();
    fireEvent.click(button("Play"));
    advance(PLAYS.length);
    expectRevealed(PLAYS.length);
    const stepped = { labels: tokenLabels(), ball: ballSpot() };
    chooseFromMenu("Restart");
    chooseFromMenu("Skip to end");
    expect({ labels: tokenLabels(), ball: ballSpot() }).toEqual(stepped);
  });

  it("paints the home floor whatever theme scope the viewer is in", () => {
    render(
      <TeamThemeScope
        branding={{
          primaryColor: "#C8102E",
          secondaryColor: "#F2F0E6",
          accentColor: "#1D6B44",
        }}
      >
        <WatchGameClient view={VIEW} saveId="save_test" />
      </TeamThemeScope>,
    );
    const lane = buildCourtPalette(
      VIEW.home.hasBranding ? VIEW.home.branding : null,
    ).lane;
    const lanes = screen.getAllByTestId("court-lane");
    expect(lanes).toHaveLength(2);
    for (const rect of lanes) {
      expect(rect.getAttribute("fill")).toBe(lane);
    }
    expect(
      screen.getByRole("group", { name: "Court, Harbor Waves home floor" }),
    ).toBeTruthy();
  });

  it("reaches the same court by skipping as by stepping possessions", () => {
    renderClient();
    chooseFromMenu("Skip to end");
    const skipped = tokenLabels();
    chooseFromMenu("Restart");
    expect(tokenLabels()).not.toEqual(skipped);
    while (!button("Next possession").disabled) {
      fireEvent.click(button("Next possession"));
    }
    expectRevealed(PLAYS.length);
    expect(tokenLabels()).toEqual(skipped);
    expect(skipped).toContain("Ben Bench, Harbor Waves, 2 pts");
  });
});

describe("WatchGameClient transport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const button = (name: string) =>
    screen.getByRole("button", { name }) as HTMLButtonElement;
  const key = (target: Element, name: string) =>
    fireEvent.keyDown(target, { key: name });

  it("scrubs with the keyboard", () => {
    renderClient();
    const bar = slider();
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe(String(PLAYS.length));
    expect(bar.getAttribute("aria-valuetext")).toBe("0 of 14 plays, Tip-off");
    key(bar, "ArrowRight");
    expectRevealed(1);
    key(bar, "ArrowRight");
    expectRevealed(2);
    key(bar, "ArrowLeft");
    expectRevealed(1);
    key(bar, "PageUp");
    expectRevealed(stepPossession(VIEW, 1, 1));
    const here = currentRevealed();
    key(bar, "PageDown");
    expectRevealed(stepPossession(VIEW, here, -1));
    key(bar, "End");
    expectRevealed(PLAYS.length);
    key(bar, "Home");
    expectRevealed(0);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("seeks to where the pointer lands on the track", () => {
    renderClient();
    const bar = slider();
    bar.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 200,
        top: 0,
        bottom: 44,
        width: 200,
        height: 44,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.pointerDown(bar, { clientX: 100 });
    expectRevealed(Math.round(0.5 * PLAYS.length));
    fireEvent.pointerMove(bar, { clientX: 200 });
    expectRevealed(PLAYS.length);
    fireEvent.pointerUp(bar, { clientX: 200 });
    fireEvent.pointerMove(bar, { clientX: 0 });
    expectRevealed(PLAYS.length);
  });

  it("marks quarters and key moments, and jumps to a moment", () => {
    renderClient();
    expect(screen.getAllByTestId("playback-period-tick")).toHaveLength(1);
    const moments = screen.getAllByTestId("playback-moment");
    expect(moments).toHaveLength(1);
    fireEvent.mouseEnter(moments[0]!);
    expect(screen.getAllByText("Away takes the lead").length).toBeGreaterThan(
      0,
    );
    fireEvent.click(moments[0]!);
    expectRevealed(11);
  });

  it("has Space, arrow and comma/period shortcuts", () => {
    renderClient();
    key(document.body, " ");
    expect(button("Pause")).toBeTruthy();
    key(document.body, " ");
    expect(button("Play")).toBeTruthy();

    key(document.body, "ArrowRight");
    expectRevealed(stepPossession(VIEW, 0, 1));
    key(document.body, "ArrowRight");
    expectRevealed(stepPossession(VIEW, stepPossession(VIEW, 0, 1), 1));
    key(document.body, "ArrowLeft");
    expectRevealed(stepPossession(VIEW, 0, 1));
    key(document.body, ".");
    expectRevealed(stepPossession(VIEW, 0, 1) + 1);
    key(document.body, ",");
    expectRevealed(stepPossession(VIEW, 0, 1));
    key(document.body, "ArrowLeft");
    key(document.body, ",");
    expectRevealed(0);
  });

  it("ignores shortcuts while typing, with modifiers, or on a focused button", () => {
    renderClient();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    for (const name of [" ", "ArrowRight", "ArrowLeft", ".", ","]) {
      key(input, name);
    }
    expectRevealed(0);
    expect(button("Play")).toBeTruthy();
    input.remove();

    fireEvent.keyDown(document.body, { key: ".", ctrlKey: true });
    expectRevealed(0);

    // Space on a button activates that button only, not play as well.
    key(button("Next possession"), " ");
    expectRevealed(0);
    expect(button("Play")).toBeTruthy();
  });

  it("has exactly one primary control", () => {
    renderClient();
    const group = screen.getByRole("group", { name: "Playback controls" });
    expect(group.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(
      Array.from(group.querySelectorAll("button")).filter((el) =>
        el.className.includes("bg-team font-semibold"),
      ),
    ).toHaveLength(1);
  });

  it("toggles the shot chart from the overflow menu and closes on Escape", () => {
    renderClient();
    expect(screen.queryAllByTestId("court-shot-marker")).toHaveLength(0);
    const trigger = button("More playback options");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    key(slider(), "End");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const first = screen.getByRole("menuitemcheckbox", { name: "Shot chart" });
    expect(first.getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).toBe(first);
    key(first, "ArrowDown");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Restart" }),
    );
    key(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(first);

    fireEvent.click(first);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getAllByTestId("court-shot-marker").length).toBeGreaterThan(
      0,
    );

    fireEvent.click(trigger);
    expect(
      screen
        .getByRole("menuitemcheckbox", { name: "Shot chart" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("lists the keyboard shortcuts in a popover", () => {
    renderClient();
    const trigger = button("Keyboard shortcuts");
    fireEvent.click(trigger);
    expect(screen.getByText("Play or pause")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Play or pause")).toBeNull();
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
