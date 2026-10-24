/**
 * Rules that must hold at every offseason phase boundary, for any seed.
 * Composes the engine's own league invariants and adds roster, contract,
 * payroll, cash, player-field, age and draft-pick checks.
 */

import {
  assertContractShape,
  getContractSalaryForYear,
  getContractStatus,
} from "@/domain/entities/contract";
import { deadMoneyForSeason } from "@/domain/entities/dead-money";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { listFreeAgents } from "@/systems/free-agency";
import { DRAFT_ROUNDS } from "@/systems/league-rules/invariants";
import { collectLeagueInvariantIssues } from "@/systems/league-rules/lifecycle-invariants";
import { isLeaguePhaseId } from "@/systems/league-rules/phase-ids";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  getActivePhaseId,
  getPhaseDefinition,
  type LeaguePhaseId,
} from "@/systems/phase-engine";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { vetMinSalary } from "@/systems/salary-scale";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { validateGameState } from "@/persistence/validate-game-state";

export type OffseasonInvariantIssue = {
  code: string;
  message: string;
};

export type OffseasonInvariantContext = {
  /** Shown in the failure message, e.g. "seed 7, after free agency". */
  label?: string;
  /** Earlier state of the same league, for age checks across a rollover. */
  previous?: GameState;
  /** Also run the persistence validator. Default true. */
  deep?: boolean;
};

/** Phases whose rosters must already be season-legal. */
const SEASON_LEGAL_ROSTER_PHASES: ReadonlySet<LeaguePhaseId> = new Set([
  "regular",
  "playoffs",
  "postseason.season_review",
  "offseason.season_transition",
]);

/**
 * Roster size bounds for a phase. During the offseason contracts expire
 * (short rosters are filled at the new season) and draft picks join (the
 * overflow goes to the Development League before the opener).
 */
export function rosterBoundsForPhase(phaseId: LeaguePhaseId): {
  min: number;
  max: number;
} {
  const { minRosterSize, maxRosterSize } = TRADE_ROSTER_RULES;
  if (SEASON_LEGAL_ROSTER_PHASES.has(phaseId)) {
    return { min: minRosterSize, max: maxRosterSize };
  }
  return { min: 0, max: maxRosterSize + DRAFT_ROUNDS };
}

/**
 * First season a rostered player's contract must still cover. Expired
 * contracts are released when Roster Decisions ends; from then on the
 * offseason belongs to the coming season.
 */
export function contractCoverageYear(state: GameState): number {
  const phaseId = getActivePhaseId(state);
  const year = state.competition.season.year;
  if (
    phaseId.startsWith("offseason.") &&
    phaseId !== "offseason.season_transition" &&
    phaseId !== "offseason.roster_decisions"
  ) {
    return year + 1;
  }
  return year;
}

/** Number of completed seasons whose development has been applied. */
function developedSeasonCount(state: GameState): number {
  const years = new Set<number>();
  for (const history of Object.values(state.business.franchiseHistory)) {
    for (const season of history.seasons) {
      years.add(season.seasonYear);
    }
  }
  return years.size;
}

function sortedIds(record: Record<string, unknown>): string[] {
  return Object.keys(record).sort();
}

function checkPhase(state: GameState, issues: OffseasonInvariantIssue[]) {
  const stored = state.competition.phase?.activePhaseId;
  if (!isLeaguePhaseId(stored)) {
    issues.push({
      code: "PHASE_UNKNOWN",
      message: `competition.phase.activePhaseId is "${String(stored)}".`,
    });
    return;
  }
  if (getPhaseDefinition(stored).nextPhaseId === null) {
    issues.push({
      code: "PHASE_DEAD_END",
      message: `Phase "${stored}" has no next phase.`,
    });
  }
}

