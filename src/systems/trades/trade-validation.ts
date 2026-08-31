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
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { checkPlayerTradeEligibility } from "@/systems/trades/trade-eligibility";
import { applyTradeSalaryRule } from "@/systems/trades/trade-salary-rules";
import { canTradeDraftPick, checkTradeWindow } from "@/systems/league-rules";
import type {
  TradeValidationIssue,
  TradeValidationResult,
} from "@/systems/trades/trade-types";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";

export type { TradeValidationIssue, TradeValidationResult };

function countTopLeaguePlayersInTrade(
  playerIds: readonly PlayerId[],
  state: GameState,
): number {
  let count = 0;
  for (const playerId of playerIds) {
    const player = state.world.players[playerId];
    if (player != null && !isPlayerDlAssigned(player)) {
      count += 1;
    }
  }
  return count;
}

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

  const playerAssets =
    proposal.sideA.playerIds.length + proposal.sideB.playerIds.length;
  const pickAssets =
    proposal.sideA.draftPickIds.length + proposal.sideB.draftPickIds.length;
  if (playerAssets > 0 || pickAssets > 0) {
    const window = checkTradeWindow(state);
    if (!window.allowed) {
      errors.push(
        ...window.violations.map((v) => ({
          code: v.code,
          message: v.message,
        })),
      );
    }
  }

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

  // Salary (skipped when salary cap is disabled in game settings)
  if (state.settings.financialRules.salaryCapEnabled) {
    const salaryCap = getLeagueSalaryCap(state);
    const salaryA = applyTradeSalaryRule({
      currentPayroll: getTeamPayroll(sideA.teamId, seasonYear, state),
      outgoingSalary: sumPlayerSalaries(state, sideA.playerIds, seasonYear),
      incomingSalary: sumPlayerSalaries(state, sideB.playerIds, seasonYear),
      salaryCap,
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
      salaryCap,
    });
    if (!salaryB.valid) {
      errors.push({
        code: "SALARY_VIOLATION",
        message: `Team "${sideB.teamId}": ${salaryB.reason ?? "salary matching failed."}`,
      });
    }
  }

  // Roster size — DL-assigned players do not affect top-league roster size
  const rosterRules = createRosterRulesConfig(TRADE_ROSTER_RULES);
  const outA = countTopLeaguePlayersInTrade(sideA.playerIds, state);
  const inA = countTopLeaguePlayersInTrade(sideB.playerIds, state);
  const outB = countTopLeaguePlayersInTrade(sideB.playerIds, state);
  const inB = countTopLeaguePlayersInTrade(sideA.playerIds, state);
  const newSizeA = teamA!.roster.length - outA + inA;
  const newSizeB = teamB!.roster.length - outB + inB;

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
    const onTopRoster = team.roster.includes(playerId as PlayerId);
    const onDl =
      isPlayerDlAssigned(player) && player.teamId === team.id;
    if (!onTopRoster && !onDl) {
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
    const pickTrade = canTradeDraftPick(state, pickId as DraftPickId);
    for (const issue of pickTrade.violations) {
      errors.push({ code: issue.code, message: issue.message });
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
