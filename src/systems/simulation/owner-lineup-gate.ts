import type { GameState } from "@/state/game-state";
import { getOwnedFranchiseAssistance } from "@/state/owner-context";
import {
  buildManagementPolicy,
  evaluateAction,
  isUserAssistCompletelyOff,
} from "@/systems/simulation/management-policy";
import { canRepairTeamLineup } from "@/systems/ai-team-decisions";
import { getEmergencyLineup } from "@/systems/roster-management";

/**
 * True when the owner's team cannot field a legal five (every player at his
 * primary or secondary position) and nobody is set up to fix that: the owner
 * has to sign or reshuffle players before the next game. With AI assist
 * covering injury replacements, the assist signs for the open position first,
 * so the sim keeps going, but only while a signing is possible (a free agent
 * who plays the position, within the cap, with room on the roster). When none
 * is, the owner is stopped like anyone else.
 */
export function ownerLineupNeedsFix(state: GameState): boolean {
  const teamId = state.user.activeOwnerTeamId;
  if (!getEmergencyLineup(state, teamId).emergency) {
    return false;
  }
  const assistance = getOwnedFranchiseAssistance(state);
  if (isUserAssistCompletelyOff(state.settings, assistance)) {
    return true;
  }
  const policy = buildManagementPolicy(state.settings, assistance);
  if (evaluateAction(policy, "SIGN_INJURY_REPLACEMENT").outcome !== "ALLOW") {
    return true;
  }
  return !canRepairTeamLineup(state, teamId);
}