function checkRosters(state: GameState, issues: OffseasonInvariantIssue[]) {
  const phaseId = getActivePhaseId(state);
  const bounds = rosterBoundsForPhase(phaseId);
  const rosteredBy = new Map<string, TeamId>();

  for (const teamId of sortedIds(state.world.teams) as TeamId[]) {
    const team = state.world.teams[teamId]!;
    const size = team.roster.length;
    if (size < bounds.min || size > bounds.max) {
      issues.push({
        code: "ROSTER_SIZE",
        message: `Team "${teamId}" has ${size} players in "${phaseId}" (allowed ${bounds.min}-${bounds.max}).`,
      });
    }
    for (const playerId of team.roster) {
      const other = rosteredBy.get(playerId);
      if (other !== undefined) {
        issues.push({
          code: "ROSTER_DUPLICATE",
          message: `Player "${playerId}" is on "${other}" and "${teamId}".`,
        });
        continue;
      }
      rosteredBy.set(playerId, teamId);
      const player = state.world.players[playerId];
      if (player === undefined) {
        issues.push({
          code: "ROSTER_MISSING_PLAYER",
          message: `Team "${teamId}" rosters unknown player "${playerId}".`,
        });
      } else if (player.teamId !== teamId) {
        issues.push({
          code: "ROSTER_TEAM_MISMATCH",
          message: `Player "${playerId}" is on "${teamId}"'s roster but has teamId "${String(player.teamId)}".`,
        });
      } else if (isPlayerDlAssigned(player)) {
        issues.push({
          code: "ROSTER_DL_ASSIGNED",
          message: `Development League player "${playerId}" is on "${teamId}"'s top-league roster.`,
        });
      }
    }
  }

  for (const playerId of sortedIds(state.world.players)) {
    const player = state.world.players[playerId]!;
    if (player.retired === true) {
      if (player.teamId != null) {
        issues.push({
          code: "RETIRED_WITH_TEAM",
          message: `Retired player "${playerId}" still belongs to "${player.teamId}".`,
        });
      }
      continue;
    }
    if (player.teamId == null) {
      if (isPlayerDlAssigned(player)) {
        issues.push({
          code: "DL_WITHOUT_TEAM",
          message: `Player "${playerId}" is assigned to the Development League without a team.`,
        });
      }
      continue;
    }
    if (state.world.teams[player.teamId] === undefined) {
      issues.push({
        code: "PLAYER_UNKNOWN_TEAM",
        message: `Player "${playerId}" belongs to unknown team "${player.teamId}".`,
      });
      continue;
    }
    if (!isPlayerDlAssigned(player) && !rosteredBy.has(playerId)) {
      issues.push({
        code: "PLAYER_OFF_ROSTER",
        message: `Player "${playerId}" belongs to "${player.teamId}" but is on no roster.`,
      });
    }
  }

  // In the offseason the pool is next season's, while players whose
  // contracts expire stay on their teams until Roster Decisions ends.
  if (
    state.competition.season.phase === "offseason" &&
    contractCoverageYear(state) === state.competition.season.year
  ) {
    return;
  }
  for (const playerId of listFreeAgents(state).playerIds) {
    const player = state.world.players[playerId]!;
    const owner = rosteredBy.get(playerId);
    if (owner !== undefined) {
      issues.push({
        code: "ROSTER_AND_FREE_AGENT",
        message: `Player "${playerId}" is on "${owner}"'s roster and in the free-agent pool.`,
      });
    }
    if (player.teamId != null) {
      issues.push({
        code: "FREE_AGENT_ON_TEAM",
        message: `Free agent "${playerId}" still belongs to "${player.teamId}".`,
      });
    }
  }
}

