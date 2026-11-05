import type { WatchHighlight, WatchPlayKind } from "@/state/watch-game-view";

/** How much a moment matters on screen; ordinary plays stay quiet. */
export type FxTier = "subtle" | "moderate" | "strong" | "signature";

export type FxTierParams = {
  /** Burst radius as a fraction of the floor's width. */
  burstRadius: number;
  /** Sparks in a light burst. */
  sparks: number;
  /** Peak opacity of the team-coloured arena pulse. */
  pulseAlpha: number;
  /** Peak opacity of the wash over the whole floor; 0 leaves it out. */
  washAlpha: number;
};

/**
 * Every effect's size and strength. The renderer reads only this table, so a
 * different broadcast look means a different table, not a different renderer.
 */
export const FX_TIERS: Record<FxTier, FxTierParams> = {
  subtle: { burstRadius: 0.06, sparks: 0, pulseAlpha: 0.24, washAlpha: 0 },
  moderate: { burstRadius: 0.09, sparks: 14, pulseAlpha: 0.36, washAlpha: 0 },
  strong: { burstRadius: 0.12, sparks: 24, pulseAlpha: 0.46, washAlpha: 0.16 },
  signature: {
    burstRadius: 0.16,
    sparks: 40,
    pulseAlpha: 0.6,
    washAlpha: 0.28,
  },
};

const STRONG_HIGHLIGHTS: readonly WatchHighlight[] = [
  "and_one",
  "clutch",
  "lead_change",
];

/** Tier of a made shot. */
export function madeShotTier(
  kind: WatchPlayKind,
  highlights: readonly WatchHighlight[],
  gameWinner: boolean,
): FxTier {
  if (gameWinner) {
    return "signature";
  }
  if (highlights.some((h) => STRONG_HIGHLIGHTS.includes(h))) {
    return "strong";
  }
  return kind === "three_made" ? "moderate" : "subtle";
}
