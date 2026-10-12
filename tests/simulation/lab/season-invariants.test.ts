import { describe, expect, it } from "vitest";
import {
  SEASON_INVARIANT_BANDS,
  checkMinutesConservation,
  checkPlayerPpg,
  checkTeamPpg,
  evaluateSeasonInvariants,
  expectedTeamMinutes,
  type SeasonGameRow,
  type SeasonPlayerRow,
} from "@/simulation/lab/season-invariants";
import { INVARIANT_REGISTRY } from "@/simulation/lab/invariant-registry";

const TEAM_COUNT = 30;
const GAMES_PER_TEAM = 82;

function teamId(index: number): string {
  return `team_${String(index).padStart(2, "0")}`;
}

/** Spreads `points` over a 10-man rotation whose minutes sum to `minutes`. */
function rotationRows(
  team: string,
  points: number,
  minutes: number,
  featured?: { playerId: string; points: number },
): SeasonPlayerRow[] {
  const rows: SeasonPlayerRow[] = [];
  const featuredPoints = featured?.points ?? 0;
  const rest = points - featuredPoints;
  const shares = [8, 7, 6, 5, 4, 3, 2, 2, 1];
  const shareSum = shares.reduce((a, b) => a + b, 0);
  const minuteShares = [30, 28, 26, 24, 22, 20, 18, 14, 10, 8];
  const minuteSum = minuteShares.reduce((a, b) => a + b, 0);
  let minutesLeft = minutes;
  let pointsLeft = rest;
  for (let i = 0; i < 10; i += 1) {
    const isFeatured = i === 0 && featured != null;
    const m =
      i === 9
        ? minutesLeft
        : Math.round((minuteShares[i]! / minuteSum) * minutes);
    minutesLeft -= m;
    let p = 0;
    if (isFeatured) {
      p = featuredPoints;
    } else {
      const shareIndex = featured != null ? i - 1 : i;
      p =
        shareIndex >= 0 && shareIndex < shares.length
          ? Math.round((shares[shareIndex]! / shareSum) * rest)
          : 0;
      p = Math.min(p, pointsLeft);
      pointsLeft -= p;
    }
    rows.push({
      playerId: isFeatured ? featured.playerId : `${team}_p${i}`,
      teamId: team,
      minutes: m,
      points: p,
    });
  }
  return rows;
}

/**
 * Round-robin-ish league of `teams` x `games` games where every team scores
 * `ppgFor(team)` (home or away) with full 240 team-minutes.
 */
function buildLeague(
  ppgFor: (team: string) => number,
  options: {
    scorer?: { team: string; playerId: string; ppg: number };
    minutesFor?: (team: string) => number;
  } = {},
): SeasonGameRow[] {
  const games: SeasonGameRow[] = [];
  for (let g = 0; g < (TEAM_COUNT * GAMES_PER_TEAM) / 2; g += 1) {
    const home = teamId(g % TEAM_COUNT);
    const away = teamId((g + 1 + (g % (TEAM_COUNT - 1))) % TEAM_COUNT);
    if (home === away) {
      continue;
    }
    const homePoints = Math.round(ppgFor(home));
    const awayPoints = Math.round(ppgFor(away));
    const featuredFor = (team: string) =>
      options.scorer?.team === team
        ? { playerId: options.scorer.playerId, points: options.scorer.ppg }
        : undefined;
    games.push({
      id: `g${g}`,
      homeTeamId: home,
      awayTeamId: away,
      score: { home: homePoints, away: awayPoints },
      periodScores: [{}, {}, {}, {}],
      playerStats: [
        ...rotationRows(
          home,
          homePoints,
          options.minutesFor?.(home) ?? 240,
          featuredFor(home),
        ),
        ...rotationRows(
          away,
          awayPoints,
          options.minutesFor?.(away) ?? 240,
          featuredFor(away),
        ),
      ],
    });
  }
  return games;
}

