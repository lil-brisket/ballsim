import type { TeamId } from "@/domain/ids";

/** How lottery odds fall off from the worst record. */
export type DraftLotteryOddsPreset = "flattened" | "weighted";

export const DRAFT_LOTTERY_ODDS_PRESETS: readonly DraftLotteryOddsPreset[] = [
  "flattened",
  "weighted",
];

export function isDraftLotteryOddsPreset(
  value: unknown,
): value is DraftLotteryOddsPreset {
  return (
    typeof value === "string" &&
    (DRAFT_LOTTERY_ODDS_PRESETS as readonly string[]).includes(value)
  );
}

/** Lottery draw for one draft, stored on the draft class (schema v75+). */
export type DraftLotteryResult = {
  draftYear: number;
  oddsPreset: DraftLotteryOddsPreset;
  /** First-round slots decided by the draw. */
  picksDrawn: number;
  /** Lottery teams by record, worst first (each team's odds by index). */
  preLotteryOrder: TeamId[];
  /** Chance of the first pick, same order as preLotteryOrder; sums to 1. */
  odds: number[];
  /** Lottery teams in their final first-round order. */
  finalOrder: TeamId[];
  /** Calendar date of the draw. */
  heldOn: string;
};
