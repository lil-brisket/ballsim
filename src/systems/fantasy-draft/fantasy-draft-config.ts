import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

/** Players each team drafts in a startup fantasy draft (= max roster size). */
export const FANTASY_DRAFT_PICKS_PER_TEAM = TRADE_ROSTER_RULES.maxRosterSize;

/**
 * Pool size multiplier over total roster slots.
 * 30 teams × 15 picks × 1.15 ≈ 518 pool players (450 drafted, ~68 FAs).
 */
export const FANTASY_POOL_OVERSUPPLY_RATIO = 1.15;

/** Minimum undrafted free agents regardless of ratio. */
export const FANTASY_POOL_MIN_EXTRA_PLAYERS = 50;

/** Default fantasy contract length in seasons. */
export const FANTASY_DRAFT_CONTRACT_YEARS = 3;

/**
 * Marker stored on fantasy-draft contract IDs so undo/completion can identify them.
 * Format: `contract_fantasy_<playerId>`
 */
export const FANTASY_CONTRACT_ID_PREFIX = "contract_fantasy_";

/** Soft position share target for pool generation (~20% each). */
export const FANTASY_POOL_POSITION_SHARE = 0.2;

/** Allowed position share range for pool generation safeguards. */
export const FANTASY_POOL_POSITION_SHARE_MIN = 0.15;
export const FANTASY_POOL_POSITION_SHARE_MAX = 0.25;

/**
 * Computes fantasy player pool size for a league.
 * Always greater than total roster slots.
 */
export function computeFantasyPoolSize(teamCount: number): number {
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    throw new Error("teamCount must be a positive integer.");
  }
  const totalSlots = teamCount * FANTASY_DRAFT_PICKS_PER_TEAM;
  const fromRatio = Math.ceil(totalSlots * FANTASY_POOL_OVERSUPPLY_RATIO);
  const fromMinExtra = totalSlots + FANTASY_POOL_MIN_EXTRA_PLAYERS;
  return Math.max(fromRatio, fromMinExtra);
}

export function computeFantasyTotalPicks(teamCount: number): number {
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    throw new Error("teamCount must be a positive integer.");
  }
  return teamCount * FANTASY_DRAFT_PICKS_PER_TEAM;
}
