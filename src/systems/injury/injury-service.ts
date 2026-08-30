/**
 * Injury service — sole public mutation boundary for player injuries.
 *
 * Invariant: player injuries must NEVER mutate staff workload, fatigue,
 * morale, availability, or development. Medical staff multipliers are
 * read-only inputs to recovery/prevention only.
 *
 * Other systems (game sim, roster, development, UI) must READ via this
 * module and WRITE only through processExposureEvent / tickDailyRecovery /
 * applyAggravation / clear APIs.
 */

import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { InjuryFrequency } from "@/domain/game-settings";
import type { PlayerId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import type { Player, PlayerInjury } from "@/domain/entities/player";
import { primaryActiveInjury } from "@/domain/entities/player";
import { DURABILITY_MIN, DURABILITY_MAX } from "@/domain/entities/injury";
import type { InjuryExposureEvent } from "@/systems/injury/injury-exposure";
import { rollInjuryFromExposure } from "@/systems/injury/injury-occurrence";
import {
  aggravateInjury,
  applyInjuryFromSeverity,
  applyInjuryToPlayer,
  applySuspension,
  clearInjury,
  clearSuspension,
  ensureActiveInjuries,
  withPlayer,
  type ApplyInjuryInput,
} from "@/systems/injury/injury-lifecycle";
import {
  maybeFullyClearInjury,
  tickInjuryDailyRecovery,
} from "@/systems/injury/injury-recovery";
import {
  appendInjuryHistory,
  toHistoryEntry,
} from "@/systems/injury/injury-history";
import {
  resolvePlayerAvailabilityFromState,
  aggregateAvailabilityFromInjuries,
} from "@/systems/injury/injury-status";
import {
  developmentOpportunityFactor,
  getEffectiveAttributes,
  getEffectivePlayerValue,
  getInjuryEffects,
  getWorkloadRestrictions,
} from "@/systems/injury/injury-effects";
import {
  medicalPreventionMultiplier,
  medicalRecoveryMultiplier,
} from "@/systems/staff-effects/medical-effects";
import { getInjuryDefinition } from "@/systems/injury/injury-catalog";

export type InjuryServiceResult = {
  state: GameState;
  events: DomainEvent[];
};

function readInjuryFrequency(state: GameState): InjuryFrequency {
  const freq = state.settings?.injuryFrequency;
  if (freq === "low" || freq === "medium" || freq === "high") {
    return freq;
  }
  return "medium";
}

/**
 * Process a single exposure event — may create a new injury or aggravate.
 */
export function processExposureEvent(
  state: GameState,
  event: InjuryExposureEvent,
  rng: Rng,
): InjuryServiceResult {
  const player = state.world.players[event.playerId];
  if (player == null) {
    return { state, events: [] };
  }

  // Aggravation path when exceeding minutes while injured
  if (
    (event.source === "game_acute" || event.source === "game_overuse") &&
    player.activeInjuries.length > 0 &&
    event.minutesPlayed != null
  ) {
    const workload = getWorkloadRestrictions(player);
    if (
      workload.maximumWorkloadMpg != null &&
      event.minutesPlayed > workload.maximumWorkloadMpg + 2
    ) {
      const chance = 0.08 + workload.reinjuryRisk * 0.2;
      if (rng.next() < chance) {
        const target =
          player.activeInjuries.find(
            (injury) =>
              injury.maximumWorkloadMpg != null &&
              event.minutesPlayed! > injury.maximumWorkloadMpg + 2,
          ) ?? player.activeInjuries[0]!;
        const next = aggravateInjury(state, event.playerId, target.injuryId);
        const domainEvent = createDomainEvent({
          type: "PlayerInjured",
          occurredOn: event.date,
          payload: {
            playerId: event.playerId,
            teamId: event.teamId,
            injuryId: target.injuryId,
            catalogKey: target.catalogKey,
            severity: next.world.players[event.playerId]?.activeInjuries.find(
              (i) => i.injuryId === target.injuryId,
            )?.severity,
            bodyPart: target.bodyPart,
            exposureSource: event.source,
            isReinjury: false,
            isAggravation: true,
          },
        });
        return { state: next, events: [domainEvent] };
      }
    }
  }

  const teamId = event.teamId ?? player.teamId;
  const prevention =
    teamId != null ? medicalPreventionMultiplier(state, teamId) : 1;
  const result = rollInjuryFromExposure(
    state,
    event,
    rng,
    readInjuryFrequency(state),
    prevention,
  );
  return { state: result.state, events: result.events };
}

/**
 * Single authoritative daily recovery clock for all injured/suspended players.
 */
export function tickDailyRecovery(
  state: GameState,
  rng: Rng,
): InjuryServiceResult {
  const date = state.world.calendar.currentDate;
  let current = state;
  const events: DomainEvent[] = [];
  const players = { ...current.world.players };
  let changed = false;

  for (const [playerId, player] of Object.entries(players)) {
    if (
      (player.activeInjuries?.length ?? 0) === 0 &&
      player.injury == null &&
      player.suspension == null &&
      player.availability === "available"
    ) {
      continue;
    }

    let next = { ...player };
    next.activeInjuries = ensureActiveInjuries(player);

    // Suspension tick
    if (next.suspension != null) {
      const gamesRemaining = Math.max(0, next.suspension.gamesRemaining - 1);
      if (gamesRemaining <= 0) {
        next = { ...next, suspension: null };
      } else {
        next = {
          ...next,
          suspension: { gamesRemaining },
          availability: "suspended",
        };
        players[playerId as PlayerId] = next;
        changed = true;
        continue;
      }
    }

    const medical =
      next.teamId != null
        ? medicalRecoveryMultiplier(current, next.teamId)
        : 1;

    const remaining: PlayerInjury[] = [];
    for (const injury of next.activeInjuries) {
      let ticked = tickInjuryDailyRecovery(injury, next, medical, rng);
      const cleared = maybeFullyClearInjury(ticked);
      if (cleared == null) {
        // Archive
        const hadLongTerm = maybeApplyLongTermDurability(next, ticked, rng);
        next = appendInjuryHistory(
          next,
          toHistoryEntry(ticked, date, estimateGamesMissed(ticked), hadLongTerm),
        );
        if (hadLongTerm) {
          next = {
            ...next,
            physical: {
              durability: Math.max(
                DURABILITY_MIN,
                (next.physical?.durability ?? 65) - 1,
              ),
            },
          };
        }
      } else {
        remaining.push(cleared);
      }
    }

    // Conditioning: drop slightly when out; recover when playing/rehab
    let conditioning = next.conditioning ?? 100;
    const outCount = remaining.filter((i) => i.gameRestriction === "out").length;
    if (outCount > 0) {
      conditioning = Math.max(40, conditioning - 1.5);
    } else if (remaining.length === 0) {
      conditioning = Math.min(100, conditioning + 0.5);
    } else {
      conditioning = Math.min(100, conditioning + 0.2);
    }

    next = {
      ...next,
      activeInjuries: remaining,
      injury: primaryActiveInjury(remaining),
      conditioning,
      availability: resolvePlayerAvailabilityFromState({
        ...next,
        activeInjuries: remaining,
        suspension: next.suspension,
      }),
    };
    players[playerId as PlayerId] = next;
    changed = true;
  }

  if (!changed) {
    return { state: current, events };
  }

  return {
    state: {
      ...current,
      world: { ...current.world, players },
    },
    events,
  };
}

function estimateGamesMissed(injury: PlayerInjury): number {
  if (injury.expectedReturnWindow == null) return 0;
  const start = Date.parse(`${injury.injuredOn}T12:00:00Z`);
  const end = Date.parse(`${injury.expectedReturnWindow.earliest}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000 / 2));
}

function maybeApplyLongTermDurability(
  player: Player,
  injury: PlayerInjury,
  rng: Rng,
): boolean {
  if (injury.severity !== "major" && injury.severity !== "severe") {
    const samePart = player.injuryHistory.filter(
      (entry) => entry.bodyPart === injury.bodyPart,
    ).length;
    if (samePart < 2) return false;
  }
  const definition = getInjuryDefinition(injury.catalogKey);
  const chance =
    definition?.longTermEffectChance[injury.severity] ??
    (injury.severity === "severe" ? 0.08 : injury.severity === "major" ? 0.02 : 0);
  if (chance <= 0) return false;
  return rng.next() < chance;
}

export function applyAggravation(
  state: GameState,
  playerId: PlayerId,
  injuryId: string,
): InjuryServiceResult {
  return { state: aggravateInjury(state, playerId, injuryId), events: [] };
}

export function archiveResolvedInjuries(
  state: GameState,
  playerId: PlayerId,
  recoveredOn: string,
  rng: Rng,
): InjuryServiceResult {
  const player = state.world.players[playerId];
  if (player == null) return { state, events: [] };
  let next = { ...player, activeInjuries: ensureActiveInjuries(player) };
  const remaining: PlayerInjury[] = [];
  for (const injury of next.activeInjuries) {
    if (injury.recoveryProgress >= 1 && injury.reinjuryRisk <= 0.08) {
      const hadLongTerm = maybeApplyLongTermDurability(next, injury, rng);
      next = appendInjuryHistory(
        next,
        toHistoryEntry(injury, recoveredOn, estimateGamesMissed(injury), hadLongTerm),
      );
      if (hadLongTerm) {
        next = {
          ...next,
          physical: {
            durability: Math.max(
              DURABILITY_MIN,
              Math.min(DURABILITY_MAX, (next.physical?.durability ?? 65) - 1),
            ),
          },
        };
      }
    } else {
      remaining.push(injury);
    }
  }
  next = {
    ...next,
    activeInjuries: remaining,
    injury: primaryActiveInjury(remaining),
    availability: resolvePlayerAvailabilityFromState({
      ...next,
      activeInjuries: remaining,
    }),
  };
  return {
    state: withPlayer(state, playerId, next),
    events: [],
  };
}

// Re-export read APIs and lifecycle shims for consumers
export {
  applyInjuryToPlayer,
  applyInjuryFromSeverity,
  applySuspension,
  clearInjury,
  clearSuspension,
  getEffectiveAttributes,
  getEffectivePlayerValue,
  getInjuryEffects,
  getWorkloadRestrictions,
  developmentOpportunityFactor,
  resolvePlayerAvailabilityFromState,
  aggregateAvailabilityFromInjuries,
};

export type { ApplyInjuryInput };
