import { describe, expect, it } from "vitest";
import type { Game, GameScore } from "@/domain/entities/game";
import { summarizeGameMargins } from "@/simulation/league-sanity/margins";

function game(
  home: string,
  away: string,
  score: GameScore,
  periods = 4,
  status: Game["status"] = "final",
): Game {
  return {
    homeTeamId: home,
    awayTeamId: away,
    status,
    score,
    periodScores: Array.from({ length: periods }, () => ({ home: 0, away: 0 })),
  } as unknown as Game;
}

describe("summarizeGameMargins", () => {
  it("counts margins, blowouts, close games, overtime and home wins", () => {
    const summary = summarizeGameMargins([
      game("a", "b", { home: 110, away: 100 }),
      game("b", "a", { home: 100, away: 125 }),
      game("a", "b", { home: 101, away: 102 }, 5),
      game("b", "a", { home: 90, away: 90 }, 4, "scheduled"),
    ]);

    expect(summary.games).toBe(3);
    expect(summary.teamPoints).toBeCloseTo((210 + 225 + 203) / 6, 10);
    expect(summary.meanAbsMargin).toBeCloseTo((10 + 25 + 1) / 3, 10);
    expect(summary.blowoutShare).toBeCloseTo(1 / 3, 10);
    expect(summary.closeShare).toBeCloseTo(1 / 3, 10);
    expect(summary.overtimeShare).toBeCloseTo(1 / 3, 10);
    expect(summary.homeWinShare).toBeCloseTo(1 / 3, 10);
    expect(summary.homeEdge).toBeCloseTo((10 - 25 - 1) / 3, 10);
    expect(summary.bestWinPct).toBeCloseTo(2 / 3, 10);
    expect(summary.worstWinPct).toBeCloseTo(1 / 3, 10);
  });

  it("leaves no residual noise when margins follow team strength exactly", () => {
    // a beats everyone by 10 more than b, b by 10 more than c, at home or away.
    const strength: Record<string, number> = { a: 10, b: 0, c: -10 };
    const games: Game[] = [];
    for (const home of ["a", "b", "c"]) {
      for (const away of ["a", "b", "c"]) {
        if (home !== away) {
          const margin = strength[home]! - strength[away]!;
          games.push(game(home, away, { home: 100 + margin, away: 100 }));
        }
      }
    }

    const summary = summarizeGameMargins(games);

    expect(summary.residualMarginSd).toBeCloseTo(0, 10);
    expect(summary.marginSd).toBeGreaterThan(0);
  });

  it("rejects input with no final games", () => {
    expect(() =>
      summarizeGameMargins([
        game("a", "b", { home: 0, away: 0 }, 0, "scheduled"),
      ]),
    ).toThrow(/at least one final game/);
  });
});
