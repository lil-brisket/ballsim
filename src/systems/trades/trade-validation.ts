import {
  getContractSalaryForYear,
  isContractActive,
} from "@/domain/entities/contract";
import type { DraftPick } from "@/domain/entities/draft-pick";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import {
  tradeSideAssetCount,
  type TradeProposal,
  type TradeSide,
} from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { createRosterRulesConfig, validateRosterSize } from "@/systems/roster-rules";
import { getTeamPayroll } from "@/systems/salary-cap";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { checkPlayerTradeEligibility } from "@/systems/trades/trade-eligibility";
import { applyTradeSalaryRule } from "@/systems/trades/trade-salary-rules";
import type {
  TradeValidationIssue,
  TradeValidationResult,
} from "@/systems/trades/trade-types";

export type { TradeValidationIssue, TradeValidationResult };

/**
 * Canonical trade validation. Never mutates state.
 * Does not know about Trade Finder or Trade Block.
 */
export function validateTrade(
  state: GameState,
  proposal: TradeProposal,
): TradeValidationResult {
  const errors: TradeValidationIssue[] = [];
  const warnings: TradeValidationIssue[] = [];

  const sideA = proposal.sideA;
  const sideB = proposal.sideB;

  const teamA = state.world.teams[sideA.teamId];
  const teamB = state.world.teams[sideB.teamId];

  if (teamA === undefined) {
    errors.push({
      code: "TEAM_NOT_FOUND",
      message: `Team "${sideA.teamId}" does not exist.`,
    });
  }
  if (teamB === undefined) {
    errors.push({
      code: "TEAM_NOT_FOUND",
      message: `Team "${sideB.teamId}" does not exist.`,
    });
  }

  if (sideA.teamId === sideB.teamId) {
    errors.push({
      code: "SAME_TEAM",
      message: "Trade sides must be two distinct teams.",
    });
  }

  if (tradeSideAssetCount(sideA) < 1) {
    errors.push({
      code: "EMPTY_SIDE",
      message: `Team "${sideA.teamId}" must send at least one asset.`,
    });
  }
  if (tradeSideAssetCount(sideB) < 1) {
    errors.push({
      code: "EMPTY_SIDE",
      message: `Team "${sideB.teamId}" must send at least one asset.`,
    });
  }

  collectDuplicateErrors(sideA, errors);
  collectDuplicateErrors(sideB, errors);
  collectCrossSideDuplicateErrors(sideA, sideB, errors);

  if (teamA !== undefined) {
    validateSideAssets(state, sideA, teamA, errors);
  }
  if (teamB !== undefined) {
    validateSideAssets(state, sideB, teamB, errors);
  }

  // Stop early if structural ownership/team errors already block projections.
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const seasonYear = state.competition.season.year;

  // Eligibility (also covers contract active checks via default rules)
  for (const playerId of sideA.playerIds) {
    const player = state.world.players[playerId]!;
    errors.push(
      ...checkPlayerTradeEligibility({
        state,
        player,
        offeringTeam: teamA!,
        seasonYear,
      }),
    );
  }
  for (const playerId of sideB.playerIds) {
    const player = state.world.players[playerId]!;
    errors.push(
      ...checkPlayerTradeEligibility({
        state,
        player,
        offeringTeam: teamB!,
        seasonYear,
      }),
    );
  }

  // Explicit contract consistency (in addition to eligibility)
  for (const [side, team] of [
    [sideA, teamA!],
    [sideB, teamB!],
  ] as const) {
    for (const playerId of side.playerIds) {
      const player = state.world.players[playerId]!;
      validatePlayerContract(state, player, team.id, seasonYear, errors);
    }
  }

  // Salary
  const salaryA = applyTradeSalaryRule({
    currentPayroll: getTeamPayroll(sideA.teamId, seasonYear, state),
    outgoingSalary: sumPlayerSalaries(state, sideA.playerIds, seasonYear),
    incomingSalary: sumPlayerSalaries(state, sideB.playerIds, seasonYear),
  });
  if (!salaryA.valid) {
    errors.push({
      code: "SALARY_VIOLATION",
      message: `Team "${sideA.teamId}": ${salaryA.reason ?? "salary matching failed."}`,
    });
  }

  const salaryB = applyTradeSalaryRule({
    currentPayroll: getTeamPayroll(sideB.teamId, seasonYear, state),
    outgoingSalary: sumPlayerSalaries(state, sideB.playerIds, seasonYear),
    incomingSalary: sumPlayerSalaries(state, sideA.playerIds, seasonYear),
  });
  if (!salaryB.valid) {
    errors.push({
      code: "SALARY_VIOLATION",
      message: `Team "${sideB.teamId}": ${salaryB.reason ?? "salary matching failed."}`,
    });
  }

  // Roster size — picks have zero roster impact
  const rosterRules = createRosterRulesConfig(TRADE_ROSTER_RULES);
  const newSizeA =
    teamA!.roster.length - sideA.playerIds.length + sideB.playerIds.length;
  const newSizeB =
    teamB!.roster.length - sideB.playerIds.length + sideA.playerIds.length;

  try {
    validateRosterSize(newSizeA, rosterRules);
  } catch (error) {
    errors.push({
      code: "ROSTER_SIZE",
      message: `Team "${sideA.teamId}": ${error instanceof Error ? error.message : String(error)}`,
    });
  }
  try {
    validateRosterSize(newSizeB, rosterRules);
  } catch (error) {
    errors.push({
      code: "ROSTER_SIZE",
      message: `Team "${sideB.teamId}": ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function collectDuplicateErrors(
  side: TradeSide,
  errors: TradeValidationIssue[],
): void {
  const seenPlayers = new Set<string>();
  for (const playerId of side.playerIds) {
    if (seenPlayers.has(playerId)) {
      errors.push({
        code: "DUPLICATE_PLAYER",
        message: `Player "${playerId}" appears more than once on team "${side.teamId}" side.`,
      });
    }
    seenPlayers.add(playerId);
  }
  const seenPicks = new Set<string>();
  for (const pickId of side.draftPickIds) {
    if (seenPicks.has(pickId)) {
      errors.push({
        code: "DUPLICATE_PICK",
        message: `Draft pick "${pickId}" appears more than once on team "${side.teamId}" side.`,
      });
    }
    seenPicks.add(pickId);
  }
}

function collectCrossSideDuplicateErrors(
  sideA: TradeSide,
  sideB: TradeSide,
  errors: TradeValidationIssue[],
): void {
  const sideBPlayers = new Set(sideB.playerIds.map(String));
  for (const playerId of sideA.playerIds) {
    if (sideBPlayers.has(playerId)) {
      errors.push({
        code: "DUPLICATE_PLAYER",
        message: `Player "${playerId}" appears on both sides of the trade.`,
      });
    }
  }
  const sideBPicks = new Set(sideB.draftPickIds.map(String));
  for (const pickId of sideA.draftPickIds) {
    if (sideBPicks.has(pickId)) {
      errors.push({
        code: "DUPLICATE_PICK",
        message: `Draft pick "${pickId}" appears on both sides of the trade.`,
      });
    }
  }
}

function validateSideAssets(
  state: GameState,
  side: TradeSide,
  team: Team,
  errors: TradeValidationIssue[],
): void {
  for (const playerId of side.playerIds) {
    const player = state.world.players[playerId] as Player | undefined;
    if (player === undefined) {
      errors.push({
        code: "PLAYER_NOT_FOUND",
        message: `Player "${playerId}" does not exist.`,
      });
      continue;
    }
    if (player.teamId !== team.id) {
      errors.push({
        code: "PLAYER_NOT_OWNED",
        message: `Player "${playerId}" is not owned by team "${team.id}".`,
      });
    }
    if (!team.roster.includes(playerId as PlayerId)) {
      errors.push({
        code: "PLAYER_NOT_ON_ROSTER",
        message: `Player "${playerId}" is not on team "${team.id}" roster.`,
      });
    }
  }

  for (const pickId of side.draftPickIds) {
    const pick = state.world.draftPicks[pickId] as DraftPick | undefined;
    if (pick === undefined) {
      errors.push({
        code: "PICK_NOT_FOUND",
        message: `Draft pick "${pickId}" does not exist.`,
      });
      continue;
    }
    if (pick.ownerTeamId !== team.id) {
      errors.push({
        code: "PICK_NOT_OWNED",
        message: `Draft pick "${pickId}" is not owned by team "${team.id}".`,
      });
    }
  }
}

function validatePlayerContract(
  state: GameState,
  player: Player,
  offeringTeamId: TeamId,
  seasonYear: number,
  errors: TradeValidationIssue[],
): void {
  if (player.contractId === null) {
    errors.push({
      code: "CONTRACT_MISSING",
      message: `Player "${player.id}" has no contractId.`,
    });
    return;
  }
  const contract = state.business.contracts[player.contractId];
  if (contract === undefined) {
    errors.push({
      code: "CONTRACT_MISSING",
      message: `Contract "${player.contractId}" for player "${player.id}" is missing.`,
    });
    return;
  }
  if (contract.playerId !== player.id) {
    errors.push({
      code: "CONTRACT_MISMATCH",
      message: `Contract "${contract.id}" playerId does not match player "${player.id}".`,
    });
  }
  if (contract.teamId !== offeringTeamId) {
    errors.push({
      code: "CONTRACT_TEAM_MISMATCH",
      message: `Contract "${contract.id}" teamId does not match offering team "${offeringTeamId}".`,
    });
  }
  if (!isContractActive(contract, seasonYear)) {
    errors.push({
      code: "CONTRACT_INACTIVE",
      message: `Contract "${contract.id}" is not active for season ${seasonYear}.`,
    });
  }
}

function sumPlayerSalaries(
  state: GameState,
  playerIds: readonly PlayerId[],
  seasonYear: number,
): number {
  let total = 0;
  for (const playerId of playerIds) {
    const player = state.world.players[playerId];
    if (player?.contractId == null) {
      continue;
    }
    const contract = state.business.contracts[player.contractId];
    if (contract === undefined) {
      continue;
    }
    const salary = getContractSalaryForYear(contract, seasonYear);
    if (salary !== undefined) {
      total += salary;
    }
  }
  return total;
}

/** Exported for tests / finder helpers. */
export function projectedRosterSize(
  currentSize: number,
  outgoingPlayers: number,
  incomingPlayers: number,
): number {
  return currentSize - outgoingPlayers + incomingPlayers;
}
