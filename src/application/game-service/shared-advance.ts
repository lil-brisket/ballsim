/**
 * Participation gate shared by every command that advances the league.
 *
 * Refuses while players still block the advance; otherwise hands idle or
 * late online members' franchises to the AI and expires blocking decisions
 * on AI-run teams, so one away member cannot freeze a league for everyone.
 * Single-player saves pass through unchanged.
 */

import type { GameState } from "@/state/game-state";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions/enqueue-trade-offer";
import {
  type ParticipationResult,
  advanceBlockedReason,
  getAutoManagedTeamIds,
  getParticipantsDueForAutoManage,
  withParticipantAutoManaged,
} from "@/systems/participation";

/** Expire blocking decisions (CPU trade offers) aimed at AI-run teams. */
export function withAutoManagedDecisionsExpired(state: GameState): GameState {
  const teams = getAutoManagedTeamIds(state);
  if (teams.size === 0) {
    return state;
  }
  let working = state;
  for (const decision of state.user.pendingOwnerDecisions) {
    if (
      decision.blockingLevel === "blocking" &&
      teams.has(decision.primaryTeamId)
    ) {
      working = resolvePendingOwnerDecision(working, {
        decisionId: decision.id,
        status: "expired",
        decisionSource: "system",
      }).state;
    }
  }
  return working;
}

export function prepareSharedAdvance(
  state: GameState,
  now: Date = new Date(),
): ParticipationResult {
  const blocked = advanceBlockedReason(state, now);
  if (blocked) {
    return { ok: false, error: blocked };
  }
  let working = state;
  for (const { participant, reason } of getParticipantsDueForAutoManage(
    state,
    now,
  )) {
    const next = withParticipantAutoManaged(
      working,
      participant.id,
      reason,
      now,
    );
    if (!next.ok) {
      return next;
    }
    working = next.state;
  }
  return { ok: true, state: withAutoManagedDecisionsExpired(working) };
}
