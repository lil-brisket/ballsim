import "server-only";
import type { SaveGameStore } from "@/persistence/save-game-store";
import {
  scheduleGameDayPromotion,
  cancelGameDayPromotion,
  changeGameDayPromotion,
  refundFractionForCancel,
} from "@/systems/game-day-promotions/schedule-game-day-promotion";
import { asGameId } from "@/domain/ids";
import {
  getGameDayPromotionDefinition,
  listGameDayPromotionDefinitions,
} from "@/systems/game-day-promotions/game-day-promotion-catalog";
import { calendarDaysBetween } from "@/domain/calendar-date";
import { projectGameDayPromotion } from "@/systems/game-day-promotions/project-game-day-promotion";
import type { OwnerCommandResult } from "@/application/game-service/types";
import {
  runOwnerFranchiseCommand,
  getStore,
} from "@/application/game-service/internal";

export async function scheduleOwnerGameDayPromotion(
  saveId: string,
  gameId: string,
  promotionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      scheduleGameDayPromotion(
        state,
        state.user.activeOwnerTeamId,
        asGameId(gameId),
        promotionId,
      ),
    store,
  );
}

export async function cancelOwnerGameDayPromotion(
  saveId: string,
  gameId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      cancelGameDayPromotion(
        state,
        state.user.activeOwnerTeamId,
        asGameId(gameId),
      ),
    store,
  );
}

export async function changeOwnerGameDayPromotion(
  saveId: string,
  gameId: string,
  promotionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      changeGameDayPromotion(
        state,
        state.user.activeOwnerTeamId,
        asGameId(gameId),
        promotionId,
      ),
    store,
  );
}

export type GameDayPromotionEventPageView = {
  gameId: string;
  date: string;
  opponentName: string;
  opponentAbbreviation: string;
  home: boolean;
  status: string;
  currentDate: string;
  businessFunds: number;
  committedSpend: number;
  availableCash: number;
  currentPromotion: {
    promotionId: string;
    name: string;
    status: string;
    costPaid: number;
    projected: {
      attendanceLow: number;
      attendanceHigh: number;
      netImpactLow: number;
      netImpactHigh: number;
    } | null;
    refundFractionIfCancelled: number;
  } | null;
  result: {
    promotionId: string;
    name: string;
    actualAttendance: number;
    baselineAttendance: number;
    attendanceDifference: number;
    eventCost: number;
    netFinancialImpact: number;
    projectedAttendanceLow: number;
    projectedAttendanceHigh: number;
    projectedNetImpactLow: number;
    projectedNetImpactHigh: number;
    fanResponse: string;
    underperformed: boolean;
    giveawaysDistributed?: number;
    giveawaysQuantity?: number;
    giveawaysSoldOut?: boolean;
    ticketRevenueDifference: number;
    merchRevenueDifference: number;
    concessionsRevenueDifference: number;
  } | null;
  catalog: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    cost: number;
    leadTimeDays: number;
    available: boolean;
    reason?: string;
    projected: {
      attendanceLow: number;
      attendanceHigh: number;
      netImpactLow: number;
      netImpactHigh: number;
      attendanceDifferenceMid: number;
    } | null;
  }>;
};

