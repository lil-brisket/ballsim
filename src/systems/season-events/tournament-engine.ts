import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import {
  asGameId,
  asPlayoffSeriesId,
  asTeamId,
  type GameId,
  type TeamId,
} from "@/domain/ids";
import { createGame } from "@/domain/entities/game";
import type { MidseasonTournamentState } from "@/domain/entities/season-events";
import type { PlayoffSeries } from "@/domain/entities/playoffs";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { simulateScheduledGame } from "@/systems/game-simulation";
import {
  ensureSeasonEventsState,
  withSeasonEvents,
} from "@/systems/season-events/plan-season-events";
import { addCalendarDays } from "@/domain/calendar-date";

/**
 * Qualify top N teams by RS record and build a single-elim bracket.
 * Cancels (returns not_started + empty field) when too few eligible teams.
 */
export function qualifyAndStartTournament(
  state: GameState,
  tournament: MidseasonTournamentState,
): SystemResult {
  const standings = Object.values(state.competition.standings.byTeamId).sort(
    (a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.teamId.localeCompare(b.teamId);
    },
  );

  let fieldSize = tournament.fieldSize;
  // Nearest power of 2 <= fieldSize and <= available teams
  const available = standings.length;
  if (available < 2) {
    return systemResult(
      withSeasonEvents(state, {
        ...ensureSeasonEventsState(state),
        tournament: { ...tournament, fieldSize: 0, qualifiedTeams: [] },
      }),
    );
  }

  while (fieldSize > available) {
    fieldSize = Math.floor(fieldSize / 2);
  }
  while (fieldSize > 1 && (fieldSize & (fieldSize - 1)) !== 0) {
    fieldSize -= 1;
  }
  if (fieldSize < 2) {
    return systemResult(
      withSeasonEvents(state, {
        ...ensureSeasonEventsState(state),
        tournament: { ...tournament, fieldSize: 0, qualifiedTeams: [] },
      }),
    );
  }

  const qualified = standings.slice(0, fieldSize).map((row, index) => ({
    teamId: asTeamId(row.teamId),
    seed: index + 1,
  }));

  const series = buildOpeningRound(qualified, tournament.seasonId);
  const withGames = scheduleSeriesGames(
    state,
    tournament,
    series,
    tournament.startDate,
  );

  const next: MidseasonTournamentState = {
    ...tournament,
    fieldSize,
    qualifiedTeams: qualified,
    series: withGames.series,
    gameIds: withGames.gameIds,
    status: "in_progress",
  };

  return systemResult(
    withSeasonEvents(withGames.state, {
      ...ensureSeasonEventsState(withGames.state),
      tournament: next,
    }),
  );
}

function buildOpeningRound(
  seeds: Array<{ teamId: TeamId; seed: number }>,
  seasonId: string,
): PlayoffSeries[] {
  const series: PlayoffSeries[] = [];
  const n = seeds.length;
  const half = n / 2;
  for (let i = 0; i < half; i += 1) {
    const higher = seeds[i]!;
    const lower = seeds[n - 1 - i]!;
    series.push({
      id: asPlayoffSeriesId(`mst_${seasonId}_r0_s${i}`),
      round: 0,
      slot: i,
      higherSeed: higher.seed,
      lowerSeed: lower.seed,
      higherSeedTeamId: higher.teamId,
      lowerSeedTeamId: lower.teamId,
      wins: {},
      gameIds: [],
      status: "active",
    });
  }
  return series;
}

function scheduleSeriesGames(
  state: GameState,
  tournament: MidseasonTournamentState,
  series: PlayoffSeries[],
  date: string,
): { state: GameState; series: PlayoffSeries[]; gameIds: GameId[] } {
  let games = { ...state.competition.games };
  const gameIds: GameId[] = [...tournament.gameIds];
  const nextSeries: PlayoffSeries[] = [];

  for (const s of series) {
    if (
      s.status !== "active" ||
      !s.higherSeedTeamId ||
      !s.lowerSeedTeamId ||
      s.gameIds.length > 0
    ) {
      nextSeries.push(s);
      continue;
    }
    const gameId = asGameId(`${s.id}_g0`);
    if (!games[gameId]) {
      games[gameId] = createGame({
        id: gameId,
        seasonId: tournament.seasonId,
        date,
        homeTeamId: s.higherSeedTeamId,
        awayTeamId: s.lowerSeedTeamId,
        competitionType: "midseason_tournament",
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        events: [],
        playerStats: [],
        homeTeamSnapshot: null,
        awayTeamSnapshot: null,
      });
      gameIds.push(gameId);
    }
    nextSeries.push({
      ...s,
      gameIds: [gameId],
    });
  }

  return {
    state: {
      ...state,
      competition: {
        ...state.competition,
        games,
      },
    },
    series: nextSeries,
    gameIds,
  };
}

