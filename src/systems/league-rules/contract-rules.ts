import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import type { RuleViolation } from "@/systems/league-rules/types";

/**
 * Extension / new-contract windows only — no negotiation system here.
 */
export function checkContractExtensionWindow(
  state: GameState,
  _playerId: PlayerId,
  _teamId: TeamId,
): { allowed: boolean; violations: RuleViolation[] } {
  const phaseId = readActivePhaseId(state);
  if (
    phaseId === "playoffs" ||
    phaseId === "postseason.season_review" ||
    phaseId === "end_of_season.wrap_up"
  ) {
    return {
      allowed: false,
      violations: [
        {
          code: "EXTENSION_WINDOW_CLOSED",
          message: "Contract extensions are not allowed during the postseason.",
          tier: "phase_lock",
          action: "contract_extension",
        },
      ],
    };
  }
  // Windows exist; full extension writer is deferred.
  if (phaseId === "offseason.roster_decisions") {
    return { allowed: true, violations: [] };
  }
  return {
    allowed: false,
    violations: [
      {
        code: "EXTENSION_NOT_IMPLEMENTED",
        message:
          "Contract extensions are only legal during roster decisions (system deferred).",
        tier: "phase_lock",
        action: "contract_extension",
      },
    ],
  };
}

export function checkPlayerReleaseWindow(
  state: GameState,
): { allowed: boolean; violations: RuleViolation[] } {
  const phaseId = readActivePhaseId(state);
  if (phaseId === "offseason.season_transition") {
    return {
      allowed: false,
      violations: [
        {
          code: "RELEASE_WINDOW_CLOSED",
          message: "Player releases are not available during season transition.",
          tier: "phase_lock",
          action: "player_release",
        },
      ],
    };
  }
  return { allowed: true, violations: [] };
}
