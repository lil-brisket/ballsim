import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import {
  evaluateSeasonInvariants,
  type SeasonGameRow,
} from "@/simulation/lab/season-invariants";
import { runLeagueCareer } from "@/simulation/league-sanity/run-league-career";
import type { GameState } from "@/state/game-state";

function regularSeasonRows(state: GameState): SeasonGameRow[] {
  return Object.values(state.competition.games)
    .filter(
      (game) =>
        game.status === "final" && game.competitionType === "regular_season",
    )
    .map((game) => ({
      id: game.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      score: game.score,
      periodScores: game.periodScores,
      playerStats: game.playerStats,
    }));
}

describe("box_score league season invariants", () => {
  // Decade-health configuration (seed 42, 30 teams). With the owner left on
  // the possession engine this league produced a 73.8 PPG owner team in a
  // ~95 PPG league; a headless owner must use the league fidelity instead.
  it("has no team-PPG, scorer-outlier or minutes failures with a headless owner", () => {
    let failures: ReturnType<typeof evaluateSeasonInvariants> = [];
    let games = 0;
    runLeagueCareer({
      seed: 42,
      seasons: 1,
      gameSettings: DEFAULT_GAME_SETTINGS,
      gameFidelity: "box_score",
      skipOwnerGameplay: true,
      saveId: "decade_health",
      onSeasonComplete: (state) => {
        const rows = regularSeasonRows(state);
        games = rows.length;
        failures = evaluateSeasonInvariants(rows);
      },
    });
    expect(games).toBe(1230);
    expect(failures).toEqual([]);
  }, 120_000);
});
