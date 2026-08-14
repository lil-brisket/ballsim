import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { Player } from "@/domain/entities/player";
import type { Game, PlayerGameStats } from "@/domain/entities/game";
import type { TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

const HOME_COURT_BONUS = 3;
const BASE_SCORE = 88;
const STARTERS = 5;

/**
 * Simulates all scheduled games for the given world date.
 * Produces team scores, a simple box score, and GameCompleted events.
 */
export function simulateGamesForDate(
  state: GameState,
  rng: Rng,
  date: string,
): SystemResult {
  const games = { ...state.competition.games };
  const events: DomainEvent[] = [];

  for (const gameId of state.competition.schedule.gameIds) {
    const game = games[gameId];
    if (!game || game.date !== date || game.status !== "scheduled") {
      continue;
    }

    const simulated = simulateSingleGame(state, game, rng);
    games[gameId] = simulated.game;
    events.push(
      createDomainEvent({
        type: "GameCompleted",
        occurredOn: date,
        payload: {
          gameId: simulated.game.id,
          homeTeamId: simulated.game.homeTeamId,
          awayTeamId: simulated.game.awayTeamId,
          homeScore: simulated.game.homeScore,
          awayScore: simulated.game.awayScore,
        },
      }),
    );
  }

  if (events.length === 0) {
    return systemResult(state);
  }

  return systemResult(
    {
      ...state,
      competition: {
        ...state.competition,
        games,
      },
    },
    events,
  );
}

function simulateSingleGame(
  state: GameState,
  game: Game,
  rng: Rng,
): { game: Game } {
  const homeRoster = rosterForTeam(state, game.homeTeamId);
  const awayRoster = rosterForTeam(state, game.awayTeamId);

  const homeOffense = averageRating(homeRoster, "offense");
  const homeDefense = averageRating(homeRoster, "defense");
  const awayOffense = averageRating(awayRoster, "offense");
  const awayDefense = averageRating(awayRoster, "defense");

  const homeScore = clampScore(
    Math.round(
      BASE_SCORE +
        homeOffense * 0.35 -
        awayDefense * 0.2 +
        HOME_COURT_BONUS +
        rng.nextInt(-8, 10),
    ),
  );
  const awayScore = clampScore(
    Math.round(
      BASE_SCORE +
        awayOffense * 0.35 -
        homeDefense * 0.2 +
        rng.nextInt(-8, 10),
    ),
  );

  const boxScore = [
    ...allocateBoxScore(homeRoster, homeScore, rng),
    ...allocateBoxScore(awayRoster, awayScore, rng),
  ];

  return {
    game: {
      ...game,
      status: "final",
      homeScore,
      awayScore,
      boxScore,
    },
  };
}

function rosterForTeam(state: GameState, teamId: TeamId): Player[] {
  return Object.values(state.world.players)
    .filter((player) => player.teamId === teamId)
    .sort((a, b) => b.ratings.overall - a.ratings.overall);
}

function averageRating(
  roster: Player[],
  key: "offense" | "defense",
): number {
  const starters = roster.slice(0, STARTERS);
  if (starters.length === 0) {
    return 70;
  }
  const sum = starters.reduce((acc, player) => acc + player.ratings[key], 0);
  return sum / starters.length;
}

function allocateBoxScore(
  roster: Player[],
  teamScore: number,
  rng: Rng,
): PlayerGameStats[] {
  const active = roster.slice(0, Math.min(9, Math.max(STARTERS, roster.length)));
  if (active.length === 0) {
    return [];
  }

  const weights = active.map((player) => Math.max(1, player.ratings.offense));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let pointsLeft = teamScore;
  const stats: PlayerGameStats[] = [];

  for (let i = 0; i < active.length; i += 1) {
    const player = active[i]!;
    const isLast = i === active.length - 1;
    const share = isLast
      ? pointsLeft
      : Math.min(
          pointsLeft,
          Math.max(0, Math.round((weights[i]! / weightSum) * teamScore)),
        );
    pointsLeft -= share;
    const minutes = i < STARTERS ? rng.nextInt(28, 36) : rng.nextInt(8, 22);
    stats.push({
      playerId: player.id,
      minutes,
      points: share,
      rebounds: rng.nextInt(1, 12),
      assists: rng.nextInt(0, 9),
    });
  }

  return stats;
}

function clampScore(score: number): number {
  return Math.max(70, Math.min(140, score));
}
