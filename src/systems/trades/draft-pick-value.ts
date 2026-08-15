import type { DraftPick } from "@/domain/entities/draft-pick";
import {
  DRAFT_PICK_VALUE_ROUND_1,
  DRAFT_PICK_VALUE_ROUND_2,
} from "@/systems/trades-config";

/**
 * Isolated draft-pick valuation for trade evaluation.
 * v1 uses round only; year-based differentiation can be added later.
 */
export function calculateDraftPickValue(pick: DraftPick): number {
  return pick.round === 1
    ? DRAFT_PICK_VALUE_ROUND_1
    : DRAFT_PICK_VALUE_ROUND_2;
}
