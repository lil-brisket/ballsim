import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

/**
 * Rebuilds win/loss standings from all final games.
 * Safe to run after each game-simulation step.
 */
export function updateStandings(state: GameState): SystemResult {
  const byTeamId: GameState["competition"]["standings"]["byTeamId"] = {};

  for (const teamId of Object.keys(state.world.teams)) {
    byTeamId[teamId] = {
      teamId: teamId as TeamId,
      wins: 0,
      losses: 0,
    };
  }

  for (const game of Object.values(state.competition.games)) {
    if (
      game.status !== "final" ||
      game.homeScore === null ||
      game.awayScore === null
    ) {
      continue;
    }

    const home = byTeamId[game.homeTeamId];
    const away = byTeamId[game.awayTeamId];
    if (!home || !away) {
      continue;
    }

    if (game.homeScore > game.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (game.awayScore > game.homeScore) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      standings: { byTeamId },
    },
  });
}