function checkContracts(state: GameState, issues: OffseasonInvariantIssue[]) {
  const coverageYear = contractCoverageYear(state);
  const minimum = vetMinSalary(getLeagueSalaryCap(state));

  for (const contractId of sortedIds(state.business.contracts)) {
    const contract = state.business.contracts[contractId]!;
    try {
      assertContractShape(contract);
    } catch (error) {
      issues.push({
        code: "CONTRACT_SHAPE",
        message: `Contract "${contractId}": ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    for (const [year, salary] of Object.entries(contract.salaryByYear)) {
      if (Number(year) < coverageYear) continue;
      if (!Number.isFinite(salary) || salary < minimum) {
        issues.push({
          code: "CONTRACT_BELOW_MINIMUM",
          message: `Contract "${contractId}" pays ${salary} in ${year}, below the ${minimum} minimum.`,
        });
      }
    }
  }

  for (const playerId of sortedIds(state.world.players)) {
    const player = state.world.players[playerId]!;
    if (player.retired === true || player.teamId == null) continue;
    if (player.contractId == null) {
      issues.push({
        code: "CONTRACT_MISSING",
        message: `Player "${playerId}" belongs to "${player.teamId}" without a contract.`,
      });
      continue;
    }
    const contract = state.business.contracts[player.contractId];
    if (contract === undefined) {
      issues.push({
        code: "CONTRACT_UNKNOWN",
        message: `Player "${playerId}" points at unknown contract "${player.contractId}".`,
      });
      continue;
    }
    if (contract.playerId !== playerId || contract.teamId !== player.teamId) {
      issues.push({
        code: "CONTRACT_MISMATCH",
        message: `Contract "${contract.id}" is for "${contract.playerId}" at "${contract.teamId}", held by "${playerId}" at "${player.teamId}".`,
      });
    }
    if (getContractStatus(contract, coverageYear) !== "active") {
      issues.push({
        code: "CONTRACT_EXPIRED_ON_TEAM",
        message: `Player "${playerId}" at "${player.teamId}" holds contract "${contract.id}" ending ${contract.endYear}, before ${coverageYear}.`,
      });
    }
  }
}

function checkPayroll(state: GameState, issues: OffseasonInvariantIssue[]) {
  const year = contractCoverageYear(state);
  const cap = getLeagueSalaryCap(state);
  const expected = new Map<string, number>();
  for (const contract of Object.values(state.business.contracts)) {
    const player = state.world.players[contract.playerId];
    if (player != null && isPlayerDlAssigned(player)) continue;
    const salary = getContractSalaryForYear(contract, year) ?? 0;
    expected.set(
      contract.teamId,
      (expected.get(contract.teamId) ?? 0) + salary,
    );
  }
  for (const teamId of sortedIds(state.world.teams) as TeamId[]) {
    const sum =
      (expected.get(teamId) ?? 0) +
      deadMoneyForSeason(state.business.deadMoney?.[teamId], year);
    const payroll = getTeamPayroll(teamId, year, state);
    if (payroll !== sum) {
      issues.push({
        code: "PAYROLL_MISMATCH",
        message: `Team "${teamId}" payroll ${payroll} in ${year} != contracts + dead money ${sum}.`,
      });
    }
    const space = getTeamCapSpace(teamId, year, state);
    if (space !== cap - payroll) {
      issues.push({
        code: "CAP_SPACE_MISMATCH",
        message: `Team "${teamId}" cap space ${space} != cap ${cap} - payroll ${payroll}.`,
      });
    }
  }
}

/**
 * Cash reconciles with the monthly funds journal: each month opens where
 * the previous one closed, and the latest month closes at the current cash.
 */
function checkCash(state: GameState, issues: OffseasonInvariantIssue[]) {
  for (const teamId of sortedIds(state.business.finances)) {
    const finances = state.business.finances[teamId]!;
    if (!Number.isFinite(finances.businessFunds)) {
      issues.push({
        code: "CASH_NOT_FINITE",
        message: `Team "${teamId}" cash is ${finances.businessFunds}.`,
      });
      continue;
    }
    const ledger = finances.businessFundsLedgerByMonth ?? {};
    const months = Object.keys(ledger).sort();
    for (let index = 1; index < months.length; index += 1) {
      const prior = ledger[months[index - 1]!]!;
      const month = ledger[months[index]!]!;
      const closed = prior.openBusinessFunds + prior.netBusinessFundsChange;
      if (month.openBusinessFunds !== closed) {
        issues.push({
          code: "CASH_LEDGER_GAP",
          message: `Team "${teamId}" ${months[index]} opens at ${month.openBusinessFunds}, ${months[index - 1]} closed at ${closed}.`,
        });
      }
    }
    const last = months.at(-1);
    if (last !== undefined) {
      const entry = ledger[last]!;
      const closed = entry.openBusinessFunds + entry.netBusinessFundsChange;
      if (closed !== finances.businessFunds) {
        issues.push({
          code: "CASH_LEDGER_MISMATCH",
          message: `Team "${teamId}" cash ${finances.businessFunds} != ${last} ledger close ${closed}.`,
        });
      }
    }
  }
}

/**
 * First NaN or infinite number in a value. Optional fields are written as
 * explicit `undefined`, so missing required fields are left to the
 * persistence validator.
 */
function findBadNumber(value: unknown, path: string): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? null : path;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const bad = findBadNumber(value[index], `${path}[${index}]`);
      if (bad !== null) return bad;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const bad = findBadNumber(child, `${path}.${key}`);
      if (bad !== null) return bad;
    }
  }
  return null;
}

function checkPlayers(
  state: GameState,
  previous: GameState | undefined,
  issues: OffseasonInvariantIssue[],
) {
  for (const playerId of sortedIds(state.world.players)) {
    const player = state.world.players[playerId]!;
    const bad = findBadNumber(player, "player");
    if (bad !== null) {
      issues.push({
        code: "PLAYER_FIELD_INVALID",
        message: `Player "${playerId}" has a non-finite value at ${bad}.`,
      });
    }
    for (const [key, rating] of Object.entries(player.attributes)) {
      if (rating < RATING_MIN || rating > RATING_MAX) {
        issues.push({
          code: "RATING_OUT_OF_RANGE",
          message: `Player "${playerId}" ${key} is ${rating}.`,
        });
      }
    }
  }

  if (previous === undefined) return;
  const expectedDelta =
    developedSeasonCount(state) - developedSeasonCount(previous);
  for (const playerId of sortedIds(state.world.players)) {
    const player = state.world.players[playerId]!;
    const before = previous.world.players[playerId];
    if (before === undefined || before.retired === true) continue;
    const delta = player.age - before.age;
    const allowed =
      player.retired === true
        ? delta >= 0 && delta <= expectedDelta
        : delta === expectedDelta;
    if (!allowed) {
      issues.push({
        code: "AGE_INCREMENT",
        message: `Player "${playerId}" aged ${delta} year(s); ${expectedDelta} season(s) were developed.`,
      });
    }
  }
}

function checkDraftPicks(state: GameState, issues: OffseasonInvariantIssue[]) {
  const seen = new Map<string, string>();
  for (const pickId of sortedIds(state.world.draftPicks)) {
    const pick = state.world.draftPicks[pickId]!;
    for (const teamId of [pick.ownerTeamId, pick.originalTeamId]) {
      if (state.world.teams[teamId] === undefined) {
        issues.push({
          code: "PICK_UNKNOWN_TEAM",
          message: `Draft pick "${pickId}" refers to unknown team "${teamId}".`,
        });
      }
    }
    const key = `${pick.seasonYear}:${pick.round}:${pick.originalTeamId}`;
    const other = seen.get(key);
    if (other !== undefined) {
      issues.push({
        code: "PICK_DUPLICATE",
        message: `Draft picks "${other}" and "${pickId}" are both ${key}.`,
      });
    }
    seen.set(key, pickId);
  }

  for (const draftId of sortedIds(state.world.drafts)) {
    const draft = state.world.drafts[draftId]!;
    const slotPicks = new Set<string>();
    for (const slot of draft.order) {
      if (slotPicks.has(slot.draftPickId)) {
        issues.push({
          code: "DRAFT_SLOT_DUPLICATE",
          message: `Draft "${draftId}" lists pick "${slot.draftPickId}" twice.`,
        });
      }
      slotPicks.add(slot.draftPickId);
      if (slot.status === "used") {
        if (
          slot.selectedPlayerId === undefined ||
          state.world.players[slot.selectedPlayerId] === undefined
        ) {
          issues.push({
            code: "DRAFT_SLOT_NO_PLAYER",
            message: `Draft "${draftId}" pick #${slot.overallPick} is used without a drafted player.`,
          });
        }
      }
    }
  }
}

