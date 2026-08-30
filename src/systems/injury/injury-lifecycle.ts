/**
 * Injury lifecycle transitions — called only via injury-service.
 * Supports multiple activeInjuries, aggravation, and reinjury.
 */

import type {
  InjurySeverity,
  Player,
  PlayerAvailability,
  PlayerInjury,
} from "@/domain/entities/player";
import { primaryActiveInjury } from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getInjuryDefinition,
  workloadDefaultsForSeverity,
} from "@/systems/injury/injury-catalog";
import { buildExpectedReturnWindow } from "@/systems/injury/injury-recovery";
import { resolvePlayerAvailabilityFromState } from "@/systems/injury/injury-status";

export type ApplyInjuryInput = {
  type: string;
  severity: Exclude<InjurySeverity, never>;
  availability?: Exclude<PlayerAvailability, "available" | "suspended">;
  catalogKey?: string;
  bodyPart?: PlayerInjury["bodyPart"];
  injuredOn?: string;
  expectedReturnWindow?: PlayerInjury["expectedReturnWindow"];
  practiceRestriction?: PlayerInjury["practiceRestriction"];
  gameRestriction?: PlayerInjury["gameRestriction"];
  gamesRemaining?: { min: number; max: number } | null;
  recommendedWorkloadMpg?: number | null;
  maximumWorkloadMpg?: number | null;
  minutesRestriction?: number | null;
  temporaryEffects?: PlayerInjury["temporaryEffects"];
  reinjuryRisk?: number;
  isReinjury?: boolean;
  isAggravation?: boolean;
  priorInjuryId?: string | null;
  exposureSource?: PlayerInjury["exposureSource"];
  injuryId?: string;
};

const SEVERITY_DEFAULTS: Record<
  Exclude<InjurySeverity, never>,
  {
    availability: Exclude<PlayerAvailability, "available" | "suspended">;
    gamesRemaining: { min: number; max: number };
    recommendedWorkloadMpg: number | null;
    maximumWorkloadMpg: number | null;
    gameRestriction: PlayerInjury["gameRestriction"];
    practiceRestriction: PlayerInjury["practiceRestriction"];
  }
> = {
  minor: {
    availability: "questionable",
    gamesRemaining: { min: 0, max: 2 },
    recommendedWorkloadMpg: 28,
    maximumWorkloadMpg: 34,
    gameRestriction: "monitor",
    practiceRestriction: "modified",
  },
  moderate: {
    availability: "limited",
    gamesRemaining: { min: 2, max: 6 },
    recommendedWorkloadMpg: 18,
    maximumWorkloadMpg: 24,
    gameRestriction: "limited",
    practiceRestriction: "rehab",
  },
  major: {
    availability: "out",
    gamesRemaining: { min: 8, max: 20 },
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: 0,
    gameRestriction: "out",
    practiceRestriction: "none",
  },
  severe: {
    availability: "out",
    gamesRemaining: { min: 20, max: 60 },
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: 0,
    gameRestriction: "out",
    practiceRestriction: "none",
  },
};

export function withPlayer(
  state: GameState,
  playerId: PlayerId,
  patch: Partial<Player>,
): GameState {
  const player = state.world.players[playerId];
  if (player == null) {
    return state;
  }
  const next: Player = { ...player, ...patch };
  if (patch.activeInjuries != null) {
    next.injury = primaryActiveInjury(patch.activeInjuries);
  }
  if (patch.availability == null && (patch.activeInjuries != null || patch.suspension !== undefined)) {
    next.availability = resolvePlayerAvailabilityFromState(next);
  }
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: next,
      },
    },
  };
}

function ensureActiveInjuries(player: Player): PlayerInjury[] {
  if (Array.isArray(player.activeInjuries)) {
    return [...player.activeInjuries];
  }
  if (player.injury != null) {
    return [player.injury];
  }
  return [];
}

function buildInjuryFromInput(
  input: ApplyInjuryInput,
  injuredOn: string,
): PlayerInjury {
  const defaults = SEVERITY_DEFAULTS[input.severity];
  const catalog = input.catalogKey
    ? getInjuryDefinition(input.catalogKey)
    : undefined;
  const workload = workloadDefaultsForSeverity(input.severity);

  let expectedReturnWindow = input.expectedReturnWindow ?? null;
  if (expectedReturnWindow == null) {
    const range =
      catalog?.recoveryDaysRange[input.severity] ??
      (input.gamesRemaining != null
        ? {
            min: input.gamesRemaining.min * 2,
            max: input.gamesRemaining.max * 2,
          }
        : defaults.gamesRemaining.min === 0 && defaults.gamesRemaining.max === 0
          ? { min: 1, max: 3 }
          : {
              min: Math.max(1, defaults.gamesRemaining.min * 2),
              max: Math.max(2, defaults.gamesRemaining.max * 2),
            });
    expectedReturnWindow = buildExpectedReturnWindow(
      injuredOn,
      range.min,
      range.max,
    );
  }

  return {
    injuryId: input.injuryId ?? `inj_${injuredOn}_${input.catalogKey ?? "x"}_${input.type.replace(/\s+/g, "_").toLowerCase()}`,
    catalogKey: input.catalogKey ?? catalog?.catalogKey ?? "undisclosed",
    type: input.type,
    bodyPart: input.bodyPart ?? catalog?.bodyPart ?? "unknown",
    severity: input.severity,
    injuredOn,
    expectedReturnWindow,
    recoveryProgress: 0,
    practiceRestriction:
      input.practiceRestriction ??
      catalog?.practiceRestriction[input.severity] ??
      defaults.practiceRestriction,
    gameRestriction:
      input.gameRestriction ??
      catalog?.gameRestriction[input.severity] ??
      defaults.gameRestriction,
    minutesRestriction:
      input.minutesRestriction ?? workload.minutesRestriction,
    recommendedWorkloadMpg:
      input.recommendedWorkloadMpg ??
      workload.recommendedWorkloadMpg ??
      defaults.recommendedWorkloadMpg,
    maximumWorkloadMpg:
      input.maximumWorkloadMpg ??
      workload.maximumWorkloadMpg ??
      defaults.maximumWorkloadMpg,
    reinjuryRisk:
      input.reinjuryRisk ??
      catalog?.reinjuryModifier[input.severity] ??
      0.1,
    temporaryEffects:
      input.temporaryEffects ??
      catalog?.temporaryEffects[input.severity] ??
      [],
    temporaryFrustration:
      input.severity === "minor"
        ? 5
        : input.severity === "moderate"
          ? 12
          : input.severity === "major"
            ? 22
            : 35,
    isReinjury: input.isReinjury === true,
    isAggravation: input.isAggravation === true,
    priorInjuryId: input.priorInjuryId ?? null,
    chronic: false,
    exposureSource: input.exposureSource ?? "game_acute",
  };
}