describe("season team PPG invariant", () => {
  it("passes a healthy league (all teams 93-99 PPG)", () => {
    const league = buildLeague((team) => 93 + (Number(team.slice(-2)) % 7));
    expect(checkTeamPpg(league)).toEqual([]);
  });

  it("fails a 73.7 PPG team in a ~106 PPG league (the reported anomaly)", () => {
    const bad = teamId(7);
    const league = buildLeague((team) => (team === bad ? 73.7 : 106));
    const failures = checkTeamPpg(league);
    expect(failures.map((f) => f.rule)).toEqual(["TEAM_PPG_OUT_OF_RANGE"]);
    expect(failures[0]?.context?.teamId).toBe(bad);
  });

  it("fails a team far below a lower-scoring league too (relative rule)", () => {
    const bad = teamId(3);
    const league = buildLeague((team) => (team === bad ? 68 : 90));
    expect(checkTeamPpg(league).map((f) => f.context?.teamId)).toContain(bad);
  });

  it("fails a whole league that is out of absolute range", () => {
    const league = buildLeague(() => 55);
    expect(checkTeamPpg(league).length).toBe(TEAM_COUNT);
  });

  it("ignores teams with too few games", () => {
    const league = buildLeague(() => 106).slice(
      0,
      SEASON_INVARIANT_BANDS.minTeamGames - 1,
    );
    expect(checkTeamPpg(league)).toEqual([]);
  });
});

describe("season player PPG invariant", () => {
  const healthy = buildLeague(() => 100, {
    scorer: { team: teamId(1), playerId: "star", ppg: 26 },
  });

  it("does not flag a believable top scorer", () => {
    expect(checkPlayerPpg(healthy)).toEqual([]);
  });

  it("fails a 31.3 PPG scorer when the rest of the top scorers are far lower", () => {
    // The pack (ranks 2-6) is the ~11-12 PPG leading scorers of every other
    // team, so a 31.3 PPG player sits far above the league distribution.
    const league = buildLeague(() => 100, {
      scorer: { team: teamId(1), playerId: "isaiah_cross", ppg: 31.3 },
    });
    const failures = checkPlayerPpg(league);
    expect(failures.map((f) => f.rule)).toEqual(["PLAYER_PPG_OUTLIER"]);
    expect(failures[0]?.context?.playerId).toBe("isaiah_cross");
  });

  it("fails an absurd scorer regardless of the pack", () => {
    const league = buildLeague(() => 120, {
      scorer: { team: teamId(1), playerId: "glitch", ppg: 45 },
    });
    const failures = checkPlayerPpg(league);
    expect(failures[0]?.detail).toContain("absolute cap");
  });

  it("does not rank bench players with tiny minutes", () => {
    const league = buildLeague(() => 100);
    for (const game of league) {
      for (const row of game.playerStats) {
        if (row.playerId.endsWith("_p9")) {
          (row as { points: number }).points = 60;
          (row as { minutes: number }).minutes = 3;
        }
      }
    }
    expect(checkPlayerPpg(league)).toEqual([]);
  });
});

describe("minutes conservation invariant", () => {
  it("passes when each team's player minutes sum to 240", () => {
    expect(checkMinutesConservation(buildLeague(() => 100))).toEqual([]);
  });

  it("fails a team that loses minutes (the floor-rounding bug: ~234/240)", () => {
    const bad = teamId(4);
    const league = buildLeague(() => 100, {
      minutesFor: (team) => (team === bad ? 234 : 240),
    });
    const failures = checkMinutesConservation(league);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.every((f) => f.rule === "MINUTES_NOT_CONSERVED")).toBe(
      true,
    );
    expect(failures.every((f) => f.context?.teamId === bad)).toBe(true);
  });

  it("expects 25 extra player-minutes per overtime", () => {
    expect(expectedTeamMinutes(0)).toBe(240);
    expect(expectedTeamMinutes(1)).toBe(265);
    const game = buildLeague(() => 100, { minutesFor: () => 265 })[0]!;
    expect(
      checkMinutesConservation([
        { ...game, periodScores: [{}, {}, {}, {}, {}] },
      ]),
    ).toEqual([]);
    expect(checkMinutesConservation([game]).length).toBe(2);
  });
});

describe("evaluateSeasonInvariants + registry", () => {
  it("combines every check and registers each rule as a hard failure", () => {
    const bad = teamId(2);
    const league = buildLeague((team) => (team === bad ? 70 : 106), {
      scorer: { team: teamId(5), playerId: "hog", ppg: 33 },
      minutesFor: (team) => (team === teamId(9) ? 230 : 240),
    });
    const rules = new Set(evaluateSeasonInvariants(league).map((f) => f.rule));
    expect(rules).toEqual(
      new Set([
        "TEAM_PPG_OUT_OF_RANGE",
        "PLAYER_PPG_OUTLIER",
        "MINUTES_NOT_CONSERVED",
      ]),
    );
    for (const rule of rules) {
      expect(INVARIANT_REGISTRY[rule]?.severity).toBe("HARD_FAILURE");
    }
  });
});