/** Every broken offseason invariant, in a stable order. */
export function collectOffseasonInvariantIssues(
  state: GameState,
  context: OffseasonInvariantContext = {},
): OffseasonInvariantIssue[] {
  // Restricted free agents are classified while their contracts still exist,
  // so "RFA still rostered" only applies once expired contracts are released.
  const contractsReleased =
    state.competition.season.phase !== "offseason" ||
    contractCoverageYear(state) > state.competition.season.year;
  const issues: OffseasonInvariantIssue[] = collectLeagueInvariantIssues(state)
    .filter((issue) => contractsReleased || issue.code !== "RFA_STILL_ROSTERED")
    .map((issue) => ({ code: `LEAGUE_${issue.code}`, message: issue.message }));
  checkPhase(state, issues);
  checkRosters(state, issues);
  checkContracts(state, issues);
  checkPayroll(state, issues);
  checkCash(state, issues);
  checkPlayers(state, context.previous, issues);
  checkDraftPicks(state, issues);
  if (context.deep !== false) {
    try {
      validateGameState(state);
    } catch (error) {
      issues.push({
        code: "STATE_INVALID",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return issues;
}

/** Throws with every broken invariant listed. */
export function assertOffseasonInvariants(
  state: GameState,
  context: OffseasonInvariantContext = {},
): void {
  const issues = collectOffseasonInvariantIssues(state, context);
  if (issues.length === 0) return;
  const where = [
    context.label,
    `season ${state.competition.season.year}`,
    getActivePhaseId(state),
    state.world.calendar.currentDate,
  ]
    .filter((part) => part !== undefined)
    .join(", ");
  throw new Error(
    `Offseason invariants failed (${where}):\n` +
      issues.map((issue) => `  [${issue.code}] ${issue.message}`).join("\n"),
  );
}
