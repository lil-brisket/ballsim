/**
 * Owner Mode ownership mandate — what ownership prioritizes and how it
 * evaluates the player. Distinct from FranchiseOps.aiProfile (AI ops decisions)
 * and CoachingPhilosophy (on-court tendencies).
 */

export type OwnerPhilosophy =
  | "win_now"
  | "build_for_the_future"
  | "financially_conservative"
  | "market_expansion"
  | "balanced";

export const OWNER_PHILOSOPHIES: readonly OwnerPhilosophy[] = [
  "win_now",
  "build_for_the_future",
  "financially_conservative",
  "market_expansion",
  "balanced",
] as const;

export function isOwnerPhilosophy(value: string): value is OwnerPhilosophy {
  return (OWNER_PHILOSOPHIES as readonly string[]).includes(value);
}

/** Default for new saves before team pick and for migrated v25 careers. */
export const DEFAULT_OWNER_PHILOSOPHY: OwnerPhilosophy = "balanced";

export const OWNER_PATIENCE_MIN = 0;
export const OWNER_PATIENCE_MAX = 100;
