import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  FAN_SENTIMENT_HOME_LOSS_PENALTY,
  FAN_SENTIMENT_HOME_WIN_BUMP,
  FAN_SENTIMENT_SMOOTHING,
  FAN_SENTIMENT_WEIGHTS,
} from "@/systems/fan-sentiment-config";

function clampSentiment(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function teamWinPct(state: GameState, teamId: TeamId): number {
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing) {
    return 0.5;
  }
  const games = standing.wins + standing.losses;
  return games === 0 ? 0.5 : standing.wins / games;
}

function sentimentTarget(
  state: GameState,
  teamId: TeamId,
  gameResultBias = 0,
): number {
  const ops = state.business.franchiseOps[teamId];
  const team = state.world.teams[teamId];
  if (!ops || !team) {
    return 50;
  }

  const winPctScore = teamWinPct(state, teamId) * 100;
  const components = {
    winResult: 50 + gameResultBias,
    winPct: winPctScore,
    reputation: team.reputation,
    mediaAttention: ops.mediaAttention,
    marketingAwareness: ops.marketing.awareness,
  };

  let target = 0;
  for (const key of Object.keys(FAN_SENTIMENT_WEIGHTS) as Array<
    keyof typeof FAN_SENTIMENT_WEIGHTS
  >) {
    target += components[key] * FAN_SENTIMENT_WEIGHTS[key];
  }
  return clampSentiment(target);
}

function smoothToward(current: number, target: number): number {
  const next =
    current + (target - current) * FAN_SENTIMENT_SMOOTHING;
  return Math.round(clampSentiment(next));
}

function updateTeamSentiment(
  state: GameState,
  teamId: TeamId,
  gameResultBias = 0,
): GameState {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return state;
  }
  const target = sentimentTarget(state, teamId, gameResultBias);
  const fanSentiment = smoothToward(ops.fanSentiment, target);
  if (fanSentiment === ops.fanSentiment) {
    return state;
  }
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, fanSentiment },
      },
    },
  };
}

/** Updates fan sentiment for one team toward its multi-factor target. */
export function updateFanSentimentForTeam(
  state: GameState,
  teamId: TeamId,
): SystemResult {
  return systemResult(updateTeamSentiment(state, teamId));
}

/**
 * After games on currentDate, nudge home-team sentiment from results
 * then smooth all teams toward targets.
 */
export function processDailyFanSentimentAfterGames(
  state: GameState,
): SystemResult {
  const date = state.world.calendar.currentDate;
  const gameBias = new Map<TeamId, number>();

  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final" || game.date !== date) {
      continue;
    }
    const teamId = game.homeTeamId;
    const homeWon = game.score.home > game.score.away;
    const delta = homeWon
      ? FAN_SENTIMENT_HOME_WIN_BUMP
      : -FAN_SENTIMENT_HOME_LOSS_PENALTY;
    gameBias.set(teamId, (gameBias.get(teamId) ?? 0) + delta);
  }

  let current = state;
  for (const teamId of Object.keys(current.world.teams).sort()) {
    current = updateTeamSentiment(
      current,
      teamId as TeamId,
      gameBias.get(teamId as TeamId) ?? 0,
    );
  }

  return systemResult(current);
}
