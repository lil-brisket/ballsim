/**
 * Structured validation for Development League assign/recall.
 */

import { getContractSalaryForYear } from "@/domain/entities/contract";
import type { Player } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { evaluateDevelopmentLeagueEligibility } from "@/systems/development-league/eligibility";
import {
  getTopLeagueRosterSize,
  isPlayerDlAssigned,
} from "@/systems/development-league/franchise-membership";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getTeamPayroll } from "@/systems/salary-cap";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

export type DlValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateAssignToDevelopmentLeague(
  state: GameState,
  playerId: string,
  teamId: TeamId,
): DlValidationResult {
  const errors: string[] = [];
  const player = state.world.players[playerId];
  if (player == null) {
    return { valid: false, errors: ["Player not found."] };
  }
  const eligibility = evaluateDevelopmentLeagueEligibility(
    player,
    teamId,
    state,
  );
  errors.push(...eligibility.reasons);
  return { valid: errors.length === 0, errors };
}

export function validateRecallFromDevelopmentLeague(
  state: GameState,
  playerId: string,
  teamId: TeamId,
): DlValidationResult {
  const errors: string[] = [];
  const player = state.world.players[playerId];
  if (player == null) {
    return { valid: false, errors: ["Player not found."] };
  }
  if (player.teamId !== teamId) {
    errors.push("Player is not owned by this franchise.");
  }
  if (!isPlayerDlAssigned(player)) {
    errors.push("Player is not assigned to the Development League.");
  }
  const rosterSize = getTopLeagueRosterSize(teamId, state);
  if (rosterSize >= TRADE_ROSTER_RULES.maxRosterSize) {
    errors.push(
      `Top-league roster is full (${TRADE_ROSTER_RULES.maxRosterSize}). Free a roster spot before recalling.`,
    );
  }
  if (
    state.settings.financialRules.salaryCapEnabled &&
    player.contractId != null
  ) {
    const contract = state.business.contracts[player.contractId];
    const year = state.competition.season.year;
    const salary =
      contract != null ? getContractSalaryForYear(contract, year) : undefined;
    if (salary != null && salary > 0) {
      const payroll = getTeamPayroll(teamId, year, state);
      const cap = getLeagueSalaryCap(state);
      if (payroll + salary > cap) {
        errors.push(
          "Recalling this player would put the team over the salary cap (payroll + salary exceeds cap).",
        );
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export type AssignConfirmationPayload = {
  playerId: string;
  name: string;
  overall: number;
  potential: number;
  age: number;
  draftSeasonYear: number | null;
  expectedRole: string;
  seasonsUsed: number;
  seasonsRemaining: number;
  expectedDevelopmentOpportunity: string;
  rosterImplication: string;
  financialImplication: string;
};

export function buildAssignConfirmationPayload(
  player: Player,
  teamId: TeamId,
  state: GameState,
): AssignConfirmationPayload {
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const seasonsUsed = player.developmentLeague?.seasonsUsed ?? 0;
  const seasonsRemaining = Math.max(0, 3 - seasonsUsed);
  const year = state.competition.season.year;
  let salary = 0;
  if (player.contractId != null) {
    const contract = state.business.contracts[player.contractId];
    if (contract != null) {
      salary = getContractSalaryForYear(contract, year) ?? 0;
    }
  }
  return {
    playerId: player.id,
    name: `${player.firstName} ${player.lastName}`,
    overall,
    potential: player.potential.overall,
    age: player.age,
    draftSeasonYear: player.developmentLeague?.draftSeasonYear ?? null,
    expectedRole: "development",
    seasonsUsed,
    seasonsRemaining,
    expectedDevelopmentOpportunity:
      "Meaningful Development League minutes vs limited top-league playing time.",
    rosterImplication: `Frees 1 top-league roster spot for ${teamId}.`,
    financialImplication:
      salary > 0
        ? `$${salary.toLocaleString()} will not count toward top-league payroll while assigned.`
        : "No salary impact.",
  };
}
