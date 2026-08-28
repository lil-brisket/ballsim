import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";
import { type Player } from "@/domain/entities/player";
import { createContract, type Contract } from "@/domain/entities/contract";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { attributeBasedAnnualSalary } from "@/systems/attribute-salary";
import { generatePlayerWithRng } from "@/systems/player-generation";
import {
  DEFAULT_ROSTER_SIZE,
  rosterPositionForSlot,
} from "@/systems/roster-generation-config";
import { recommendRosterManagement } from "@/systems/roster-management";
import { getTeamPayroll } from "@/systems/salary-cap";

/**
 * Fills empty team rosters with fictional players and starter contracts.
 * Idempotent: no-op when any players already exist.
 *
 * Player identity, attributes, potential, and personality come from
 * {@link generatePlayerWithRng}. Contracts and payroll remain roster-owned.
 * Payroll snapshots are derived from contracts after all contracts exist.
 */
export function generateRosters(state: GameState, rng: Rng): SystemResult {
  if (Object.keys(state.world.players).length > 0) {
    return systemResult(state);
  }

  const players: Record<string, Player> = {};
  const contracts: Record<string, Contract> = { ...state.business.contracts };
  const teams: Record<string, (typeof state.world.teams)[string]> = {
    ...state.world.teams,
  };
  const currentYear = state.competition.season.year;

  const teamIds = Object.keys(state.world.teams).sort();

  for (const teamId of teamIds) {
    const rosterPlayerIds: ReturnType<typeof asPlayerId>[] = [];
    for (let slot = 0; slot < DEFAULT_ROSTER_SIZE; slot += 1) {
      const playerId = asPlayerId(`player_${teamId}_${slot}`);
      const position = rosterPositionForSlot(slot);
      const contractId = asContractId(`contract_${playerId}`);

      const player = generatePlayerWithRng(rng, {
        id: playerId,
        teamId: state.world.teams[teamId]!.id,
        contractId,
        position,
      });
      players[playerId] = player;
      rosterPlayerIds.push(playerId);

      const salaryPerYear = attributeBasedAnnualSalary(player.attributes);
      const yearsRemaining = rng.nextInt(1, 4);
      const startYear = currentYear;
      const endYear = currentYear + yearsRemaining - 1;
      const salaryByYear: Record<string, number> = {};
      for (let year = startYear; year <= endYear; year += 1) {
        salaryByYear[String(year)] = salaryPerYear;
      }
      contracts[contractId] = createContract({
        id: contractId,
        playerId,
        teamId: state.world.teams[teamId]!.id,
        startYear,
        endYear,
        salaryByYear,
      });
    }
    teams[teamId] = {
      ...teams[teamId]!,
      roster: rosterPlayerIds,
    };
  }

  let stateWithContracts: GameState = {
    ...state,
    world: {
      ...state.world,
      players,
      teams,
    },
    business: {
      ...state.business,
      contracts,
      finances: { ...state.business.finances },
    },
  };

  for (const teamId of teamIds) {
    const management = recommendRosterManagement(
      stateWithContracts,
      asTeamId(teamId),
      { configuredBy: "default" },
    );
    stateWithContracts = {
      ...stateWithContracts,
      world: {
        ...stateWithContracts.world,
        teams: {
          ...stateWithContracts.world.teams,
          [teamId]: {
            ...stateWithContracts.world.teams[teamId]!,
            rosterManagement: management,
          },
        },
      },
    };
  }

  const finances = { ...stateWithContracts.business.finances };
  for (const teamId of teamIds) {
    const existingFinance = finances[teamId];
    if (existingFinance) {
      finances[teamId] = {
        ...existingFinance,
        payroll: getTeamPayroll(
          asTeamId(teamId),
          currentYear,
          stateWithContracts,
        ),
      };
    }
  }

  return systemResult({
    ...stateWithContracts,
    business: {
      ...stateWithContracts.business,
      finances,
    },
  });
}
