/**
 * Extension negotiation sheet view: eligibility, what the player is looking
 * for, his last answer, and what the current deal pays. Presentation only;
 * the rules live in systems/contract-extensions.
 */

import { getContractSalaryForYear } from "@/domain/entities/contract";
import type { ExtensionResponseRecord } from "@/domain/entities/extension-talks";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  activeTalks,
  EXTENSION_ELIGIBLE_SEASONS_LEFT,
  EXTENSION_MAX_YEARS,
  getExtensionBlockReason,
  playerExtensionAsk,
  seasonsLeftOnContract,
} from "@/systems/contract-extensions";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getContractSigningYear, getTeamPayroll } from "@/systems/salary-cap";
import { SUPERMAX_CAP_FRACTION, vetMinSalary } from "@/systems/salary-scale";

export type ExtensionSeasonView = {
  seasonYear: number;
  /** Current deal's salary that season (0 after it ends). */
  currentSalary: number;
  /** Team payroll that season without this player's current salary. */
  payrollWithoutPlayer: number;
};

export type ContractExtensionView = {
  playerId: string;
  /** Seasons left from the signing year (0 = ends now). */
  seasonsLeft: number;
  currentSalary: number;
  /** First season the added years would cover. */
  firstNewSeason: number;
  /** His ask: salary per added season and the years range he accepts. */
  askSalary: number;
  askMinYears: number;
  maxYears: number;
  minSalary: number;
  maxSalary: number;
  salaryCap: number;
  salaryCapEnabled: boolean;
  /** Payroll per season for the next {@link EXTENSION_MAX_YEARS} seasons. */
  seasons: ExtensionSeasonView[];
  lastResponse: ExtensionResponseRecord | null;
  refusals: number;
  testingMarket: boolean;
  /** Why an offer cannot be made now, or null. */
  blockedReason: string | null;
};

/**
 * The extension view only when he can be offered one now-ish: two seasons
 * or fewer left on a deal with the owner team. Null otherwise.
 */
export function toEligibleContractExtensionView(
  state: GameState,
  playerId: string,
): ContractExtensionView | null {
  const view = toContractExtensionView(state, playerId);
  return view !== null &&
    view.seasonsLeft >= 0 &&
    view.seasonsLeft <= EXTENSION_ELIGIBLE_SEASONS_LEFT
    ? view
    : null;
}

/**
 * Null when the player has no contract with the active owner team.
 */
export function toContractExtensionView(
  state: GameState,
  playerId: string,
): ContractExtensionView | null {
  const teamId = getActiveOwnerTeamId(state);
  const id = playerId as PlayerId;
  const player = state.world.players[playerId];
  const contract =
    player?.contractId != null
      ? state.business.contracts[player.contractId]
      : undefined;
  if (!player || player.teamId !== teamId || contract?.teamId !== teamId) {
    return null;
  }
  const signingYear = getContractSigningYear(state);
  const firstNewSeason = Math.max(contract.endYear + 1, signingYear);
  const cap = getLeagueSalaryCap(state);
  const ask = playerExtensionAsk(state, id, teamId);
  const talks = activeTalks(state, id, contract);
  const seasons: ExtensionSeasonView[] = [];
  for (
    let year = signingYear;
    year < firstNewSeason + EXTENSION_MAX_YEARS;
    year += 1
  ) {
    const currentSalary = getContractSalaryForYear(contract, year) ?? 0;
    seasons.push({
      seasonYear: year,
      currentSalary,
      payrollWithoutPlayer: getTeamPayroll(teamId, year, state) - currentSalary,
    });
  }
  return {
    playerId,
    seasonsLeft: seasonsLeftOnContract(state, contract),
    currentSalary:
      getContractSalaryForYear(contract, signingYear) ??
      getContractSalaryForYear(contract, contract.endYear) ??
      0,
    firstNewSeason,
    askSalary: ask.salary,
    askMinYears: ask.minYears,
    maxYears: ask.maxYears,
    minSalary: vetMinSalary(cap),
    maxSalary: Math.round((cap * SUPERMAX_CAP_FRACTION) / 1_000) * 1_000,
    salaryCap: cap,
    salaryCapEnabled: state.settings.financialRules.salaryCapEnabled,
    seasons,
    lastResponse: talks?.lastResponse ?? null,
    refusals: talks?.refusals ?? 0,
    testingMarket: talks?.testingMarket ?? false,
    blockedReason: getExtensionBlockReason(state, { playerId: id, teamId }),
  };
}
