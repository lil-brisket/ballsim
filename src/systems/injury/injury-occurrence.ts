/**
 * Exposure → probability → injury creation.
 * Never rolls without an exposure event.
 */

import type { InjuryFrequency } from "@/domain/game-settings";
import type { Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import type { InjuryExposureEvent } from "@/systems/injury/injury-exposure";
import {
  listInjuryDefinitionsForExposure,
  pickSeverity,
} from "@/systems/injury/injury-catalog";
import { recentSameBodyPartInjury } from "@/systems/injury/injury-history";
import { applyInjuryToPlayer } from "@/systems/injury/injury-lifecycle";
import { getWorkloadRestrictions } from "@/systems/injury/injury-effects";
import type { DomainEvent } from "@/domain/events";
import { asDomainEventId } from "@/domain/ids";

const FREQUENCY_MULT: Record<InjuryFrequency, number> = {
  low: 0.55,
  medium: 1,
  high: 1.55,
};

/** Base probability per exposure event (before modifiers). Tunable. */
const BASE_RATE: Record<InjuryExposureEvent["source"], number> = {
  game_acute: 0.0045,
  game_overuse: 0.0025,
  practice: 0.0012,
  rehab: 0.0003,
  offseason_training: 0.0008,
  off_court: 0.00015,
};

export function computeInjuryProbability(
  player: Player,
  event: InjuryExposureEvent,
  injuryFrequency: InjuryFrequency,
  medicalPreventionMultiplier: number,
): number {
  if (event.source === "game_overuse" && event.alreadyInjuredThisGame) {
    return 0;
  }

  let p = BASE_RATE[event.source] * FREQUENCY_MULT[injuryFrequency];

  // Minutes / fatigue for game exposures
  if (event.minutesPlayed != null) {
    const minutesFactor = 0.7 + (event.minutesPlayed / 40) * 0.8;
    p *= minutesFactor;
  }
  if (event.fatigue != null) {
    p *= 0.85 + event.fatigue * 0.5;
  }
  if (event.isBackToBack) {
    p *= 1.25;
  }
  if (event.recentWorkloadMpg != null && event.recentWorkloadMpg > 34) {
    p *= 1 + (event.recentWorkloadMpg - 34) * 0.03;
  }
  if (event.practiceIntensity != null) {
    p *= 0.7 + event.practiceIntensity * 0.6;
  }

  // Player factors
  const durability = player.physical?.durability ?? 65;
  p *= 1.35 - durability / 150;
  const age = player.age;
  if (age >= 33) p *= 1.2;
  else if (age >= 30) p *= 1.1;
  else if (age <= 21) p *= 1.05;

  const workload = getWorkloadRestrictions(player);
  if (workload.reinjuryRisk > 0) {
    p *= 1 + workload.reinjuryRisk;
  }

  // Playing through injury elevates aggravation risk (handled separately),
  // but also slightly elevates new-injury risk when limited.
  if (player.activeInjuries.length > 0) {
    p *= 0.7; // already hurt — somewhat less likely for unrelated; catalog filters help
  }

  p /= Math.max(0.5, medicalPreventionMultiplier);

  return Math.max(0, Math.min(0.35, p));
}

export type OccurrenceResult = {
  state: GameState;
  events: DomainEvent[];
  injured: boolean;
  injuryId: string | null;
};

export function rollInjuryFromExposure(
  state: GameState,
  event: InjuryExposureEvent,
  rng: Rng,
  injuryFrequency: InjuryFrequency,
  medicalPreventionMultiplier: number,
): OccurrenceResult {
  const player = state.world.players[event.playerId];
  if (player == null || player.retired) {
    return { state, events: [], injured: false, injuryId: null };
  }

  // Aggravation check first when playing through an active injury over minutes cap
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
      const aggravationChance = 0.08 + workload.reinjuryRisk * 0.2;
      if (rng.next() < aggravationChance) {
        // Caller should use applyAggravation via service — signal via catalog
        // For now create as aggravated upgrade handled by service wrapper
      }
    }
  }

  const probability = computeInjuryProbability(
    player,
    event,
    injuryFrequency,
    medicalPreventionMultiplier,
  );
  if (rng.next() >= probability) {
    return { state, events: [], injured: false, injuryId: null };
  }

  const candidates = listInjuryDefinitionsForExposure(event.source);
  if (candidates.length === 0) {
    return { state, events: [], injured: false, injuryId: null };
  }
  const definition = rng.pick(candidates);
  const severity = pickSeverity(definition, rng.next());

  const prior = recentSameBodyPartInjury(
    player,
    definition.bodyPart,
    90,
    event.date,
  );
  const isReinjury = prior != null;
  const injuryId = `inj_${event.playerId}_${event.date}_${definition.catalogKey}_${rng.nextInt(1000, 9999)}`;

  const nextState = applyInjuryToPlayer(state, event.playerId, {
    type: definition.displayName,
    severity,
    catalogKey: definition.catalogKey,
    bodyPart: definition.bodyPart,
    injuredOn: event.date,
    exposureSource: event.source,
    isReinjury,
    priorInjuryId: prior?.injuryId ?? null,
    reinjuryRisk:
      definition.reinjuryModifier[severity] + (isReinjury ? 0.1 : 0),
    temporaryEffects: definition.temporaryEffects[severity],
    injuryId,
  });

  const domainEvent: DomainEvent = {
    id: asDomainEventId(`evt_injury_${injuryId}`),
    type: "PlayerInjured",
    occurredOn: event.date,
    payload: {
      playerId: event.playerId,
      teamId: event.teamId,
      injuryId,
      catalogKey: definition.catalogKey,
      severity,
      bodyPart: definition.bodyPart,
      exposureSource: event.source,
      isReinjury,
      isAggravation: false,
    },
  };

  return {
    state: nextState,
    events: [domainEvent],
    injured: true,
    injuryId,
  };
}
