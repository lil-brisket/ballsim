import {
  createPlayer,
  PLAYER_ATTRIBUTE_KEYS,
  type Player,
} from "@/domain/entities/player";
import {
  DEFAULT_FOCUS_BY_POSITION,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";
import { isUserControlledTeam } from "@/state/owner-context";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { laggedFacilityDevelopmentMultiplier } from "@/systems/facilities";
import { FACILITY_LEVEL_MAX } from "@/domain/entities/franchise-ops";
import {
  developPlayer,
  clampPlayerToPotential,
  DEVELOPMENT_PLAN_MAX_AGE,
} from "@/systems/player-development";
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
  const facility = laggedFacilityDevelopmentMultiplier(state, teamId);
  const trainer = trainerDevelopmentMultiplier(state, teamId);
  let youth = 1;
  if (developmentStageForAge(playerAge) === "developing") {
    const level =
      state.business.franchiseOps[teamId]?.facilities.youth.level ?? 1;
    youth =
      1 + ((level - 1) / (FACILITY_LEVEL_MAX - 1)) * YOUTH_DEV_BONUS_AT_MAX;
  }
  return facility * trainer * youth;
}

/**
 * League-average facility × trainer multiplier (youth facilities aside).
 * Development uses each team's multiplier relative to it, so better
 * facilities and staff still develop players faster than rivals while
 * league-wide upgrades over the years do not inflate ratings.
 */
export function leagueDevelopmentReference(state: GameState): number {
  const teamIds = Object.keys(state.world.teams) as TeamId[];
  if (teamIds.length === 0) return 1;
  const total = teamIds.reduce(
    (sum, teamId) =>
      sum +
      laggedFacilityDevelopmentMultiplier(state, teamId) *
        trainerDevelopmentMultiplier(state, teamId),
    0,
  );
  const mean = total / teamIds.length;
  return mean > 0 ? mean : 1;
}

/**
 * Offseason season tick: age every active player +1, then develop once.
 * Facilities/trainers modify the distribution of positive deltas only,
 * relative to the league average ({@link leagueDevelopmentReference}).
 * Fan facilities are intentionally not connected here.
 */
export function processSeasonPlayerDevelopment(
  state: GameState,
  rng: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  const nextPlayers: Record<string, Player> = { ...state.world.players };
  const playerIds = Object.keys(nextPlayers).sort();
  const reference = leagueDevelopmentReference(state);

  for (const playerId of playerIds) {
    const player = nextPlayers[playerId]!;
    // Retired players keep the age and ratings they retired with.
    if (player.retired === true) continue;
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
    const multiplier =
      combinedDevelopmentMultiplier(state, aged.teamId, aged.age) / reference;
    const developed = developPlayer(
      aged,
      rng,
      multiplier,
      developmentFocusFor(state, aged),
    );
    let withDlBonus = developed;
    if (aged.teamId != null) {
      const dlBonus = computeDlOpportunityBonus(aged, aged.teamId, state);
      withDlBonus = applyDlOpportunityBonusToPlayer(
        developed,
        dlBonus,
        PLAYER_ATTRIBUTE_KEYS,
      );
      withDlBonus = clampPlayerToPotential(withDlBonus);
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

/**
 * The focus a player develops with this offseason: the owner's plan for his
 * team's young players, or the CPU default for his position. Older players
 * and free agents develop balanced.
 */
export function developmentFocusFor(
  state: GameState,
  player: Player,
): DevelopmentFocus {
  if (player.teamId == null || player.age > DEVELOPMENT_PLAN_MAX_AGE) {
    return "balanced";
  }
  if (isUserControlledTeam(state, player.teamId)) {
    return state.business.developmentPlans?.[player.id] ?? "balanced";
  }
  return DEFAULT_FOCUS_BY_POSITION[player.position];
}
