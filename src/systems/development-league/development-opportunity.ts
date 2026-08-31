/**
 * Bounded incremental Development League opportunity bonus.
 * Does not replace developPlayer — adds a capped bonus after existing development.
 */

import { DL_MAX_OPPORTUNITY_BONUS } from "@/domain/entities/development-league";
import type { Player } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  DL_MAX_MEANINGFUL_MINUTES_DELTA,
} from "@/systems/development-league/config";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { estimateProjectedTopLeagueMinutes } from "@/systems/development-league/recommendations";

/**
 * Compute capped additive opportunity bonus (0 .. DL_MAX_OPPORTUNITY_BONUS).
 * Driven primarily by (actual meaningful minutes − expected top-league minutes).
 */
export function computeDlOpportunityBonus(
  player: Player,
  teamId: TeamId,
  state: GameState,
): number {
  const expected = estimateProjectedTopLeagueMinutes(player, teamId, state);
  const stats = player.developmentLeague?.currentSeasonStats;
  const assigned =
    isPlayerDlAssigned(player) ||
    player.developmentLeague?.assignedThisSeason === true;

  let actualMpg = 0;
  if (assigned && stats != null && stats.games > 0) {
    actualMpg = stats.minutes / stats.games;
  }

  if (!assigned || actualMpg <= 0) {
    return 0;
  }

  const delta = Math.max(
    0,
    Math.min(DL_MAX_MEANINGFUL_MINUTES_DELTA, actualMpg - expected),
  );
  if (delta <= 0) {
    return 0;
  }

  const overall = calculatePlayerOverall(player.position, player.attributes);
  const potentialGap = Math.max(0, player.potential.overall - overall);
  // Low potential: heavy diminishing returns
  const potentialScale = Math.min(1, potentialGap / 15);
  const minutesScale = delta / DL_MAX_MEANINGFUL_MINUTES_DELTA;
  const ageScale = player.age <= 23 ? 1 : player.age <= 25 ? 0.7 : 0.35;

  const raw =
    DL_MAX_OPPORTUNITY_BONUS * minutesScale * potentialScale * ageScale;
  return Math.max(0, Math.min(DL_MAX_OPPORTUNITY_BONUS, raw));
}

/**
 * Apply a small positive attribute nudge after developPlayer based on DL bonus.
 * Returns the player unchanged when bonus is 0.
 */
export function applyDlOpportunityBonusToPlayer(
  player: Player,
  bonus: number,
  attributeKeys: readonly (keyof Player["attributes"])[],
): Player {
  if (bonus <= 0) {
    return player;
  }
  // Convert bonus into at most 1–2 small attribute bumps toward potential
  const bumps = bonus >= DL_MAX_OPPORTUNITY_BONUS * 0.66 ? 2 : 1;
  const nextAttrs = { ...player.attributes };
  const overall = calculatePlayerOverall(player.position, player.attributes);
  if (overall >= player.potential.overall) {
    return player;
  }
  // Prefer attributes furthest below potential-ish mid values — simple: bump lowest few
  const sorted = [...attributeKeys].sort(
    (a, b) => nextAttrs[a] - nextAttrs[b],
  );
  for (let i = 0; i < bumps && i < sorted.length; i += 1) {
    const key = sorted[i]!;
    nextAttrs[key] = Math.min(99, nextAttrs[key] + 1);
  }
  return {
    ...player,
    attributes: nextAttrs,
  };
}
