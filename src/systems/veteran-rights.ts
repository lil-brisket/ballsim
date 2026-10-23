/**
 * Veteran rights: a team may go over the cap to re-sign its own player once
 * he has spent `settings.financialRules.veteranRightsSeasons` straight
 * seasons with it. Applies to owner extensions, CPU extensions and
 * re-signing him in free agency. Seasons come from player history plus the
 * season in progress.
 */

import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { aiPayrollBudget } from "@/systems/ai-payroll-budget";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { luxuryTaxThreshold } from "@/systems/payroll-rules";
import { getTeamPayroll } from "@/systems/salary-cap";

/** CPU teams pay the tax only with this much win-now pressure... */
export const AI_TAX_PAYER_MIN_WIN_NOW = 0.6;
/** ...and at least this much cash on hand. */
export const AI_TAX_PAYER_MIN_CASH = 30_000_000;

/** Straight seasons the player has spent with the team, most recent first. */
export function seasonsWithTeam(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): number {
  const seasons = [
    ...(state.business.playerHistory[playerId]?.seasons ?? []),
  ].sort((a, b) => b.seasonYear - a.seasonYear);
  const year = state.competition.season.year;
  const player = state.world.players[playerId];
  let count = 0;
  let expected = year;
  // The season in progress counts once he is on the team for it.
  const archivedThisYear = seasons[0]?.seasonYear === year;
  if (!archivedThisYear) {
    if (
      player?.teamId === teamId &&
      state.competition.season.phase !== "offseason"
    ) {
      count += 1;
    }
    expected = year - 1;
  }
  for (const season of seasons) {
    if (season.seasonYear !== expected) break;
    if (season.contractSnapshot.teamId !== teamId) break;
    count += 1;
    expected -= 1;
  }
  return count;
}

export function hasVeteranRights(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): boolean {
  const rules = state.settings.financialRules;
  if (!rules.veteranRightsEnabled) return false;
  return seasonsWithTeam(state, playerId, teamId) >= rules.veteranRightsSeasons;
}

/**
 * Room a CPU team has to re-sign its own player with veteran rights: what
 * its budget allows, and below the tax line unless it is chasing a title
 * and has the cash.
 */
export function aiVeteranRightsRoom(
  state: GameState,
  teamId: TeamId,
  year: number,
): number {
  const payroll = getTeamPayroll(teamId, year, state);
  const budget = aiPayrollBudget(state, teamId);
  let room = budget === null ? Number.MAX_SAFE_INTEGER : budget - payroll;
  if (
    state.settings.financialRules.luxuryTaxEnabled &&
    !aiWillPayTax(state, teamId)
  ) {
    const line = luxuryTaxThreshold(state.settings, getLeagueSalaryCap(state));
    room = Math.min(room, line - payroll);
  }
  return room;
}

export function aiWillPayTax(state: GameState, teamId: TeamId): boolean {
  const prefs = resolveFranchisePreferences(state, teamId)?.preferences;
  const cash = state.business.finances[teamId]?.businessFunds ?? 0;
  return (
    (prefs?.winNowPressure ?? 0) >= AI_TAX_PAYER_MIN_WIN_NOW &&
    cash >= AI_TAX_PAYER_MIN_CASH
  );
}
