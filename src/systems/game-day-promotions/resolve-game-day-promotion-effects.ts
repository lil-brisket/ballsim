import type { Game } from "@/domain/entities/game";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getGameDayPromotionDefinition } from "@/systems/game-day-promotions/game-day-promotion-catalog";
import {
  buildEffectivenessContext,
  evaluatePromotionEffectiveness,
} from "@/systems/game-day-promotions/evaluate-promotion-effectiveness";

export type GameDayPromotionEffectsResolved = {
  promotionId: string;
  demandBoost: number;
  /** Multiplier applied to GA ticket price during seat allocation (<1 for discounts). */
  ticketPriceMultiplier: number;
  merchMultiplier: number;
  concessionMultiplier: number;
  effectivenessScore: number;
  audienceFit: number;
  fatigueMultiplier: number;
  promotionReachMultiplier: number;
  awarenessBump: number;
  sentimentBump: number;
  reputationBump: number;
  mediaBump: number;
  quantityAvailable?: number;
};

/**
 * Pure effect resolution for an assigned promotion.
 * Does not mutate state. ticket-revenue applies these to demand/prices.
 */
export function resolveGameDayPromotionEffects(
  state: GameState,
  teamId: TeamId,
  game: Game,
  varianceFactor = 1,
): GameDayPromotionEffectsResolved | null {
  const promoState = state.business.gameDayPromotionsByTeamId[teamId];
  const assignment = promoState?.assignments[game.id];
  if (!assignment || assignment.status === "cancelled") {
    return null;
  }
  const definition = getGameDayPromotionDefinition(assignment.promotionId);
  if (!definition) {
    return null;
  }

  const context = buildEffectivenessContext(
    state,
    teamId,
    game,
    definition.id,
  );
  const evaluated = evaluatePromotionEffectiveness(definition, context);
  const demandBoost = Math.max(
    0,
    evaluated.effectiveDemandBoost * varianceFactor,
  );

  return {
    promotionId: definition.id,
    demandBoost,
    ticketPriceMultiplier: definition.effects.ticketPriceMultiplier ?? 1,
    merchMultiplier: definition.effects.merchMultiplier,
    concessionMultiplier: definition.effects.concessionMultiplier,
    effectivenessScore: Math.round(evaluated.effectiveness * 100),
    audienceFit: evaluated.audienceFit,
    fatigueMultiplier: evaluated.fatigueMultiplier,
    promotionReachMultiplier: evaluated.promotionReachMultiplier,
    awarenessBump: definition.effects.awarenessBump,
    sentimentBump: definition.effects.sentimentBump,
    reputationBump: definition.effects.reputationBump,
    mediaBump: definition.effects.mediaBump,
    quantityAvailable: definition.quantityAvailable,
  };
}
