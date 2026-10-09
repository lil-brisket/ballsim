import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { asPlayerId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import {
  PLAYER_RETIREMENT_HIGH_AGE,
  PLAYER_RETIREMENT_MIN_AGE,
} from "@/systems/league-rules/invariants";
import { withClearedDevelopmentLeagueAssignment } from "@/systems/development-league/assignment";
import { stripPlayersFromAllTradeBlocks } from "@/systems/trades/trade-block";

/**
 * Probabilistic player retirement during season_transition.
 * Idempotent: skips players already marked retired.
 *
 * Contract fate (product decision):
 * - Terminates the active playing contract
 * - Removes all future salary obligations (no dead money)
 * - Removes player from roster
 * - Irreversible; cannot return to FA / be traded / re-signed
 * - Historical stats remain intact
 */
export function processPlayerRetirements(
  state: GameState,
  rng: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const year = current.competition.season.year;
  const playerIds = Object.keys(current.world.players).sort();

  for (const playerId of playerIds) {
    const player = current.world.players[playerId]!;
    if (player.retired === true) {
      continue;
    }

    const chance = playerRetirementProbability(
      player.age,
      calculatePlayerOverall(player.position, player.attributes),
    );
    if (chance <= 0 || !rng.chance(chance)) {
      continue;
    }

    const idempotencyKey = `player_retired:${playerId}:${year}`;
    // Use first owned franchise keys if present; else skip duplicate via retired flag only
    const anyFranchise = Object.values(current.user.ownedFranchises)[0];
    if (
      anyFranchise?.appliedGameplayConsequenceKeys?.[idempotencyKey] === true
    ) {
      continue;
    }

    current = releasePlayerContractOnRetirement(current, playerId);
    const after = current.world.players[playerId];
    if (!after) continue;

    current = {
      ...current,
      world: {
        ...current.world,
        players: {
          ...current.world.players,
          [playerId]: withClearedDevelopmentLeagueAssignment({
            ...after,
            retired: true,
            teamId: null,
            contractId: null,
          }),
        },
      },
    };

    // Remove from any roster that still lists them
    const teams = { ...current.world.teams };
    for (const [teamId, team] of Object.entries(teams)) {
      if (!team.roster.includes(playerId as never)) continue;
      teams[teamId] = {
        ...team,
        roster: team.roster.filter((id) => id !== playerId),
      };
    }
    current = {
      ...current,
      world: { ...current.world, teams },
      business: {
        ...current.business,
        tradeBlocks: stripPlayersFromAllTradeBlocks(
          current.business.tradeBlocks,
          [asPlayerId(playerId)],
        ),
      },
    };

    const retiredEvent = createDomainEvent({
      type: "PlayerRetired",
      occurredOn: current.world.calendar.currentDate,
      payload: {
        playerId,
        age: after.age,
        seasonYear: year,
      },
    });
    events.push(retiredEvent);
    current = appendSeasonEventLog(current, [retiredEvent]);

    // Mark idempotency on all owned franchises
    const ownedFranchises = { ...current.user.ownedFranchises };
    for (const [teamId, franchise] of Object.entries(ownedFranchises)) {
      ownedFranchises[teamId] = {
        ...franchise,
        appliedGameplayConsequenceKeys: {
          ...franchise.appliedGameplayConsequenceKeys,
          [idempotencyKey]: true,
        },
      };
    }
    current = {
      ...current,
      user: { ...current.user, ownedFranchises },
    };
  }

  return systemResult(current, events);
}

export function releasePlayerContractOnRetirement(
  state: GameState,
  playerId: string,
): GameState {
  const player = state.world.players[playerId];
  if (!player || player.contractId == null) {
    return state;
  }
  const contractId = player.contractId;
  const { [contractId]: _removed, ...restContracts } = state.business.contracts;
  return {
    ...state,
    business: {
      ...state.business,
      contracts: restContracts,
    },
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: withClearedDevelopmentLeagueAssignment({
          ...player,
          contractId: null,
          teamId: null,
        }),
      },
    },
  };
}

/**
 * Age-and-ability retirement chance. Uses derived overall, not attribute mean.
 * 80+ linger; sub-60 leave sooner. Zero below {@link PLAYER_RETIREMENT_MIN_AGE}.
 */
export function playerRetirementProbability(
  age: number,
  overall: number,
): number {
  if (age < PLAYER_RETIREMENT_MIN_AGE) {
    return 0;
  }
  let base = (age - PLAYER_RETIREMENT_MIN_AGE) * 0.04;
  if (age >= PLAYER_RETIREMENT_HIGH_AGE) {
    base += 0.25;
  }
  if (overall >= 80) {
    base *= 0.5;
  } else if (overall < 60) {
    base += 0.1;
  }
  return Math.min(0.85, Math.max(0, base));
}
