import type {
  FanResponse,
  GameDayPromotionDefinition,
  GameDayPromotionTargetAudience,
} from "@/domain/entities/game-day-promotion";
import type { Game } from "@/domain/entities/game";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  DIVISION_MATCHUP_AFFINITY_BONUS,
  PROMOTION_DAY_OF_WEEK_FACTOR,
  PROMOTION_FATIGUE_FLOOR,
  PROMOTION_FATIGUE_PER_USE,
  PROMOTION_REACH_MAX,
  PROMOTION_REACH_MIN,
} from "@/systems/game-day-promotions/game-day-promotion-config";

export type PromotionEffectivenessContext = {
  marketSize: number;
  fanSentiment: number;
  awareness: number;
  winPct: number;
  opponentWinPct: number;
  sameDivision: boolean;
  gameDate: string;
  priorUsesThisSeason: number;
  cooldownExpired: boolean;
};

export type PromotionEffectivenessResult = {
  /** 0–1 composite effectiveness before reach. */
  effectiveness: number;
  /** 0.90–1.10 reach from awareness (not effectiveness). */
  promotionReachMultiplier: number;
  /** Combined fatigue multiplier. */
  fatigueMultiplier: number;
  /** Final demand-score points to add. */
  effectiveDemandBoost: number;
  audienceFit: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Simple v1 audience fit from market size + target audience.
 * Leaves room for demographic modeling later.
 */
export function audienceFit(
  marketSize: number,
  fanSentiment: number,
  targetAudience: GameDayPromotionTargetAudience,
): number {
  const market = clampRating(marketSize) / 100;
  const sentiment = clampRating(fanSentiment) / 100;
  switch (targetAudience) {
    case "families":
      // Mid markets skew family-friendly.
      return clamp01(0.55 + (1 - Math.abs(market - 0.5) * 1.2) * 0.25 + sentiment * 0.15);
    case "students":
      return clamp01(0.5 + (1 - market) * 0.25 + sentiment * 0.1);
    case "youth":
      return clamp01(0.52 + (1 - Math.abs(market - 0.45)) * 0.2 + sentiment * 0.12);
    case "community":
      return clamp01(0.6 + (1 - market) * 0.2 + sentiment * 0.2);
    case "general":
    default:
      return clamp01(0.65 + sentiment * 0.2);
  }
}

/** Awareness as reach only — heavily compressed to avoid feedback loops. */
export function promotionReachMultiplier(awareness: number): number {
  const t = clampRating(awareness) / 100;
  return PROMOTION_REACH_MIN + t * (PROMOTION_REACH_MAX - PROMOTION_REACH_MIN);
}

export function fatigueMultiplier(priorUsesThisSeason: number): number {
  if (priorUsesThisSeason <= 0) {
    return 1;
  }
  return Math.max(
    PROMOTION_FATIGUE_FLOOR,
    1 - priorUsesThisSeason * PROMOTION_FATIGUE_PER_USE,
  );
}

function dayOfWeekFactor(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  const dow = utc.getUTCDay();
  return PROMOTION_DAY_OF_WEEK_FACTOR[dow] ?? 1;
}

/**
 * Bounded effectiveness model. Does not apply variance (settlement does).
 */
export function evaluatePromotionEffectiveness(
  definition: GameDayPromotionDefinition,
  context: PromotionEffectivenessContext,
): PromotionEffectivenessResult {
  const fit = audienceFit(
    context.marketSize,
    context.fanSentiment,
    definition.targetAudience,
  );
  const opponentAppeal = clamp01(context.opponentWinPct);
  const momentum = clamp01(context.winPct);
  const timing = dayOfWeekFactor(context.gameDate);
  const divisionBonus = context.sameDivision ? DIVISION_MATCHUP_AFFINITY_BONUS : 0;

  // Fan interest: low sentiment dampens effectiveness (underperformance risk).
  const fanInterest = 0.7 + (clampRating(context.fanSentiment) / 100) * 0.3;

  let effectiveness =
    0.35 +
    fit * 0.2 +
    opponentAppeal * 0.15 +
    momentum * 0.1 +
    (timing - 1) * 0.35 +
    divisionBonus;
  effectiveness *= fanInterest;
  effectiveness = clamp01(effectiveness);

  const fatigue = context.cooldownExpired
    ? fatigueMultiplier(context.priorUsesThisSeason)
    : Math.min(fatigueMultiplier(context.priorUsesThisSeason), 0.7);
  const reach = promotionReachMultiplier(context.awareness);

  const effectiveDemandBoost =
    definition.effects.demandBoost * effectiveness * fatigue * reach;

  return {
    effectiveness,
    promotionReachMultiplier: reach,
    fatigueMultiplier: fatigue,
    effectiveDemandBoost,
    audienceFit: fit,
  };
}

export function buildEffectivenessContext(
  state: GameState,
  teamId: TeamId,
  game: Game,
  promotionId: string,
): PromotionEffectivenessContext {
  const ops = state.business.franchiseOps[teamId]!;
  const team = state.world.teams[teamId]!;
  const away = state.world.teams[game.awayTeamId]!;
  const standing = state.competition.standings.byTeamId[teamId];
  const oppStanding = state.competition.standings.byTeamId[game.awayTeamId];
  const homeGames = standing ? standing.wins + standing.losses : 0;
  const oppGames = oppStanding ? oppStanding.wins + oppStanding.losses : 0;
  const promoState = state.business.gameDayPromotionsByTeamId[teamId];
  const priorUses = promoState?.usageByPromotionId[promotionId] ?? 0;
  const lastUsed = promoState?.lastUsedDateByPromotionId[promotionId];
  const definitionUses = priorUses; // cooldown checked by scheduler; here soft

  return {
    marketSize: ops.marketSize,
    fanSentiment: ops.fanSentiment,
    awareness: ops.marketing.awareness,
    winPct: homeGames === 0 ? 0.5 : standing!.wins / homeGames,
    opponentWinPct: oppGames === 0 ? 0.5 : oppStanding!.wins / oppGames,
    sameDivision: team.divisionId === away.divisionId,
    gameDate: game.date,
    priorUsesThisSeason: definitionUses,
    cooldownExpired: !lastUsed || lastUsed < game.date,
  };
}

export function fanResponseFromEffectiveness(
  effectiveness: number,
  attendanceDifference: number,
): FanResponse {
  if (attendanceDifference < 0 || effectiveness < 0.35) {
    return "negative";
  }
  if (effectiveness < 0.5 || attendanceDifference < 200) {
    return "neutral";
  }
  if (effectiveness >= 0.75 && attendanceDifference >= 1000) {
    return "very_positive";
  }
  return "positive";
}
