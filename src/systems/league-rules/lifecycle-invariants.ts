import type { GameState } from "@/state/game-state";
import { DRAFT_ROUNDS } from "@/systems/league-rules/invariants";
import {
  readActivePhaseId,
  seasonPhaseFromPhaseId,
} from "@/systems/league-rules/phase-ids";
import { isActiveRfa } from "@/domain/entities/rfa-status";

export type LeagueInvariantIssue = {
  code: string;
  message: string;
};

/**
 * Development / load-time league invariant checks.
 * Safe for production validation; does not mutate state.
 */
export function collectLeagueInvariantIssues(
  state: GameState,
): LeagueInvariantIssue[] {
  const issues: LeagueInvariantIssue[] = [];
  const phaseId = readActivePhaseId(state);
  const expectedSeasonPhase = seasonPhaseFromPhaseId(phaseId);
  if (state.competition.season.phase !== expectedSeasonPhase) {
    issues.push({
      code: "PHASE_MISMATCH",
      message: `competition.phase (${phaseId}) implies season.phase "${expectedSeasonPhase}" but found "${state.competition.season.phase}".`,
    });
  }

  const pickIds = Object.keys(state.world.draftPicks);
  const seen = new Set<string>();
  for (const id of pickIds) {
    if (seen.has(id)) {
      issues.push({
        code: "DUPLICATE_PICK_ID",
        message: `Duplicate draft pick id "${id}".`,
      });
    }
    seen.add(id);
  }

  const teamCount = Object.keys(state.world.teams).length;
  for (const draft of Object.values(state.world.drafts)) {
    if (
      draft.status !== "not_started" &&
      draft.order.length !== teamCount * DRAFT_ROUNDS &&
      teamCount > 0
    ) {
      issues.push({
        code: "DRAFT_ORDER_SIZE",
        message: `Draft "${draft.id}" order length ${draft.order.length} != teamCount * ${DRAFT_ROUNDS}.`,
      });
    }
  }

  for (const [playerId, rfa] of Object.entries(
    state.business.rfaStatuses ?? {},
  )) {
    if (isActiveRfa(rfa)) {
      const player = state.world.players[playerId];
      if (player?.contractId != null) {
        // Active RFA should be free of binding contract after release
        const contract = state.business.contracts[player.contractId];
        if (contract && player.teamId != null) {
          issues.push({
            code: "RFA_STILL_ROSTERED",
            message: `Active RFA "${playerId}" still has teamId set.`,
          });
        }
      }
    }
  }

  for (const team of Object.values(state.world.teams)) {
    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (player?.retired === true) {
        issues.push({
          code: "RETIRED_ON_ROSTER",
          message: `Retired player "${playerId}" on roster "${team.id}".`,
        });
      }
    }
  }

  if (
    phaseId === "regular" &&
    state.competition.season.tradeDeadlineDate == null &&
    state.competition.season.regularSeasonStartDate != null
  ) {
    issues.push({
      code: "TRADE_DEADLINE_MISSING",
      message: "Regular season began without a snapshotted tradeDeadlineDate.",
    });
  }

  return issues;
}

export function assertLeagueInvariants(state: GameState): void {
  const issues = collectLeagueInvariantIssues(state);
  if (issues.length > 0) {
    throw new Error(
      `League invariants failed: ${issues.map((i) => i.message).join("; ")}`,
    );
  }
}
