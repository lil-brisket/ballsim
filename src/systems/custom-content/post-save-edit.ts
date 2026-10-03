import { createContract } from "@/domain/entities/contract";
import {
  createPlayer,
  type Player,
  type PlayerInput,
} from "@/domain/entities/player";
import { asContractId, asPlayerId, asTeamId, type PlayerId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { attributeBasedAnnualSalary } from "@/systems/attribute-salary";
import { releasePlayerToFreeAgency } from "@/systems/free-agency";
import { reconcileRosterManagement } from "@/systems/roster-management";
import { validateTeamRosterIntegrity } from "@/systems/roster-integrity";
import { createPlayerFromSource } from "@/systems/custom-content/create-player-from-source";
import type { RosterPlayerSource } from "@/systems/custom-content/package-types";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

export type CustomRosterPlayerPatch = Partial<
  Pick<
    Player,
    | "firstName"
    | "lastName"
    | "age"
    | "nationality"
    | "position"
    | "archetype"
    | "attributes"
    | "potential"
    | "personality"
    | "heightInches"
    | "weightPounds"
  >
>;

function canHardRemove(state: GameState): boolean {
  return (
    Object.keys(state.competition.games).length === 0 &&
    state.competition.season.phase === "preseason"
  );
}

function playerToInput(player: Player, patch: CustomRosterPlayerPatch): PlayerInput {
  return {
    id: player.id,
    teamId: player.teamId,
    firstName: patch.firstName ?? player.firstName,
    lastName: patch.lastName ?? player.lastName,
    nationality: patch.nationality ?? player.nationality,
    age: patch.age ?? player.age,
    heightInches: patch.heightInches ?? player.heightInches,
    weightPounds: patch.weightPounds ?? player.weightPounds,
    position: patch.position ?? player.position,
    archetype: patch.archetype ?? player.archetype,
    attributes: patch.attributes ?? { ...player.attributes },
    potential: patch.potential ?? { ...player.potential },
    personality: patch.personality ?? { ...player.personality },
    contractId: player.contractId,
    availability: player.availability,
    activeInjuries: player.activeInjuries,
    suspension: player.suspension,
    physical: player.physical,
    conditioning: player.conditioning,
    injuryHistory: player.injuryHistory,
    development: player.development,
    developmentLeague: player.developmentLeague,
    retired: player.retired,
  };
}

export function updateCustomRosterPlayer(
  state: GameState,
  playerId: PlayerId,
  patch: CustomRosterPlayerPatch,
): SystemResult {
  const player = state.world.players[playerId];
  if (player === undefined) {
    throw new Error(`Player "${playerId}" was not found.`);
  }
  const nextPlayer = createPlayer(playerToInput(player, patch));
  return systemResult({
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: nextPlayer,
      },
    },
  });
}

export function removeCustomRosterPlayer(
  state: GameState,
  playerId: PlayerId,
): SystemResult {
  const player = state.world.players[playerId];
  if (player === undefined) {
    throw new Error(`Player "${playerId}" was not found.`);
  }
  if (!canHardRemove(state)) {
    if (player.contractId !== null) {
      throw new Error(
        `Cannot remove player "${playerId}" with an active contract. Release or waive the player instead.`,
      );
    }
    return releasePlayerToFreeAgency(state, playerId);
  }

  const contracts = { ...state.business.contracts };
  if (player.contractId !== null) {
    delete contracts[player.contractId];
  }
  const players = { ...state.world.players };
  delete players[playerId];
  const teams = { ...state.world.teams };
  if (player.teamId !== null) {
    const team = teams[player.teamId];
    if (team !== undefined) {
      teams[player.teamId] = {
        ...team,
        roster: team.roster.filter((id) => id !== playerId),
      };
    }
  }
  let next: GameState = {
    ...state,
    world: { ...state.world, players, teams },
    business: { ...state.business, contracts },
  };
  if (player.teamId !== null) {
    next = reconcileRosterManagement(next, player.teamId);
    const integrity = validateTeamRosterIntegrity(next, player.teamId);
    if (!integrity.ok) {
      throw new Error(
        integrity.issues.map((entry) => entry.message).join("; "),
      );
    }
  }
  return systemResult(next);
}

export function addCustomRosterPlayer(
  state: GameState,
  source: RosterPlayerSource,
  rng: Rng,
  contentId: string,
): SystemResult {
  const teamId =
    source.teamSourceId === null ? null : asTeamId(source.teamSourceId);
  if (teamId !== null && state.world.teams[teamId] === undefined) {
    throw new Error(`Team "${teamId}" was not found.`);
  }
  if (teamId !== null) {
    const rosterSize = state.world.teams[teamId]!.roster.length;
    if (rosterSize >= TRADE_ROSTER_RULES.maxRosterSize) {
      throw new Error(
        `Team "${teamId}" roster is already at the maximum size.`,
      );
    }
  }
  const contractId =
    teamId === null ? null : asContractId(`contract_${asPlayerId(`pending`)}`);
  let player = createPlayerFromSource({
    contentId,
    source,
    teamId,
    contractId: null,
  });
  if (state.world.players[player.id] !== undefined) {
    throw new Error(`Player "${player.id}" already exists.`);
  }
  const resolvedContractId =
    teamId === null ? null : asContractId(`contract_${player.id}`);
  player = createPlayerFromSource({
    contentId,
    source,
    teamId,
    contractId: resolvedContractId,
  });
  const players = { ...state.world.players, [player.id]: player };
  const contracts = { ...state.business.contracts };
  const teams = { ...state.world.teams };
  if (teamId !== null && resolvedContractId !== null) {
    const yearsRemaining = source.contract?.years ?? rng.nextInt(1, 4);
    const salaryPerYear =
      source.contract?.annualSalary ??
      attributeBasedAnnualSalary(player.attributes);
    const startYear = state.competition.season.year;
    const endYear = startYear + yearsRemaining - 1;
    const salaryByYear: Record<string, number> = {};
    for (let year = startYear; year <= endYear; year += 1) {
      salaryByYear[String(year)] = salaryPerYear;
    }
    contracts[resolvedContractId] = createContract({
      id: resolvedContractId,
      playerId: player.id,
      teamId,
      startYear,
      endYear,
      salaryByYear,
    });
    const team = teams[teamId]!;
    teams[teamId] = { ...team, roster: [...team.roster, player.id] };
  }
  let next: GameState = {
    ...state,
    world: { ...state.world, players, teams },
    business: { ...state.business, contracts },
  };
  if (teamId !== null) {
    next = reconcileRosterManagement(next, teamId);
    const integrity = validateTeamRosterIntegrity(next, teamId);
    if (!integrity.ok) {
      throw new Error(
        integrity.issues.map((entry) => entry.message).join("; "),
      );
    }
  }
  return systemResult(next);
}
