import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { RuleViolation } from "@/systems/league-rules/types";

export function isPlayerRetired(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.world.players[playerId];
  return player?.retired === true;
}

export function checkRetiredPlayerBlocked(
  state: GameState,
  playerId: PlayerId,
  action:
    | "sign_free_agent"
    | "trade"
    | "player_trade"
    | "player_release"
    | "contract_extension"
    | "submit_rfa_offer_sheet",
): RuleViolation[] {
  if (!isPlayerRetired(state, playerId)) {
    return [];
  }
  return [
    {
      code: "PLAYER_RETIRED",
      message: "Retired players cannot be involved in transactions.",
      tier: "hard_lock",
      action,
    },
  ];
}

export function checkTeamHasRetiredOnRoster(
  state: GameState,
  teamId: TeamId,
): RuleViolation[] {
  const team = state.world.teams[teamId];
  if (!team) return [];
  const violations: RuleViolation[] = [];
  for (const playerId of team.roster) {
    if (isPlayerRetired(state, playerId)) {
      violations.push({
        code: "RETIRED_ON_ROSTER",
        message: `Retired player "${playerId}" remains on roster "${teamId}".`,
        tier: "hard_lock",
      });
    }
  }
  return violations;
}
