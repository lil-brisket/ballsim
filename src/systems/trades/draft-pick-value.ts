import type { DraftPick } from "@/domain/entities/draft-pick";
import {
  DRAFT_PICK_VALUE_ROUND_1,
  DRAFT_PICK_VALUE_ROUND_2,
} from "@/systems/trades-config";

/**
 * Round-only fallback (80 / 50). Live trades, Finder, and ownership
 * alignment use `getBaseAssetValue` (slot curve + year discount).
 * Kept as the R1/R2 floor constants' characterization helper.
 */
export function calculateDraftPickValue(pick: DraftPick): number {
  return pick.round === 1 ? DRAFT_PICK_VALUE_ROUND_1 : DRAFT_PICK_VALUE_ROUND_2;
}
