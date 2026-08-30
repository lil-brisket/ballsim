/**
 * Post-game / daily injury recovery progression.
 */

import type { Player, PlayerInjury } from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  advanceAvailabilityFromRecovery,
  clearSuspension,
} from "@/systems/injury/injury-lifecycle";

const RECOVERY_STEP = 0.12;

function tickInjury(injury: PlayerInjury): PlayerInjury {
  const progress = Math.min(1, injury.recoveryProgress + RECOVERY_STEP);
  let gamesRemaining = injury.gamesRemaining;
  if (gamesRemaining != null) {
    const min = Math.max(0, gamesRemaining.min - 1);
    const max = Math.max(min, gamesRemaining.max - 1);
    gamesRemaining = min === 0 && max === 0 ? null : { min, max };
  }
  // Gradually restore workload caps as recovery progresses
  let recommended = injury.recommendedWorkloadMpg;
  let maximum = injury.maximumWorkloadMpg;
  if (progress >= 0.5 && recommended != null && recommended < 32) {
    recommended = Math.min(36, recommended + 2);
  }
  if (progress >= 0.5 && maximum != null && maximum > 0 && maximum < 38) {
    maximum = Math.min(40, maximum + 2);
  }
  if (progress >= 0.85 && maximum === 0) {
    maximum = recommended ?? 18;
  }
  return {
    ...injury,
    recoveryProgress: progress,
    gamesRemaining,
    recommendedWorkloadMpg: recommended,
    maximumWorkloadMpg: maximum,
  };
}

function recoverPlayer(player: Player): Player {
  let next: Player = { ...player };

  if (next.suspension != null) {
    const gamesRemaining = Math.max(0, next.suspension.gamesRemaining - 1);
    if (gamesRemaining <= 0) {
      next = {
        ...next,
        suspension: null,
        availability:
          next.injury == null ? "available" : next.availability,
      };
    } else {
      next = {
        ...next,
        suspension: { gamesRemaining },
        availability: "suspended",
      };
      return next;
    }
  }

  if (next.injury == null) {
    if (next.availability !== "available" && next.suspension == null) {
      return { ...next, availability: "available" };
    }
    return next;
  }

  const injury = tickInjury(next.injury);
  const advanced = advanceAvailabilityFromRecovery({
    ...next,
    injury,
  });
  return {
    ...next,
    availability: advanced.availability,
    injury: advanced.injury,
  };
}

/**
 * Advance recovery for every player on a team (or all players if teamId omitted).
 */
export function advanceInjuryRecovery(
  state: GameState,
  teamId?: string,
): GameState {
  const players: GameState["world"]["players"] = { ...state.world.players };
  let changed = false;

  for (const [playerId, player] of Object.entries(players)) {
    if (teamId != null && player.teamId !== teamId) {
      continue;
    }
    if (
      player.injury == null &&
      player.suspension == null &&
      player.availability === "available"
    ) {
      continue;
    }
    const next = recoverPlayer(player);
    if (next !== player) {
      players[playerId as PlayerId] = next;
      changed = true;
    }
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    world: {
      ...state.world,
      players,
    },
  };
}

/** Tick recovery after a completed game for both teams. */
export function advanceInjuryRecoveryAfterGame(
  state: GameState,
  homeTeamId: string,
  awayTeamId: string,
): GameState {
  let next = advanceInjuryRecovery(state, homeTeamId);
  next = advanceInjuryRecovery(next, awayTeamId);
  return next;
}

export { clearSuspension };
