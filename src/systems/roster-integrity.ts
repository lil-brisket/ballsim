/**
 * Shared roster / rotation / contract integrity checks for post-trade
 * and pre-simulation validation. Does not mutate state.
 */

import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  validateRosterManagementShape,
  type RosterManagementValidationIssue,
} from "@/systems/roster-management";
import {
  hasHardFeasibilityIssues,
  validateRotationFeasibility,
} from "@/systems/rotation/rotation-feasibility";

export type RosterIntegrityIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type RosterIntegrityResult = {
  ok: boolean;
  issues: RosterIntegrityIssue[];
};

function issue(
  code: string,
  message: string,
  severity: "error" | "warning" = "error",
): RosterIntegrityIssue {
  return { code, message, severity };
}

/**
 * Verify roster membership, player.teamId alignment, roster-management
 * references, contracts, and playable rotation for one team.
 */
export function validateTeamRosterIntegrity(
  state: GameState,
  teamId: TeamId,
): RosterIntegrityResult {
  const issues: RosterIntegrityIssue[] = [];
  const team = state.world.teams[teamId];
  if (team == null) {
    return {
      ok: false,
      issues: [issue("team_missing", `Team "${teamId}" is missing.`)],
    };
  }

  const rosterSet = new Set(team.roster.map(String));

  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (player == null) {
      issues.push(
        issue(
          "missing_roster_player",
          `Roster player ${playerId} does not exist on team ${teamId}.`,
        ),
      );
      continue;
    }
    if (player.teamId !== teamId) {
      issues.push(
        issue(
          "player_team_mismatch",
          `Player ${playerId} has teamId ${String(player.teamId)} but is on roster ${teamId}.`,
        ),
      );
    }
    if (player.contractId != null) {
      const contract = state.business.contracts[player.contractId];
      if (contract == null) {
        issues.push(
          issue(
            "missing_contract",
            `Player ${playerId} references missing contract ${player.contractId}.`,
          ),
        );
      } else if (contract.teamId !== teamId) {
        issues.push(
          issue(
            "contract_team_mismatch",
            `Contract ${contract.id} for player ${playerId} has teamId ${contract.teamId}, expected ${teamId}.`,
          ),
        );
      } else if (contract.playerId !== playerId) {
        issues.push(
          issue(
            "contract_player_mismatch",
            `Contract ${contract.id} playerId ${contract.playerId} does not match ${playerId}.`,
          ),
        );
      }
    }
  }

  const management = team.rosterManagement;
  const shapeIssues: RosterManagementValidationIssue[] =
    validateRosterManagementShape(state, teamId, management);
  for (const shapeIssue of shapeIssues) {
    issues.push(
      issue(`roster_mgmt_${shapeIssue.code}`, shapeIssue.message, "error"),
    );
  }

  for (const entry of management.rotation) {
    if (!rosterSet.has(entry.playerId)) {
      issues.push(
        issue(
          "rotation_stale_player",
          `Rotation entry for ${entry.playerId} is not on team ${teamId} roster.`,
        ),
      );
    }
  }

  const feasibility = validateRotationFeasibility(management);
  if (hasHardFeasibilityIssues(feasibility)) {
    for (const f of feasibility.issues) {
      issues.push(
        issue(`rotation_${f.code}`, f.message, "error"),
      );
    }
  }

  const ok = issues.every((entry) => entry.severity !== "error");
  return { ok, issues };
}

/**
 * Throws when any error-severity integrity issue is found for the team.
 */
export function assertTeamRosterIntegrity(
  state: GameState,
  teamId: TeamId,
): void {
  const result = validateTeamRosterIntegrity(state, teamId);
  const errors = result.issues.filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Roster integrity failure for ${teamId}: ${errors.map((e) => e.message).join(" | ")}`,
    );
  }
}
