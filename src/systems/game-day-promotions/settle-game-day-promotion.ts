import type {
  GameDayPromotionResult,
} from "@/domain/entities/game-day-promotion";
import {
  createEmptyGameDayPromotionSeasonState,
} from "@/domain/entities/game-day-promotion";
import type { Game } from "@/domain/entities/game";
import { createDomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { asSeasonId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getGameDayPromotionDefinition } from "@/systems/game-day-promotions/game-day-promotion-catalog";
import { fanResponseFromEffectiveness } from "@/systems/game-day-promotions/evaluate-promotion-effectiveness";
import type { GameDayRevenueSnapshot } from "@/systems/game-day-promotions/project-game-day-promotion";
import type { GameDayPromotionEffectsResolved } from "@/systems/game-day-promotions/resolve-game-day-promotion-effects";

/**
 * Stores detailed GameDayPromotionResult and emits GameDayPromotionSettled.
 * Does NOT mutate fan/media/awareness — downstream handlers do that.
 */
export function settleGameDayPromotion(
  state: GameState,
  teamId: TeamId,
  game: Game,
  baseline: GameDayRevenueSnapshot,
  actual: GameDayRevenueSnapshot,
  effects: GameDayPromotionEffectsResolved,
  varianceApplied = 0,
): SystemResult {
  const promoState =
    state.business.gameDayPromotionsByTeamId[teamId] ??
    createEmptyGameDayPromotionSeasonState(
      asSeasonId(state.competition.season.id),
    );
  const assignment = promoState.assignments[game.id];
  if (!assignment) {
    return systemResult(state);
  }

  const definition = getGameDayPromotionDefinition(effects.promotionId);
  const eventCost = assignment.costPaid;
  const attendanceDifference = actual.attendance - baseline.attendance;
  const ticketRevenueDifference =
    actual.ticketRevenue +
    actual.premiumRevenue -
    (baseline.ticketRevenue + baseline.premiumRevenue);
  const merchRevenueDifference = actual.merchRevenue - baseline.merchRevenue;
  const concessionsRevenueDifference =
    actual.concessionsRevenue - baseline.concessionsRevenue;
  const netFinancialImpact =
    ticketRevenueDifference +
    merchRevenueDifference +
    concessionsRevenueDifference -
    eventCost;

  const projected = assignment.projectedSnapshot;
  const projectedAttendance = projected?.attendanceMid ?? actual.attendance;
  const projectedAttendanceLow =
    projected?.attendanceLow ?? actual.attendance;
  const projectedAttendanceHigh =
    projected?.attendanceHigh ?? actual.attendance;
  const projectedNetImpact = projected?.netImpactMid ?? netFinancialImpact;
  const projectedNetImpactLow =
    projected?.netImpactLow ?? netFinancialImpact;
  const projectedNetImpactHigh =
    projected?.netImpactHigh ?? netFinancialImpact;

  const fanResponse = fanResponseFromEffectiveness(
    effects.effectivenessScore / 100,
    attendanceDifference,
  );
  const underperformed = netFinancialImpact < projectedNetImpactLow;

  let giveawaysDistributed: number | undefined;
  let giveawaysSoldOut: boolean | undefined;
  if (effects.quantityAvailable != null) {
    giveawaysDistributed = Math.min(
      actual.attendance,
      effects.quantityAvailable,
    );
    giveawaysSoldOut = actual.attendance >= effects.quantityAvailable;
  }

  const result: GameDayPromotionResult = {
    promotionId: effects.promotionId,
    gameId: game.id,
    baselineAttendance: baseline.attendance,
    actualAttendance: actual.attendance,
    attendanceDifference,
    baselineTicketRevenue: baseline.ticketRevenue + baseline.premiumRevenue,
    actualTicketRevenue: actual.ticketRevenue + actual.premiumRevenue,
    ticketRevenueDifference,
    baselineMerchRevenue: baseline.merchRevenue,
    actualMerchRevenue: actual.merchRevenue,
    merchRevenueDifference,
    baselineConcessionsRevenue: baseline.concessionsRevenue,
    actualConcessionsRevenue: actual.concessionsRevenue,
    concessionsRevenueDifference,
    eventCost,
    netFinancialImpact,
    projectedAttendance,
    projectedAttendanceLow,
    projectedAttendanceHigh,
    projectedNetImpact,
    projectedNetImpactLow,
    projectedNetImpactHigh,
    attendanceVariance: actual.attendance - projectedAttendance,
    netImpactVariance: netFinancialImpact - projectedNetImpact,
    effectivenessScore: effects.effectivenessScore,
    fanResponse,
    underperformed,
    giveawaysDistributed,
    giveawaysSoldOut,
    varianceApplied,
  };

  const nextAssignments = { ...promoState.assignments };
  nextAssignments[game.id] = {
    ...assignment,
    status: "completed",
  };

  const nextState: GameState = {
    ...state,
    business: {
      ...state.business,
      gameDayPromotionsByTeamId: {
        ...state.business.gameDayPromotionsByTeamId,
        [teamId]: {
          ...promoState,
          assignments: nextAssignments,
          results: {
            ...promoState.results,
            [game.id]: result,
          },
          committedSpend: Math.max(
            0,
            promoState.committedSpend - assignment.costPaid,
          ),
        },
      },
    },
  };

  const event = createDomainEvent({
    type: "GameDayPromotionSettled",
    occurredOn: state.world.calendar.currentDate,
    payload: {
      teamId,
      gameId: game.id,
      promotionId: effects.promotionId,
      name: definition?.name ?? effects.promotionId,
      objective: definition?.objective ?? "balanced",
      netFinancialImpact,
      attendanceDifference,
      fanResponse,
      underperformed,
      effects: {
        awareness: effects.awarenessBump,
        sentiment: effects.sentimentBump,
        reputation: effects.reputationBump,
        media: effects.mediaBump,
      },
    },
  });

  return systemResult(nextState, [event]);
}

/** Compact summary for HomeGameDaySettled.promotion */
export function compactPromotionSummary(result: GameDayPromotionResult): {
  promotionId: string;
  name: string;
  netFinancialImpact: number;
  attendanceDifference: number;
  fanResponse: GameDayPromotionResult["fanResponse"];
} {
  const definition = getGameDayPromotionDefinition(result.promotionId);
  return {
    promotionId: result.promotionId,
    name: definition?.name ?? result.promotionId,
    netFinancialImpact: result.netFinancialImpact,
    attendanceDifference: result.attendanceDifference,
    fanResponse: result.fanResponse,
  };
}
