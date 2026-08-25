import { isContractActive } from "@/domain/entities/contract";
import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import type { GameState } from "@/state/game-state";
import { isFreeAgent } from "@/systems/free-agency";

export type ContinuityValidationResult =
  | { ok: true; errors: [] }
  | { ok: false; errors: string[] };

/**
 * Scoped continuity invariants for safe simulation (not full validateGameState).
 * Checks roster duplicates, free-agent membership, contract refs, and open FA offers.
 */
export function validateContinuityBoundary(
  state: GameState,
): ContinuityValidationResult {
  const errors: string[] = [];
  const seasonYear = state.competition.season.year;
  const seenPlayerIds = new Map<string, string>();

  for (const team of Object.values(state.world.teams)) {
    const rosterSeen = new Set<string>();
    for (const playerId of team.roster) {
      if (rosterSeen.has(playerId)) {
        errors.push(
          `team "${team.id}" roster contains duplicate player "${playerId}".`,
        );
      }
      rosterSeen.add(playerId);

      const priorTeam = seenPlayerIds.get(playerId);
      if (priorTeam !== undefined && priorTeam !== team.id) {
        errors.push(
          `player "${playerId}" appears on multiple rosters ("${priorTeam}" and "${team.id}").`,
        );
      }
      seenPlayerIds.set(playerId, team.id);

      const player = state.world.players[playerId];
      if (player === undefined) {
        errors.push(
          `team "${team.id}" roster references missing player "${playerId}".`,
        );
        continue;
      }
      // Only flag true free agents (no contract binding) on a roster.
      // Expired contracts still linked are cleaned by releaseExpiredContracts;
      // do not treat mid-lifecycle expiry as a hard continuity failure.
      if (player.contractId === null) {
        errors.push(
          `player "${playerId}" on team "${team.id}" roster has no contract.`,
        );
      }
    }
  }

  for (const player of Object.values(state.world.players)) {
    if (player.contractId !== null) {
      const contract = state.business.contracts[player.contractId];
      if (contract === undefined) {
        errors.push(
          `player "${player.id}" contractId "${player.contractId}" is missing.`,
        );
      } else if (
        isContractActive(contract, seasonYear) &&
        contract.playerId !== player.id
      ) {
        errors.push(
          `player "${player.id}" active contract "${player.contractId}" belongs to another player.`,
        );
      }
    }
  }

  for (const [offerId, offer] of Object.entries(
    state.business.freeAgency.offers,
  )) {
    if (!isOpenOffer(offer.status)) {
      continue;
    }
    if (!isFreeAgent(state, offer.playerId)) {
      errors.push(
        `open free-agency offer "${offerId}" targets non-free-agent "${offer.playerId}".`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}

/** Throws when continuity invariants fail (hard failures only). */
export function assertContinuityBoundary(state: GameState): void {
  const result = validateContinuityBoundary(state);
  if (!result.ok) {
    throw new Error(
      `Continuity boundary failed:\n${result.errors.join("\n")}`,
    );
  }
}
