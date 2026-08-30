/**
 * Single authoritative daily recovery clock.
 * No post-game bonus recovery ticks — participation affects risk/setbacks only.
 *
 * advanceInjuryRecovery* shims remain for transitional callers; they only
 * tick suspensions / sync availability. Full recovery is tickDailyRecovery.
 */

import { addCalendarDays } from "@/domain/calendar-date";
import type { Player, PlayerInjury } from "@/domain/entities/player";
import { primaryActiveInjury } from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { DURABILITY_MIN } from "@/domain/entities/injury";
import type { GameState } from "@/state/game-state";
import { workloadDefaultsForSeverity } from "@/systems/injury/injury-catalog";
import { resolvePlayerAvailabilityFromState } from "@/systems/injury/injury-status";
import { clearSuspension } from "@/systems/injury/injury-lifecycle";

const BASE_DAILY_RECOVERY: Record<PlayerInjury["severity"], number> = {
  minor: 0.18,
  moderate: 0.1,
  major: 0.055,
  severe: 0.03,
};

function treatmentModifier(
  practice: PlayerInjury["practiceRestriction"],
): number {
  switch (practice) {
    case "rehab":
      return 1.12;
    case "modified":
      return 1.05;
    case "full":
      return 0.95;
    case "none":
      return 1.0;
  }
}

function playerRecoveryFactor(player: Player): number {
  const ageFactor =
    player.age <= 25 ? 1.08 : player.age <= 30 ? 1.0 : player.age <= 34 ? 0.92 : 0.85;
  const durabilityFactor =
    0.85 + ((player.physical?.durability ?? 60) - DURABILITY_MIN) / 200;
  const conditioningFactor =
    0.9 + (Math.min(100, Math.max(0, player.conditioning ?? 100)) / 100) * 0.2;
  return ageFactor * durabilityFactor * conditioningFactor;
}

/**
 * Advance one injury by one calendar day.
 */
export function tickInjuryDailyRecovery(
  injury: PlayerInjury,
  player: Player,
  medicalMultiplier: number,
  rng: Rng,
): PlayerInjury {
  const base = BASE_DAILY_RECOVERY[injury.severity];
  const variance = 0.85 + rng.next() * 0.3;
  const step =
    base *
    medicalMultiplier *
    treatmentModifier(injury.practiceRestriction) *
    playerRecoveryFactor(player) *
    variance;

  const recoveryProgress = Math.min(1, injury.recoveryProgress + step);

  let recommended = injury.recommendedWorkloadMpg;
  let maximum = injury.maximumWorkloadMpg;
  let minutesRestriction = injury.minutesRestriction;
  let gameRestriction = injury.gameRestriction;
  let practiceRestriction = injury.practiceRestriction;
  let reinjuryRisk = injury.reinjuryRisk;

  if (recoveryProgress >= 0.5 && recommended != null && recommended < 32) {
    recommended = Math.min(36, recommended + 1);
  }
  if (recoveryProgress >= 0.5 && maximum != null && maximum > 0 && maximum < 38) {
    maximum = Math.min(40, maximum + 1);
  }
  if (recoveryProgress >= 0.7 && maximum === 0) {
    const defaults = workloadDefaultsForSeverity(
      injury.severity === "severe" ? "major" : injury.severity,
    );
    maximum = defaults.maximumWorkloadMpg ?? 18;
    recommended = defaults.recommendedWorkloadMpg ?? 14;
    minutesRestriction = maximum;
    gameRestriction = "limited";
    practiceRestriction = "rehab";
  }
  if (recoveryProgress >= 0.85 && gameRestriction === "out") {
    gameRestriction = "limited";
    practiceRestriction = "rehab";
    if (maximum === 0 || maximum == null) {
      maximum = recommended ?? 16;
      minutesRestriction = maximum;
    }
  }
  if (recoveryProgress >= 0.95) {
    reinjuryRisk = Math.max(0.05, reinjuryRisk * 0.92);
    if (gameRestriction === "limited" && reinjuryRisk < 0.15) {
      gameRestriction = "monitor";
      practiceRestriction = "modified";
    }
  }
  if (recoveryProgress >= 1) {
    reinjuryRisk = Math.max(0.03, reinjuryRisk * 0.85);
  }

  const temporaryFrustration = Math.max(
    0,
    injury.temporaryFrustration - (recoveryProgress >= 0.7 ? 2 : 0.5),
  );

  return {
    ...injury,
    recoveryProgress,
    recommendedWorkloadMpg: recommended,
    maximumWorkloadMpg: maximum,
    minutesRestriction,
    gameRestriction,
    practiceRestriction,
    reinjuryRisk,
    temporaryFrustration,
  };
}

/** Clear RTP restrictions when fully recovered and low reinjury risk. */
export function maybeFullyClearInjury(injury: PlayerInjury): PlayerInjury | null {
  if (injury.recoveryProgress < 1) {
    return injury;
  }
  if (injury.reinjuryRisk > 0.08) {
    return {
      ...injury,
      gameRestriction: "monitor",
      practiceRestriction: "modified",
      recommendedWorkloadMpg: injury.recommendedWorkloadMpg ?? 26,
      maximumWorkloadMpg:
        injury.maximumWorkloadMpg == null || injury.maximumWorkloadMpg === 0
          ? 32
          : Math.max(injury.maximumWorkloadMpg, 28),
      minutesRestriction:
        injury.minutesRestriction == null || injury.minutesRestriction === 0
          ? 32
          : injury.minutesRestriction,
    };
  }
  return null;
}

export function buildExpectedReturnWindow(
  injuredOn: string,
  minDays: number,
  maxDays: number,
): { earliest: string; latest: string } {
  return {
    earliest: addCalendarDays(injuredOn, Math.max(0, minDays)),
    latest: addCalendarDays(injuredOn, Math.max(minDays, maxDays)),
  };
}

/**
 * @deprecated Use tickDailyRecovery from injury-service.
 * Suspension decrement + availability sync only.
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
    if (player.suspension == null) {
      const activeInjuries =
        player.activeInjuries ?? (player.injury ? [player.injury] : []);
      const availability = resolvePlayerAvailabilityFromState({
        ...player,
        activeInjuries,
      });
      if (
        availability !== player.availability ||
        player.activeInjuries == null
      ) {
        players[playerId as PlayerId] = {
          ...player,
          activeInjuries,
          injury: primaryActiveInjury(activeInjuries),
          availability,
        };
        changed = true;
      }
      continue;
    }

    const gamesRemaining = Math.max(0, player.suspension.gamesRemaining - 1);
    let next: Player;
    if (gamesRemaining <= 0) {
      next = {
        ...player,
        suspension: null,
        availability: resolvePlayerAvailabilityFromState({
          ...player,
          suspension: null,
        }),
      };
    } else {
      next = {
        ...player,
        suspension: { gamesRemaining },
        availability: "suspended",
      };
    }
    players[playerId as PlayerId] = next;
    changed = true;
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

/** @deprecated Suspension-only; injury recovery is daily via injury-service. */
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