export function simulateTournamentGamesForDate(
  state: GameState,
  rng: Rng,
  date: string,
): SystemResult {
  const seasonEvents = ensureSeasonEventsState(state);
  let tournament = seasonEvents.tournament;
  if (tournament == null || tournament.status !== "in_progress") {
    return systemResult(state);
  }

  let current = state;
  const events: DomainEvent[] = [];
  let series = [...tournament.series];
  let gameIds = [...tournament.gameIds];

  for (let i = 0; i < series.length; i += 1) {
    const s = series[i]!;
    if (s.status !== "active") continue;
    for (const gameId of s.gameIds) {
      const game = current.competition.games[gameId];
      if (!game || game.status !== "scheduled" || game.date > date) {
        continue;
      }
      if (game.date < date) {
        // Catch-up: still simulate overdue games
      }
      const { finalGame, event } = simulateScheduledGame(current, game, rng);
      current = {
        ...current,
        competition: {
          ...current.competition,
          games: {
            ...current.competition.games,
            [gameId]: finalGame,
          },
        },
      };
      events.push(event);

      const homeWon = finalGame.score.home > finalGame.score.away;
      const winnerId = homeWon ? finalGame.homeTeamId : finalGame.awayTeamId;
      series[i] = {
        ...s,
        status: "complete",
        winnerTeamId: winnerId,
        wins: {
          [finalGame.homeTeamId]: homeWon ? 1 : 0,
          [finalGame.awayTeamId]: homeWon ? 0 : 1,
        },
      };
    }
  }

  // Advance bracket when opening round complete
  const maxRound = Math.max(...series.map((s) => s.round), 0);
  const roundSeries = series.filter((s) => s.round === maxRound);
  const roundComplete =
    roundSeries.length > 0 && roundSeries.every((s) => s.status === "complete");

  if (roundComplete) {
    const winners = roundSeries
      .sort((a, b) => a.slot - b.slot)
      .map((s) => s.winnerTeamId!)
      .filter(Boolean);

    if (winners.length === 1) {
      tournament = {
        ...tournament,
        series,
        gameIds,
        status: "complete",
        championTeamId: winners[0],
        endDate: date,
      };
      return systemResult(
        withSeasonEvents(current, {
          ...ensureSeasonEventsState(current),
          tournament,
        }),
        events,
      );
    }

    if (winners.length >= 2 && (winners.length & (winners.length - 1)) === 0) {
      const nextRound = maxRound + 1;
      const newSeries: PlayoffSeries[] = [];
      for (let i = 0; i < winners.length / 2; i += 1) {
        const higher = winners[i * 2]!;
        const lower = winners[i * 2 + 1]!;
        newSeries.push({
          id: asPlayoffSeriesId(
            `mst_${tournament.seasonId}_r${nextRound}_s${i}`,
          ),
          round: nextRound,
          slot: i,
          higherSeed: null,
          lowerSeed: null,
          higherSeedTeamId: higher,
          lowerSeedTeamId: lower,
          wins: {},
          gameIds: [],
          status: "active",
        });
      }
      const scheduled = scheduleSeriesGames(
        current,
        { ...tournament, series, gameIds },
        newSeries,
        addCalendarDays(date, 1),
      );
      current = scheduled.state;
      series = [...series, ...scheduled.series];
      gameIds = scheduled.gameIds;
    }
  }

  tournament = {
    ...tournament,
    series,
    gameIds,
    status: "in_progress",
  };

  return systemResult(
    withSeasonEvents(current, {
      ...ensureSeasonEventsState(current),
      tournament,
    }),
    events,
  );
}
