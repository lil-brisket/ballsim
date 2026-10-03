import { createContract, type Contract } from "@/domain/entities/contract";
import type { Player } from "@/domain/entities/player";
import { asContractId, asTeamId, type PlayerId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { attributeBasedAnnualSalary } from "@/systems/attribute-salary";
import { recommendRosterManagement } from "@/systems/roster-management";
import { getTeamPayroll } from "@/systems/salary-cap";
import {
  mapTeamSourceIds,
} from "@/systems/custom-content/normalize";
import { createPlayerFromSource } from "@/systems/custom-content/create-player-from-source";
import type { RosterPackage } from "@/systems/custom-content/package-types";
import { validateRosterPackage } from "@/systems/custom-content/validate-roster";

export function applyRosterPackage(
  state: GameState,
  rosterPackage: unknown,
  rng: Rng,
): SystemResult {
  const validated = validateRosterPackage(rosterPackage, {
    teamCount: Object.keys(state.world.teams).length,
    schemaVersion: state.meta.schemaVersion,
    seasonYear: state.competition.season.year,
    salaryCap: state.settings.financialRules.salaryCap,
    salaryCapEnabled: state.settings.financialRules.salaryCapEnabled,
    existingPlayerIds: new Set(Object.keys(state.world.players)),
  });
  if (!validated.ok || validated.normalized === undefined) {
    const message = validated.errors.map((entry) => entry.message).join("; ");
    throw new Error(
      message.length > 0
        ? `Custom roster package is invalid: ${message}`
        : "Custom roster package is invalid.",
    );
  }

  const pkg: RosterPackage = validated.normalized;
  const generatedTeamIds = Object.keys(state.world.teams);
  const teamMap = mapTeamSourceIds(pkg.payload.teams, generatedTeamIds);
  const currentYear = state.competition.season.year;

  const players: Record<string, Player> = { ...state.world.players };
  const contracts: Record<string, Contract> = { ...state.business.contracts };
  const teams: Record<string, (typeof state.world.teams)[string]> = {
    ...state.world.teams,
  };

  for (const teamSource of pkg.payload.teams) {
    const teamId = teamMap.get(teamSource.sourceId);
    if (teamId === undefined) {
      continue;
    }
    const existing = teams[teamId];
    if (existing === undefined) {
      continue;
    }
    teams[teamId] = {
      ...existing,
      name: teamSource.name,
      city: teamSource.city ?? existing.city,
      abbreviation: teamSource.abbreviation ?? existing.abbreviation,
      roster: [],
    };
  }

  const rosterByTeam = new Map<string, PlayerId[]>();
  for (const source of pkg.payload.players) {
    const mappedTeamId =
      source.teamSourceId === null
        ? null
        : (teamMap.get(source.teamSourceId) ?? null);
    const teamId = mappedTeamId === null ? null : asTeamId(mappedTeamId);
    const playerIdPlaceholder = createPlayerFromSource({
      contentId: pkg.contentId,
      source,
      teamId,
      contractId: null,
    });
    const contractId =
      teamId === null
        ? null
        : asContractId(`contract_${playerIdPlaceholder.id}`);
    const player = createPlayerFromSource({
      contentId: pkg.contentId,
      source,
      teamId,
      contractId,
    });
    if (players[player.id] !== undefined) {
      throw new Error(
        `Canonical player ID "${player.id}" already exists in the world.`,
      );
    }
    players[player.id] = player;
    if (teamId !== null && contractId !== null) {
      const yearsRemaining = source.contract?.years ?? rng.nextInt(1, 4);
      const salaryPerYear =
        source.contract?.annualSalary ??
        attributeBasedAnnualSalary(player.attributes);
      const startYear = currentYear;
      const endYear = currentYear + yearsRemaining - 1;
      const salaryByYear: Record<string, number> = {};
      for (let year = startYear; year <= endYear; year += 1) {
        salaryByYear[String(year)] = salaryPerYear;
      }
      contracts[contractId] = createContract({
        id: contractId,
        playerId: player.id,
        teamId,
        startYear,
        endYear,
        salaryByYear,
      });
      const roster = rosterByTeam.get(teamId) ?? [];
      roster.push(player.id);
      rosterByTeam.set(teamId, roster);
    }
  }

  for (const [teamId, roster] of rosterByTeam) {
    const team = teams[teamId];
    if (team !== undefined) {
      teams[teamId] = { ...team, roster };
    }
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

  const teamIds = Object.keys(stateWithContracts.world.teams).sort();
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
