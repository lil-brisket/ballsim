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

function nextFillPlayerId(
  teamId: string,
  players: Record<string, Player>,
  startSlot: number,
): { playerId: ReturnType<typeof asPlayerId>; nextSlot: number } {
  let slot = startSlot;
  let playerId = asPlayerId(`player_${teamId}_fill_${slot}`);
  while (players[playerId] !== undefined) {
    slot += 1;
    playerId = asPlayerId(`player_${teamId}_fill_${slot}`);
  }
  return { playerId, nextSlot: slot + 1 };
}

/**
 * Adds generated players so every team reaches {@link DEFAULT_ROSTER_SIZE}.
 * Used after offseason attrition when the free-agent pool cannot fill holes.
 */
export function fillShortRosters(state: GameState, rng: Rng): SystemResult {
  const teamIds = (
    Object.keys(state.world.teams) as ReturnType<typeof asTeamId>[]
  ).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const shortTeamIds = teamIds.filter(
    (teamId) =>
      (state.world.teams[teamId]?.roster.length ?? 0) < DEFAULT_ROSTER_SIZE,
  );
  if (shortTeamIds.length === 0) {
    return systemResult(state);
  }

  const players: Record<string, Player> = { ...state.world.players };
  const contracts: Record<string, Contract> = { ...state.business.contracts };
  const teams: Record<string, (typeof state.world.teams)[string]> = {
    ...state.world.teams,
  };
  const currentYear = state.competition.season.year;

  for (const teamId of shortTeamIds) {
    const team = teams[teamId]!;
    const roster = [...team.roster];
    let slot = roster.length;
    while (roster.length < DEFAULT_ROSTER_SIZE) {
      const next = nextFillPlayerId(teamId, players, slot);
      slot = next.nextSlot;
      const playerId = next.playerId;
      const position = rosterPositionForSlot(roster.length);
      const contractId = asContractId(`contract_${playerId}`);
      const player = generatePlayerWithRng(rng, {
        id: playerId,
        teamId: team.id,
        contractId,
        position,
      });
      players[playerId] = player;
      roster.push(playerId);

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
        teamId: team.id,
        startYear,
        endYear,
        salaryByYear,
      });
    }
    teams[teamId] = { ...team, roster };
  }

  let next: GameState = {
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

  for (const teamId of shortTeamIds) {
    const management = recommendRosterManagement(next, teamId, {
      configuredBy: "default",
    });
    next = {
      ...next,
      world: {
        ...next.world,
        teams: {
          ...next.world.teams,
          [teamId]: {
            ...next.world.teams[teamId]!,
            rosterManagement: management,
          },
        },
      },
    };
  }

  const finances = { ...next.business.finances };
  for (const teamId of shortTeamIds) {
    const existingFinance = finances[teamId];
    if (existingFinance) {
      finances[teamId] = {
        ...existingFinance,
        payroll: getTeamPayroll(teamId, currentYear, next),
      };
    }
  }

  return systemResult({
    ...next,
    business: {
      ...next.business,
      finances,
    },
  });
}
