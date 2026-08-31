import { calendarDaysBetween } from "@/domain/calendar-date";
import type { DomainEvent } from "@/domain/events";
import type { GameId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/systems/ai-team-decisions";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import { listGameDayPromotionDefinitions } from "@/systems/game-day-promotions/game-day-promotion-catalog";
import { AI_PROMOTION_SCORE_THRESHOLD } from "@/systems/game-day-promotions/game-day-promotion-config";
import { projectGameDayPromotion } from "@/systems/game-day-promotions/project-game-day-promotion";
import { scheduleGameDayPromotion } from "@/systems/game-day-promotions/schedule-game-day-promotion";

type ScoredOption = {
  gameId: GameId;
  promotionId: string;
  score: number;
};

/**
 * Preference-weighted multi-factor promotion score.
 * Community promos with negative financial impact can still win.
 */
function scorePromotionOption(
  state: GameState,
  teamId: TeamId,
  gameId: GameId,
  promotionId: string,
  prefs: {
    marketingPriority: number;
    attendancePriority: number;
    cashPreservation: number;
    spendWillingness: number;
  },
): number | null {
  const game = state.competition.games[gameId];
  if (!game) return null;
  const projection = projectGameDayPromotion(
    state,
    teamId,
    game,
    promotionId,
  );
  if (!projection) return null;

  const definition = listGameDayPromotionDefinitions().find(
    (d) => d.id === promotionId,
  );
  if (!definition) return null;

  const cash = state.business.finances[teamId]?.businessFunds ?? 0;
  if (definition.cost > cash * 0.15 && prefs.cashPreservation > 60) {
    return null;
  }
  if (definition.cost > cash) {
    return null;
  }

  const financialValue = projection.netImpactMid / 10_000;
  const attendanceValue = projection.attendanceDifferenceMid / 500;
  const fanValue =
    definition.effects.sentimentBump * 2 +
    (definition.objective === "fan_engagement" ? 4 : 0);
  const prValue =
    definition.effects.reputationBump * 3 +
    definition.effects.awarenessBump * 1.5 +
    (definition.objective === "community" ||
    definition.objective === "awareness"
      ? 5
      : 0);

  let strategicValue = 0;
  const ops = state.business.franchiseOps[teamId];
  if (ops) {
    if (ops.marketSize < 45 && definition.category === "community_pr") {
      strategicValue += 6;
    }
    if (ops.marketSize < 45 && definition.targetAudience === "families") {
      strategicValue += 3;
    }
    if (
      definition.category === "ticket_promotion" &&
      ops.fanSentiment > 65 &&
      ops.marketSize > 60
    ) {
      strategicValue -= 8;
    }
    const standing = state.competition.standings.byTeamId[teamId];
    const games = standing ? standing.wins + standing.losses : 0;
    const winPct = games === 0 ? 0.5 : standing!.wins / games;
    if (winPct < 0.4 && definition.objective === "attendance") {
      strategicValue += 5;
    }
  }

  const home = state.world.teams[teamId];
  const away = state.world.teams[game.awayTeamId];
  if (
    home &&
    away &&
    home.divisionId === away.divisionId &&
    (definition.id === "rivalry_night" ||
      definition.category === "entertainment" ||
      definition.category === "giveaway")
  ) {
    strategicValue += 4;
  }

  const wFinancial = 0.35 + (prefs.spendWillingness / 100) * 0.15;
  const wAttendance = 0.2 + (prefs.attendancePriority / 100) * 0.25;
  const wFan = 0.15 + (prefs.marketingPriority / 100) * 0.1;
  const wPR = 0.15 + (prefs.marketingPriority / 100) * 0.15;
  const wStrategic = 0.15;
  const costPenalty =
    (definition.cost / 50_000) * (prefs.cashPreservation / 100);
  const riskPenalty = projection.netImpactLow < -20_000 ? 3 : 0;

  return (
    financialValue * wFinancial +
    attendanceValue * wAttendance +
    fanValue * wFan +
    prValue * wPR +
    strategicValue * wStrategic -
    costPenalty -
    riskPenalty
  );
}

/**
 * Weekly AI promotion decisions. At most one schedule per team per week.
 * Uses lead-time eligibility — no fixed day horizon.
 */
export function runAiGameDayPromotionDecisions(
  state: GameState,
  _rng: Rng,
): SystemResult {
  const weekId = state.world.calendar.lastSimulatedWeekId ?? "pre";
  const events: DomainEvent[] = [];
  let current = state;
  const currentDate = current.world.calendar.currentDate;

  const teamIds = Object.keys(current.world.teams).sort() as TeamId[];
  for (const teamId of teamIds) {
    if (isUserControlledTeam(current, teamId)) {
      continue;
    }
    const key = `ai_game_day_promo:${teamId}:${weekId}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }

    const resolved = resolveFranchisePreferences(current, teamId);
    if (!resolved) {
      current = withAppliedGameplayConsequence(current, key);
      continue;
    }
    const prefs = resolved.preferences;

    const promoState = current.business.gameDayPromotionsByTeamId[teamId];
    const eligibleGames = Object.values(current.competition.games)
      .filter(
        (g) =>
          g.homeTeamId === teamId &&
          g.status === "scheduled" &&
          g.date > currentDate &&
          !promoState?.assignments[g.id],
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const options: ScoredOption[] = [];
    for (const game of eligibleGames) {
      for (const definition of listGameDayPromotionDefinitions()) {
        const days = calendarDaysBetween(currentDate, game.date);
        if (days < definition.leadTimeDays) continue;
        if (days > definition.leadTimeDays + 21) continue;

        try {
          const score = scorePromotionOption(
            current,
            teamId,
            game.id,
            definition.id,
            prefs,
          );
          if (score != null && score >= AI_PROMOTION_SCORE_THRESHOLD) {
            options.push({
              gameId: game.id,
              promotionId: definition.id,
              score,
            });
          }
        } catch {
          // Skip invalid combinations
        }
      }
    }

    options.sort(
      (a, b) => b.score - a.score || a.gameId.localeCompare(b.gameId),
    );
    const best = options[0];
    if (best) {
      try {
        const result = scheduleGameDayPromotion(
          current,
          teamId,
          best.gameId,
          best.promotionId,
        );
        current = result.state;
        events.push(...result.events);
      } catch {
        // Insufficient funds / validation — skip
      }
    }

    current = withAppliedGameplayConsequence(current, key);
  }

  return systemResult(current, events);
}
