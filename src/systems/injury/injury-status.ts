/**
 * Derive per-injury and aggregate player availability from restrictions.
 * recoveryProgress alone does NOT determine availability.
 */

import {
  AVAILABILITY_RESTRICTIVENESS,
  type PlayerInjury,
} from "@/domain/entities/injury";
import type { Player, PlayerAvailability } from "@/domain/entities/player";

export type InjuryDerivedStatus = Exclude<
  PlayerAvailability,
  "suspended" | "available"
>;

/**
 * Derive status for a single injury from restrictions + clearance state.
 */
export function deriveStatusFromInjury(
  injury: PlayerInjury,
): InjuryDerivedStatus | "available" {
  if (injury.gameRestriction === "out") {
    return "out";
  }

  const medicallyRecovered = injury.recoveryProgress >= 1;
  const nearlyRecovered = injury.recoveryProgress >= 0.85;
  const restriction = injury.gameRestriction;

  if (medicallyRecovered) {
    if (
      injury.maximumWorkloadMpg != null &&
      injury.maximumWorkloadMpg < 36
    ) {
      return "recovery";
    }
    if (injury.reinjuryRisk >= 0.12) {
      return "recovery";
    }
    if (restriction !== "none") {
      return "recovery";
    }
    return "available";
  }

  if (nearlyRecovered) {
    if (
      injury.reinjuryRisk >= 0.1 ||
      (injury.maximumWorkloadMpg != null && injury.maximumWorkloadMpg < 32)
    ) {
      return "recovery";
    }
  }

  if (restriction === "limited") {
    return "limited";
  }
  if (restriction === "monitor") {
    return injury.severity === "minor" ? "minor" : "questionable";
  }

  if (injury.severity === "minor") {
    return "minor";
  }
  return "questionable";
}

/**
 * Most restrictive status across all active injuries.
 * Suspension is handled by the caller.
 */
export function aggregateAvailabilityFromInjuries(
  injuries: readonly PlayerInjury[],
): PlayerAvailability {
  if (injuries.length === 0) {
    return "available";
  }
  let mostRestrictive: PlayerAvailability = "available";
  let bestRank = AVAILABILITY_RESTRICTIVENESS.available ?? 0;
  for (const injury of injuries) {
    const status = deriveStatusFromInjury(injury);
    const rank = AVAILABILITY_RESTRICTIVENESS[status] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      mostRestrictive = status;
    }
  }
  return mostRestrictive;
}

export function resolvePlayerAvailabilityFromState(
  player: Player,
): PlayerAvailability {
  if (player.suspension != null && player.suspension.gamesRemaining > 0) {
    return "suspended";
  }
  return aggregateAvailabilityFromInjuries(player.activeInjuries ?? []);
}

export function mostRestrictivePractice(
  injuries: readonly PlayerInjury[],
): PlayerInjury["practiceRestriction"] {
  const order = ["none", "rehab", "modified", "full"] as const;
  let worst: PlayerInjury["practiceRestriction"] = "full";
  let worstIdx = order.indexOf("full");
  for (const injury of injuries) {
    const idx = order.indexOf(injury.practiceRestriction);
    if (idx >= 0 && idx < worstIdx) {
      worstIdx = idx;
      worst = injury.practiceRestriction;
    }
  }
  return worst;
}
