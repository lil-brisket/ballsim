import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";
import type { GameState } from "@/state/game-state";
import {
  canActivateDraft,
  isDraftCompleteForYear,
} from "@/systems/league-rules/draft-rules";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import { isRfaQualificationComplete } from "@/systems/league-rules/rfa-rules";
import { createRosterRulesConfig, validateRosterSize } from "@/systems/roster-rules";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import type { RuleViolation } from "@/systems/league-rules/types";
import { DRAFT_ROUNDS } from "@/systems/league-rules/invariants";

export type PhasePrerequisiteResult = {
  allowed: boolean;
  violations: RuleViolation[];
  blockReason: string | null;
};

export function canEnterPhase(
  state: GameState,
  toPhaseId: LeaguePhaseId,
): PhasePrerequisiteResult {
  const violations: RuleViolation[] = [];

  if (toPhaseId === "offseason.draft") {
    const activate = canActivateDraft(state);
    violations.push(...activate.violations);
  }

  if (toPhaseId === "offseason.free_agency") {
    const year = state.competition.season.year;
    if (!isDraftCompleteForYear(state, year)) {
      // Also accept any complete draft for current draft class year
      const anyComplete = Object.values(state.world.drafts).some(
        (d) => d.status === "complete",
      );
      if (!anyComplete) {
        violations.push({
          code: "DRAFT_NOT_COMPLETE",
          message: "Free agency cannot open — draft is not complete.",
          tier: "phase_lock",
          action: "advance_phase",
        });
      }
    }
    if (!isRfaQualificationComplete(state)) {
      violations.push({
        code: "RFA_QUALIFICATION_INCOMPLETE",
        message:
          "Free agency cannot open — RFA qualification is incomplete.",
        tier: "phase_lock",
        action: "advance_phase",
      });
    }
  }

  if (toPhaseId === "regular") {
    const rosterRules = createRosterRulesConfig(TRADE_ROSTER_RULES);
    for (const team of Object.values(state.world.teams)) {
      try {
        validateRosterSize(team.roster.length, rosterRules);
      } catch (error) {
        violations.push({
          code: "ROSTER_INVALID",
          message: `Season cannot begin — roster validation failed for "${team.id}": ${
            error instanceof Error ? error.message : String(error)
          }`,
          tier: "hard_lock",
          action: "begin_regular_season",
        });
      }
    }
  }

  if (toPhaseId === "playoffs") {
    const { schedule, games } = state.competition;
    if (schedule.gameIds.length === 0) {
      violations.push({
        code: "REGULAR_SEASON_INCOMPLETE",
        message: "Playoffs cannot start — regular season schedule is empty.",
        tier: "phase_lock",
        action: "begin_playoffs",
      });
    } else {
      for (const gameId of schedule.gameIds) {
        const game = games[gameId];
        if (!game || game.status !== "final") {
          violations.push({
            code: "REGULAR_SEASON_INCOMPLETE",
            message:
              "Playoffs cannot start before regular season completion.",
            tier: "phase_lock",
            action: "begin_playoffs",
          });
          break;
        }
      }
    }
  }

  if (toPhaseId === "offseason.draft" || toPhaseId === "activate_draft" as never) {
    const teamCount = Object.keys(state.world.teams).length;
    const drafts = Object.values(state.world.drafts);
    for (const draft of drafts) {
      if (
        draft.status === "not_started" &&
        draft.order.length !== teamCount * DRAFT_ROUNDS
      ) {
        violations.push({
          code: "DRAFT_ORDER_NOT_FINALIZED",
          message:
            "Draft cannot begin — draft order has not been finalized.",
          tier: "hard_lock",
          action: "activate_draft",
        });
      }
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
    blockReason: violations[0]?.message ?? null,
  };
}

export function canAdvanceFromPhase(
  state: GameState,
  fromPhaseId: LeaguePhaseId,
): PhasePrerequisiteResult {
  const violations: RuleViolation[] = [];

  if (fromPhaseId === "offseason.draft") {
    const draftComplete = Object.values(state.world.drafts).some(
      (d) => d.status === "complete",
    );
    const activeIncomplete = Object.values(state.world.drafts).some(
      (d) => d.status === "active" || d.status === "not_started",
    );
    if (!draftComplete && activeIncomplete) {
      violations.push({
        code: "DRAFT_NOT_COMPLETE",
        message: "Cannot leave draft phase until the draft is complete.",
        tier: "phase_lock",
        action: "advance_phase",
      });
    }
  }

  if (fromPhaseId === "offseason.roster_decisions") {
    // Leaving roster decisions should have RFA qualification done before FA later;
    // mark readiness is enforced at FA entry.
  }

  return {
    allowed: violations.length === 0,
    violations,
    blockReason: violations[0]?.message ?? null,
  };
}

export function canBeginRegularSeason(state: GameState): PhasePrerequisiteResult {
  return canEnterPhase(state, "regular");
}

export function canBeginPlayoffs(state: GameState): PhasePrerequisiteResult {
  return canEnterPhase(state, "playoffs");
}

export function getCurrentPhaseId(state: GameState): LeaguePhaseId {
  return readActivePhaseId(state);
}
