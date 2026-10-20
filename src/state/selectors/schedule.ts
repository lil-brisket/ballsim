import { isOrphanedCupGame } from "@/domain/entities/game";
import {
  type TeamBrandingView,
  toBrandingView,
} from "@/state/team-branding-view";
import type { GameState } from "@/state/game-state";
import { getGameDayPromotionDefinition } from "@/systems/game-day-promotions/game-day-promotion-catalog";

export type ScheduleGameView = {
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  opponentName: string;
  opponentTeamId: string;
  opponentBranding: TeamBrandingView | null;
  home: boolean;
  status: string;
  teamScore: number | null;
  opponentScore: number | null;
  won: boolean | null;
  gameDayPromotion: {
    promotionId: string;
    name: string;
    status: string;
  } | null;
};

export function toScheduleView(state: GameState): ScheduleGameView[] {
  const teamId = state.user.activeOwnerTeamId;
  const promoState = state.business.gameDayPromotionsByTeamId[teamId];
  const rows: ScheduleGameView[] = [];
  for (const game of Object.values(state.competition.games)) {
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) {
      continue;
    }
    if (isOrphanedCupGame(game)) {
      continue;
    }
    const home = game.homeTeamId === teamId;
    const opponentId = home ? game.awayTeamId : game.homeTeamId;
    const opponent = state.world.teams[opponentId];
    const final = game.status === "final";
    const teamScore = final ? (home ? game.score.home : game.score.away) : null;
    const opponentScore = final
      ? home
        ? game.score.away
        : game.score.home
      : null;
    let gameDayPromotion: ScheduleGameView["gameDayPromotion"] = null;
    if (home && promoState) {
      const assignment = promoState.assignments[game.id];
      const result = promoState.results[game.id];
      if (assignment && assignment.status !== "cancelled") {
        const def = getGameDayPromotionDefinition(assignment.promotionId);
        gameDayPromotion = {
          promotionId: assignment.promotionId,
          name: def?.name ?? assignment.promotionId,
          status: assignment.status,
        };
      } else if (result) {
        const def = getGameDayPromotionDefinition(result.promotionId);
        gameDayPromotion = {
          promotionId: result.promotionId,
          name: def?.name ?? result.promotionId,
          status: "completed",
        };
      }
    }
    rows.push({
      gameId: game.id,
      date: game.date,
      opponentAbbreviation: opponent?.abbreviation ?? "???",
      opponentName: opponent ? `${opponent.city} ${opponent.name}` : "Unknown",
      opponentTeamId: opponentId,
      opponentBranding: toBrandingView(opponent?.branding),
      home,
      status: game.status,
      teamScore,
      opponentScore,
      won:
        teamScore !== null && opponentScore !== null
          ? teamScore > opponentScore
          : null,
      gameDayPromotion,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function toUpcomingGamesView(
  state: GameState,
  limit = 5,
): ScheduleGameView[] {
  const currentDate = state.world.calendar.currentDate;
  return toScheduleView(state)
    .filter((game) => game.status === "scheduled" && game.date >= currentDate)
    .slice(0, limit);
}