/**
 * Apply a new injury (appends to activeInjuries). Does not invent detail when
 * callers pass explicit fields.
 */
export function applyInjuryToPlayer(
  state: GameState,
  playerId: PlayerId,
  input: ApplyInjuryInput,
): GameState {
  const player = state.world.players[playerId];
  if (player == null) {
    return state;
  }
  const injuredOn =
    input.injuredOn ??
    state.world.calendar?.currentDate ??
    "2000-01-01";
  const injury = buildInjuryFromInput(input, injuredOn);
  const activeInjuries = [...ensureActiveInjuries(player), injury];
  const availability =
    input.availability ??
    resolvePlayerAvailabilityFromState({
      ...player,
      activeInjuries,
      suspension: player.suspension,
    });
  return withPlayer(state, playerId, {
    availability,
    activeInjuries,
  });
}

export function applyInjuryFromSeverity(
  state: GameState,
  playerId: PlayerId,
  input: {
    type: string;
    severity: InjurySeverity;
    catalogKey?: string;
    injuredOn?: string;
    exposureSource?: PlayerInjury["exposureSource"];
  },
): GameState {
  const defaults = SEVERITY_DEFAULTS[input.severity];
  return applyInjuryToPlayer(state, playerId, {
    type: input.type,
    severity: input.severity,
    availability: defaults.availability,
    catalogKey: input.catalogKey,
    injuredOn: input.injuredOn,
    exposureSource: input.exposureSource,
    gamesRemaining: defaults.gamesRemaining,
    recommendedWorkloadMpg: defaults.recommendedWorkloadMpg,
    maximumWorkloadMpg: defaults.maximumWorkloadMpg,
  });
}

/** Mark player fully available and clear all active injuries. */
export function clearInjury(state: GameState, playerId: PlayerId): GameState {
  return withPlayer(state, playerId, {
    availability: "available",
    activeInjuries: [],
    injury: null,
  });
}

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
  const nextAvailability = resolvePlayerAvailabilityFromState({
    ...player,
    suspension: null,
  });
  return withPlayer(state, playerId, {
    availability: nextAvailability,
    suspension: null,
  });
}

/**
 * Aggravate an existing active injury (same injuryId).
 */
export function aggravateInjury(
  state: GameState,
  playerId: PlayerId,
  injuryId: string,
): GameState {
  const player = state.world.players[playerId];
  if (player == null) {
    return state;
  }
  const activeInjuries = ensureActiveInjuries(player).map((injury) => {
    if (injury.injuryId !== injuryId) {
      return injury;
    }
    const nextSeverity: InjurySeverity =
      injury.severity === "minor"
        ? "moderate"
        : injury.severity === "moderate"
          ? "major"
          : injury.severity === "major"
            ? "severe"
            : "severe";
    const defaults = SEVERITY_DEFAULTS[nextSeverity];
    return {
      ...injury,
      severity: nextSeverity,
      isAggravation: true,
      recoveryProgress: Math.max(0, injury.recoveryProgress * 0.4),
      gameRestriction: defaults.gameRestriction,
      practiceRestriction: defaults.practiceRestriction,
      recommendedWorkloadMpg: defaults.recommendedWorkloadMpg,
      maximumWorkloadMpg: defaults.maximumWorkloadMpg,
      minutesRestriction: defaults.maximumWorkloadMpg,
      reinjuryRisk: Math.min(0.6, injury.reinjuryRisk + 0.15),
      temporaryFrustration: Math.min(50, injury.temporaryFrustration + 10),
    };
  });
  return withPlayer(state, playerId, {
    activeInjuries,
    availability: resolvePlayerAvailabilityFromState({
      ...player,
      activeInjuries,
    }),
  });
}

/**
 * @deprecated Prefer injury-status resolve. Kept for transitional callers.
 */
export function advanceAvailabilityFromRecovery(
  player: Player,
): Pick<Player, "availability" | "injury" | "activeInjuries"> {
  if (player.suspension != null && player.suspension.gamesRemaining > 0) {
    return {
      availability: "suspended",
      injury: primaryActiveInjury(ensureActiveInjuries(player)),
      activeInjuries: ensureActiveInjuries(player),
    };
  }
  const activeInjuries = ensureActiveInjuries(player);
  const availability = resolvePlayerAvailabilityFromState({
    ...player,
    activeInjuries,
    suspension: null,
  });
  return {
    availability,
    activeInjuries,
    injury: primaryActiveInjury(activeInjuries),
  };
}

export { SEVERITY_DEFAULTS, ensureActiveInjuries };
