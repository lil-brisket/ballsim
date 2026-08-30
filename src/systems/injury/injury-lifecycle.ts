/**
 * Injury / availability lifecycle transitions.
 * Rotation and sim read Player.availability + Player.injury — this module is the
 * single writer for those fields' transitions.
 */

import type {
  InjurySeverity,
  Player,
  PlayerAvailability,
  PlayerInjury,
} from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type ApplyInjuryInput = {
  type: string;
  severity: InjurySeverity;
  /** Initial availability after the injury event. */
  availability: Exclude<PlayerAvailability, "available" | "suspended">;
  gamesRemaining?: { min: number; max: number } | null;
  recommendedWorkloadMpg?: number | null;
  maximumWorkloadMpg?: number | null;
};

const SEVERITY_DEFAULTS: Record<
  Exclude<InjurySeverity, "unknown">,
  {
    availability: Exclude<PlayerAvailability, "available" | "suspended">;
    gamesRemaining: { min: number; max: number };
    recommendedWorkloadMpg: number | null;
    maximumWorkloadMpg: number | null;
  }
> = {
  minor: {
    availability: "questionable",
    gamesRemaining: { min: 0, max: 2 },
    recommendedWorkloadMpg: 28,
    maximumWorkloadMpg: 34,
  },
  moderate: {
    availability: "limited",
    gamesRemaining: { min: 2, max: 6 },
    recommendedWorkloadMpg: 18,
    maximumWorkloadMpg: 24,
  },
  major: {
    availability: "out",
    gamesRemaining: { min: 8, max: 20 },
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: 0,
  },
};

function withPlayer(
  state: GameState,
  playerId: PlayerId,
  patch: Partial<Player>,
): GameState {
  const player = state.world.players[playerId];
  if (player == null) {
    return state;
  }
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: { ...player, ...patch },
      },
    },
  };
}

/**
 * Apply a new injury to a player. Does not invent detail when severity is unknown.
 */
export function applyInjuryToPlayer(
  state: GameState,
  playerId: PlayerId,
  input: ApplyInjuryInput,
): GameState {
  const injury: PlayerInjury = {
    type: input.type,
    severity: input.severity,
    gamesRemaining: input.gamesRemaining ?? null,
    recommendedWorkloadMpg: input.recommendedWorkloadMpg ?? null,
    maximumWorkloadMpg: input.maximumWorkloadMpg ?? null,
    recoveryProgress: 0,
  };
  return withPlayer(state, playerId, {
    availability: input.availability,
    injury,
  });
}

/**
 * Convenience: apply injury from severity defaults (for mid-game / generator hooks).
 * Does not use "unknown" — callers with incomplete data must pass explicit fields.
 */
export function applyInjuryFromSeverity(
  state: GameState,
  playerId: PlayerId,
  input: {
    type: string;
    severity: Exclude<InjurySeverity, "unknown">;
  },
): GameState {
  const defaults = SEVERITY_DEFAULTS[input.severity];
  return applyInjuryToPlayer(state, playerId, {
    type: input.type,
    severity: input.severity,
    availability: defaults.availability,
    gamesRemaining: defaults.gamesRemaining,
    recommendedWorkloadMpg: defaults.recommendedWorkloadMpg,
    maximumWorkloadMpg: defaults.maximumWorkloadMpg,
  });
}

/** Mark player fully available and clear injury. */
export function clearInjury(state: GameState, playerId: PlayerId): GameState {
  return withPlayer(state, playerId, {
    availability: "available",
    injury: null,
  });
}

/** Set suspension independently of injury. */
export function applySuspension(
  state: GameState,
  playerId: PlayerId,
  gamesRemaining: number,
): GameState {
  return withPlayer(state, playerId, {
    availability: "suspended",
    suspension: { gamesRemaining: Math.max(0, gamesRemaining) },
  });
}

export function clearSuspension(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.world.players[playerId];
  if (player == null) {
    return state;
  }
  const nextAvailability: PlayerAvailability =
    player.injury == null
      ? "available"
      : player.injury.maximumWorkloadMpg === 0
        ? "out"
        : player.injury.recommendedWorkloadMpg != null
          ? "limited"
          : "questionable";
  return withPlayer(state, playerId, {
    availability: nextAvailability,
    suspension: null,
  });
}

/**
 * Transition availability along the recovery path after a recovery tick.
 * Available ← Limited ← Questionable ← Out (when progress / games allow).
 */
export function advanceAvailabilityFromRecovery(
  player: Player,
): Pick<Player, "availability" | "injury"> {
  if (player.suspension != null && player.suspension.gamesRemaining > 0) {
    return {
      availability: "suspended",
      injury: player.injury,
    };
  }
  if (player.injury == null) {
    return { availability: "available", injury: null };
  }

  const injury = player.injury;
  const progress = injury.recoveryProgress;
  const remaining = injury.gamesRemaining;

  // Still fully out
  if (
    remaining != null &&
    remaining.min > 0 &&
    progress < 0.45 &&
    injury.maximumWorkloadMpg === 0
  ) {
    return { availability: "out", injury };
  }

  if (progress >= 0.95 && (remaining == null || remaining.max <= 0)) {
    // Nearly recovered — may keep light workload restriction briefly
    if (
      injury.recommendedWorkloadMpg != null &&
      injury.recommendedWorkloadMpg < 36 &&
      progress < 1
    ) {
      return {
        availability: "limited",
        injury: {
          ...injury,
          maximumWorkloadMpg:
            injury.maximumWorkloadMpg == null
              ? injury.recommendedWorkloadMpg + 4
              : Math.max(
                  injury.maximumWorkloadMpg,
                  injury.recommendedWorkloadMpg,
                ),
        },
      };
    }
    return { availability: "available", injury: null };
  }

  if (progress >= 0.7) {
    return {
      availability: "limited",
      injury: {
        ...injury,
        recommendedWorkloadMpg: injury.recommendedWorkloadMpg ?? 18,
        maximumWorkloadMpg:
          injury.maximumWorkloadMpg === 0
            ? (injury.recommendedWorkloadMpg ?? 18) + 4
            : injury.maximumWorkloadMpg,
      },
    };
  }

  if (progress >= 0.4) {
    return {
      availability: "questionable",
      injury: {
        ...injury,
        maximumWorkloadMpg:
          injury.maximumWorkloadMpg === 0 ? 28 : injury.maximumWorkloadMpg,
      },
    };
  }

  return {
    availability: remaining != null && remaining.min > 0 ? "out" : "limited",
    injury,
  };
}

export { SEVERITY_DEFAULTS };
