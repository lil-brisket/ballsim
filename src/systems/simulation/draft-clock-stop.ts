import type { GameState } from "@/state/game-state";
import { getOwnedFranchiseAssistance } from "@/state/owner-context";
import {
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
} from "@/systems/draft/draft-clock";
import { canAiExecute } from "@/systems/simulation/management-policy";

/**
 * True when an owned team is on the draft clock and DRAFT_PICK assist cannot
 * execute. Never runs AI.
 *
 * Timing: callers must not interrupt mid-pipeline. The day loop checks this
 * before advancing a day (refuse to start while already on the clock) and
 * after a completed day (the clock may appear during that day's phase sync;
 * that day still finishes, then simulation pauses).
 */
export function shouldStopForDraftClock(state: GameState): boolean {
  if (!isUserOnDraftClock(state)) {
    return false;
  }
  // The on-clock team's own delegation decides, not whichever owned team is
  // active (multi-team and shared leagues).
  const onClockTeamId = getActiveDraftOnClockSlot(state)!.ownerTeamId;
  const franchiseAssist = getOwnedFranchiseAssistance(state, onClockTeamId);
  return !canAiExecute(state.settings, "DRAFT_PICK", franchiseAssist);
}
