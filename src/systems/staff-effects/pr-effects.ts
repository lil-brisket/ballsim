import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import { averageAttrs, clamp, diminishAbove } from "@/systems/staff-effects/shared";

/**
 * PR / Communications → reputation and media perception modifiers.
 * Does not touch marketing.ts investment budgets.
 */
export function prReputationModifier(
  state: GameState,
  teamId: TeamId,
): number {
  const pr = findTeamStaffByRole(state, teamId, "public_relations");
  if (!pr) return 0;
  const attrs = pr.attributes as Record<string, number>;
  const score = diminishAbove(
    averageAttrs(attrs, [
      "teamReputation",
      "publicRelations",
      "mediaHandling",
    ]),
    85,
  );
  return clamp((score - 50) * 0.15, -5, 5);
}

export function prMarketabilityMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const pr = findTeamStaffByRole(state, teamId, "public_relations");
  if (!pr) return 1;
  const attrs = pr.attributes as Record<string, number>;
  const score = averageAttrs(attrs, ["marketability", "playerRelations"]);
  return clamp(1 + (score - 50) * 0.002, 0.92, 1.08);
}
