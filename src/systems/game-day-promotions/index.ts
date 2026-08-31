export {
  GAME_DAY_PROMOTION_CATALOG,
  getGameDayPromotionDefinition,
  listGameDayPromotionDefinitions,
} from "@/systems/game-day-promotions/game-day-promotion-catalog";
export {
  PROMOTION_REACH_MIN,
  PROMOTION_REACH_MAX,
  PROMOTION_VARIANCE_CLAMP,
  PROMOTION_FINAL_CANCEL_WINDOW_DAYS,
  PROMOTION_PARTIAL_REFUND_FRACTION,
  AI_PROMOTION_SCORE_THRESHOLD,
  GAME_DAY_PROMOTION_MEDIA_BUMP,
} from "@/systems/game-day-promotions/game-day-promotion-config";
export {
  evaluatePromotionEffectiveness,
  audienceFit,
  promotionReachMultiplier,
  buildEffectivenessContext,
  fanResponseFromEffectiveness,
} from "@/systems/game-day-promotions/evaluate-promotion-effectiveness";
export { resolveGameDayPromotionEffects } from "@/systems/game-day-promotions/resolve-game-day-promotion-effects";
export type { GameDayPromotionEffectsResolved } from "@/systems/game-day-promotions/resolve-game-day-promotion-effects";
export {
  projectGameDayPromotion,
  computeGameDaySnapshot,
} from "@/systems/game-day-promotions/project-game-day-promotion";
export type { GameDayRevenueSnapshot } from "@/systems/game-day-promotions/project-game-day-promotion";
export {
  scheduleGameDayPromotion,
  cancelGameDayPromotion,
  changeGameDayPromotion,
  refundFractionForCancel,
  refreshPromotionAssignmentStatuses,
} from "@/systems/game-day-promotions/schedule-game-day-promotion";
export {
  settleGameDayPromotion,
  compactPromotionSummary,
} from "@/systems/game-day-promotions/settle-game-day-promotion";
export { applyPromotionDownstreamEffects } from "@/systems/game-day-promotions/apply-promotion-downstream-effects";
export { runAiGameDayPromotionDecisions } from "@/systems/game-day-promotions/ai-game-day-promotions";
