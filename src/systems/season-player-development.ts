import { createPlayer, PLAYER_ATTRIBUTE_KEYS, type Player } from "@/domain/entities/player";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { facilityDevelopmentMultiplier } from "@/systems/facilities";
import { FACILITY_LEVEL_MAX } from "@/domain/entities/franchise-ops";
import { developPlayer } from "@/systems/player-development";
import { developmentStageForAge } from "@/systems/player-generation-config";
import { trainerDevelopmentMultiplier } from "@/systems/staff-effects";
import {
  applyDlOpportunityBonusToPlayer,
  computeDlOpportunityBonus,
} from "@/systems/development-league/development-opportunity";

/** Minimum |overall delta| to emit PlayerDeveloped / PlayerDeclined. */
export const PLAYER_DEVELOPMENT_EVENT_OVERALL_THRESHOLD = 1;

/**
 * Youth facility distribution scale for developing-stage players only.
 * Level 1 → 1.0; level 5 → 1.0 + YOUTH_DEV_BONUS_AT_MAX.
 */
export const YOUTH_DEV_BONUS_AT_MAX = 0.1;

/**
 * Combined development distribution multiplier for a team/player.
 * Scales positive RNG deltas only (via developPlayer); never guarantees gains.
 */
export function combinedDevelopmentMultiplier(
  state: GameState,
  teamId: TeamId | null,
  playerAge: number,
): number {
  if (teamId === null) {
    return 1;
  }
  const facility = facilityDevelopmentMultiplier(state, teamId);
  const trainer = trainerDevelopmentMultiplier(state, teamId);
  let youth = 1;
  if (developmentStageForAge(playerAge) === "developing") {
    const level =
      state.business.franchiseOps[teamId]?.facilities.youth.level ?? 1;
    youth = 1 + ((level - 1) / (FACILITY_LEVEL_MAX - 1)) * YOUTH_DEV_BONUS_AT_MAX;
  }
  return facility * trainer * youth;
}

/**
 * Offseason season tick: age every player +1, then develop once.
 * Facilities/trainers modify the distribution of positive deltas only.
 * Fan facilities are intentionally not connected here.
 */
export function processSeasonPlayerDevelopment(
  state: GameState,
  rng: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  const nextPlayers: Record<string, Player> = { ...state.world.players };
  const playerIds = Object.keys(nextPlayers).sort();

  for (const playerId of playerIds) {
    const player = nextPlayers[playerId]!;
    const aged = createPlayer({
      ...player,
      age: player.age + 1,
      development: {
        stage: developmentStageForAge(player.age + 1),
      },
    });
    const beforeOverall = calculatePlayerOverall(
      aged.position,
      aged.attributes,
    );
    const multiplier = combinedDevelopmentMultiplier(
      state,
      aged.teamId,
      aged.age,
    );
    const developed = developPlayer(aged, rng, multiplier);
    let withDlBonus = developed;
    if (aged.teamId != null) {
      const dlBonus = computeDlOpportunityBonus(aged, aged.teamId, state);
      withDlBonus = applyDlOpportunityBonusToPlayer(
        developed,
        dlBonus,
        PLAYER_ATTRIBUTE_KEYS,
      );
    }
    nextPlayers[playerId] = withDlBonus;

    const afterOverall = calculatePlayerOverall(
      withDlBonus.position,
      withDlBonus.attributes,
    );
    const delta = afterOverall - beforeOverall;
    if (delta >= PLAYER_DEVELOPMENT_EVENT_OVERALL_THRESHOLD) {
      events.push(
        createDomainEvent({
          type: "PlayerDeveloped",
          occurredOn: state.world.calendar.currentDate,
          payload: {
            playerId: withDlBonus.id,
            teamId: withDlBonus.teamId,
            overallBefore: beforeOverall,
            overallAfter: afterOverall,
            age: withDlBonus.age,
          },
        }),
      );
    } else if (delta <= -PLAYER_DEVELOPMENT_EVENT_OVERALL_THRESHOLD) {
      events.push(
        createDomainEvent({
          type: "PlayerDeclined",
          occurredOn: state.world.calendar.currentDate,
          payload: {
            playerId: withDlBonus.id,
            teamId: withDlBonus.teamId,
            overallBefore: beforeOverall,
            overallAfter: afterOverall,
            age: withDlBonus.age,
          },
        }),
      );
    }
  }

  return systemResult(
    {
      ...state,
      world: {
        ...state.world,
        players: nextPlayers,
      },
    },
    events,
  );
}
