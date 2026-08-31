/**
 * Development League eligibility — v1: recently drafted players only.
 */

import type { Player } from "@/domain/entities/player";
import {
  DL_MAX_SEASONS,
  getDevelopmentLeagueSeasonsRemaining,
} from "@/domain/entities/development-league";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { DL_DRAFT_WINDOW_SEASONS } from "@/systems/development-league/config";
import { getActivePhaseId } from "@/systems/phase-engine";
import type { LeaguePhaseId } from "@/systems/phase-engine";

const ASSIGNMENT_ALLOWED_PHASES: readonly LeaguePhaseId[] = [
  "preseason.preparation",
  "regular",
  "offseason.roster_decisions",
  "offseason.draft",
  "offseason.draft_preparation",
  "offseason.free_agency",
  "postseason.season_review",
];

export type DlEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export function findPlayerDraftSeasonYear(
  playerId: string,
  state: GameState,
): number | null {
  const profile = state.world.players[playerId]?.developmentLeague;
  if (profile?.draftSeasonYear != null) {
    return profile.draftSeasonYear;
  }
  let best: number | null = null;
  for (const draft of Object.values(state.world.drafts)) {
    for (const result of draft.pickResults ?? []) {
      if (result.playerId === playerId) {
        if (best == null || result.seasonYear > best) {
          best = result.seasonYear;
        }
      }
    }
  }
  return best;
}

export function isWithinDraftEligibilityWindow(
  draftSeasonYear: number,
  currentSeasonYear: number,
): boolean {
  const elapsed = currentSeasonYear - draftSeasonYear;
  return elapsed >= 0 && elapsed < DL_DRAFT_WINDOW_SEASONS;
}

export function isAssignmentPhaseAllowed(state: GameState): boolean {
  const phaseId = getActivePhaseId(state);
  return (ASSIGNMENT_ALLOWED_PHASES as readonly string[]).includes(phaseId);
}

/**
 * Hard eligibility gate for Send to Development League.
 * Recommendation scoring is separate — see recommendations.ts.
 */
export function evaluateDevelopmentLeagueEligibility(
  player: Player,
  teamId: TeamId,
  state: GameState,
): DlEligibilityResult {
  const reasons: string[] = [];
  const profile = player.developmentLeague;

  if (player.retired === true) {
    reasons.push("Player is retired.");
  }
  if (player.teamId !== teamId) {
    reasons.push("Player is not owned by this franchise.");
  }
  if (player.contractId == null) {
    reasons.push("Player has no active contract.");
  } else {
    const contract = state.business.contracts[player.contractId];
    if (contract == null || contract.teamId !== teamId) {
      reasons.push("Player contract is not with this franchise.");
    }
  }
  if (player.availability === "suspended") {
    reasons.push("Player is suspended.");
  }
  if (isPlayerDlAssigned(player)) {
    reasons.push("Player is already assigned to the Development League.");
  }
  if (profile?.dlAssignmentLockedThisSeason === true) {
    reasons.push(
      "Player was recalled this season and cannot return to the Development League until next season.",
    );
  }
  const seasonsUsed = profile?.seasonsUsed ?? 0;
  if (seasonsUsed >= DL_MAX_SEASONS) {
    reasons.push(
      `Player has used the maximum of ${DL_MAX_SEASONS} Development League seasons.`,
    );
  }
  const draftYear = findPlayerDraftSeasonYear(player.id, state);
  if (draftYear == null) {
    reasons.push("Player was not drafted (v1 DL is for draft picks only).");
  } else if (
    !isWithinDraftEligibilityWindow(
      draftYear,
      state.competition.season.year,
    )
  ) {
    reasons.push(
      `Player is outside the ${DL_DRAFT_WINDOW_SEASONS}-season draft eligibility window.`,
    );
  }
  if (!isAssignmentPhaseAllowed(state)) {
    reasons.push("Development League assignment is not allowed in this phase.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function isDevelopmentLeagueEligible(
  player: Player,
  teamId: TeamId,
  state: GameState,
): boolean {
  return evaluateDevelopmentLeagueEligibility(player, teamId, state).eligible;
}

export function getSeasonsRemainingForPlayer(player: Player): number {
  return getDevelopmentLeagueSeasonsRemaining(player.developmentLeague);
}