export async function loadOwnerGameDayPromotionEventView(
  saveId: string,
  gameId: string,
  store?: SaveGameStore,
): Promise<GameDayPromotionEventPageView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) return null;
  const state = loaded.state;
  const teamId = state.user.activeOwnerTeamId;
  const game = state.competition.games[gameId];
  if (!game) return null;
  if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) return null;

  const home = game.homeTeamId === teamId;
  const opponentId = home ? game.awayTeamId : game.homeTeamId;
  const opponent = state.world.teams[opponentId];
  const promoState = state.business.gameDayPromotionsByTeamId[teamId];
  const assignment = promoState?.assignments[gameId];
  const resultRow = promoState?.results[gameId];
  const currentDate = state.world.calendar.currentDate;
  const businessFunds = state.business.finances[teamId]?.businessFunds ?? 0;
  const committedSpend = promoState?.committedSpend ?? 0;

  let currentPromotion: GameDayPromotionEventPageView["currentPromotion"] =
    null;
  if (assignment && assignment.status !== "cancelled") {
    const def = getGameDayPromotionDefinition(assignment.promotionId);
    currentPromotion = {
      promotionId: assignment.promotionId,
      name: def?.name ?? assignment.promotionId,
      status: assignment.status,
      costPaid: assignment.costPaid,
      projected: assignment.projectedSnapshot
        ? {
            attendanceLow: assignment.projectedSnapshot.attendanceLow,
            attendanceHigh: assignment.projectedSnapshot.attendanceHigh,
            netImpactLow: assignment.projectedSnapshot.netImpactLow,
            netImpactHigh: assignment.projectedSnapshot.netImpactHigh,
          }
        : null,
      refundFractionIfCancelled: refundFractionForCancel(
        currentDate,
        game.date,
        def?.leadTimeDays ?? 7,
      ),
    };
  }

  let result: GameDayPromotionEventPageView["result"] = null;
  if (resultRow) {
    const def = getGameDayPromotionDefinition(resultRow.promotionId);
    result = {
      promotionId: resultRow.promotionId,
      name: def?.name ?? resultRow.promotionId,
      actualAttendance: resultRow.actualAttendance,
      baselineAttendance: resultRow.baselineAttendance,
      attendanceDifference: resultRow.attendanceDifference,
      eventCost: resultRow.eventCost,
      netFinancialImpact: resultRow.netFinancialImpact,
      projectedAttendanceLow: resultRow.projectedAttendanceLow,
      projectedAttendanceHigh: resultRow.projectedAttendanceHigh,
      projectedNetImpactLow: resultRow.projectedNetImpactLow,
      projectedNetImpactHigh: resultRow.projectedNetImpactHigh,
      fanResponse: resultRow.fanResponse,
      underperformed: resultRow.underperformed,
      giveawaysDistributed: resultRow.giveawaysDistributed,
      giveawaysQuantity: def?.quantityAvailable,
      giveawaysSoldOut: resultRow.giveawaysSoldOut,
      ticketRevenueDifference: resultRow.ticketRevenueDifference,
      merchRevenueDifference: resultRow.merchRevenueDifference,
      concessionsRevenueDifference: resultRow.concessionsRevenueDifference,
    };
  }

  const catalog = listGameDayPromotionDefinitions().map((definition) => {
    let available = home && game.status === "scheduled";
    let reason: string | undefined;
    const days = calendarDaysBetween(currentDate, game.date);
    if (!home) {
      available = false;
      reason = "Away games cannot host promotions.";
    } else if (game.status !== "scheduled") {
      available = false;
      reason = "Game is no longer open for scheduling.";
    } else if (days < definition.leadTimeDays) {
      available = false;
      reason = `Needs ${definition.leadTimeDays} days lead time.`;
    } else if (definition.cost > businessFunds) {
      available = false;
      reason = "Insufficient business funds.";
    } else if (
      (promoState?.usageByPromotionId[definition.id] ?? 0) >=
      definition.maxUsesPerSeason
    ) {
      available = false;
      reason = "Max uses reached this season.";
    }
    const projected =
      home && game.status === "scheduled"
        ? projectGameDayPromotion(state, teamId, game, definition.id)
        : null;
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      cost: definition.cost,
      leadTimeDays: definition.leadTimeDays,
      available,
      reason,
      projected: projected
        ? {
            attendanceLow: projected.attendanceLow,
            attendanceHigh: projected.attendanceHigh,
            netImpactLow: projected.netImpactLow,
            netImpactHigh: projected.netImpactHigh,
            attendanceDifferenceMid: projected.attendanceDifferenceMid,
          }
        : null,
    };
  });

  return {
    gameId,
    date: game.date,
    opponentName: opponent ? `${opponent.city} ${opponent.name}` : "Unknown",
    opponentAbbreviation: opponent?.abbreviation ?? "???",
    home,
    status: game.status,
    currentDate,
    businessFunds,
    committedSpend,
    availableCash: businessFunds,
    currentPromotion,
    result,
    catalog,
  };
}
