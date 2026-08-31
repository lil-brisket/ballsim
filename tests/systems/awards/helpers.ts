import { createGame, type Game, type GamePlayerStats } from "@/domain/entities/game";
import { createEmptyAwardHistory, type AwardResult } from "@/domain/entities/awards";
import {
  createEmptyPlayerHistory,
  createEmptyPlayerSeasonStatLine,
  type PlayerSeasonStatLine,
} from "@/domain/entities/player-history";
import { asGameId, asPlayerId, asSeasonId, asTeamId, type PlayerId, type TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { createTestGameState } from "../../factories/game-state";
import { createPlayer } from "../../factories/player";
import { createCoach } from "@/domain/entities/coach";
import { asCoachId } from "@/domain/ids";

export function boxRow(
  playerId: string,
  teamId: string,
  stats: Partial<GamePlayerStats> & { points?: number; minutes?: number },
): GamePlayerStats {
  return {
    playerId: asPlayerId(playerId),
    teamId: asTeamId(teamId),
    firstName: playerId,
    lastName: "Test",
    minutes: stats.minutes ?? 30,
    points: stats.points ?? 0,
    rebounds: stats.rebounds ?? 0,
    offensiveRebounds: stats.offensiveRebounds ?? 0,
    defensiveRebounds: stats.defensiveRebounds ?? (stats.rebounds ?? 0),
    assists: stats.assists ?? 0,
    steals: stats.steals ?? 0,
    blocks: stats.blocks ?? 0,
    turnovers: stats.turnovers ?? 1,
    fouls: stats.fouls ?? 2,
    fieldGoalsMade: stats.fieldGoalsMade ?? Math.floor((stats.points ?? 0) / 2),
    fieldGoalsAttempted:
      stats.fieldGoalsAttempted ?? Math.max(1, Math.floor((stats.points ?? 0) / 2) + 4),
    threePointersMade: stats.threePointersMade ?? 0,
    threePointersAttempted: stats.threePointersAttempted ?? 0,
    freeThrowsMade: stats.freeThrowsMade ?? 0,
    freeThrowsAttempted: stats.freeThrowsAttempted ?? 0,
    touches: stats.touches ?? 10,
    started: stats.started ?? true,
  };
}

export function makeFinalGame(input: {
  id: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  playerStats: GamePlayerStats[];
  competitionType?: "regular_season" | "playoffs" | "development_league";
  seasonId?: string;
}): Game {
  return createGame({
    id: asGameId(input.id),
    seasonId: asSeasonId(input.seasonId ?? "season_2026"),
    date: input.date,
    homeTeamId: asTeamId(input.homeTeamId),
    awayTeamId: asTeamId(input.awayTeamId),
    competitionType: input.competitionType ?? "regular_season",
    status: "final",
    score: { home: input.homeScore, away: input.awayScore },
    periodScores: [{ home: input.homeScore, away: input.awayScore }],
    events: [],
    playerStats: input.playerStats,
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
  });
}

/** Build a minimal awards-ready state with two teams and optional players. */
export function createAwardsTestState(options?: {
  seasonYear?: number;
  phase?: GameState["competition"]["season"]["phase"];
}): GameState {
  let state = createTestGameState({ saveId: "save_awards" });
  const year = options?.seasonYear ?? 2026;
  const teamIds = Object.keys(state.world.teams).slice(0, 4);
  // Ensure coaches exist for COTY
  const coaches = { ...state.world.coaches };
  for (const teamId of teamIds) {
    const coachId = `coach_${teamId}`;
    if (!Object.values(coaches).some((c) => c.teamId === teamId)) {
      coaches[coachId] = createCoach({
        id: asCoachId(coachId),
        teamId: asTeamId(teamId),
        firstName: "Coach",
        lastName: teamId,
      });
    }
  }
  state = {
    ...state,
    world: {
      ...state.world,
      coaches,
      calendar: {
        ...state.world.calendar,
        currentDate: `${year}-04-15`,
      },
    },
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        id: asSeasonId(`season_${year}`),
        year,
        phase: options?.phase ?? "regular",
      },
      games: {},
      schedule: {
        seasonId: asSeasonId(`season_${year}`),
        gameIds: [],
        gameIdsByDate: {},
      },
    },
    business: {
      ...state.business,
      awards: createEmptyAwardHistory(),
    },
  };
  return state;
}

export function addPlayerToState(
  state: GameState,
  playerId: string,
  teamId: string,
): GameState {
  const player = createPlayer({
    id: playerId,
    teamId,
    firstName: playerId,
    lastName: "Player",
    contractId: null,
  });
  const team = state.world.teams[teamId];
  if (!team) throw new Error(`missing team ${teamId}`);
  return {
    ...state,
    world: {
      ...state.world,
      players: { ...state.world.players, [playerId]: player },
      teams: {
        ...state.world.teams,
        [teamId]: {
          ...team,
          roster: [...team.roster, asPlayerId(playerId)],
        },
      },
    },
  };
}

export function injectGames(state: GameState, games: Game[]): GameState {
  const byId: Record<string, Game> = { ...state.competition.games };
  const gameIds = [...state.competition.schedule.gameIds];
  for (const game of games) {
    byId[game.id] = game;
    if (!gameIds.includes(game.id)) gameIds.push(game.id);
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      games: byId,
      schedule: {
        ...state.competition.schedule,
        gameIds,
      },
    },
  };
}

export function injectDlGames(state: GameState, games: Game[]): GameState {
  const byId: Record<string, Game> = {
    ...state.competition.developmentLeague.games,
  };
  for (const game of games) {
    byId[game.id] = game;
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      developmentLeague: {
        ...state.competition.developmentLeague,
        games: byId,
      },
    },
  };
}

/** Generate N identical-ish regular-season games for a player with given per-game box. */
export function generatePlayerGames(input: {
  playerId: string;
  teamId: string;
  opponentId: string;
  count: number;
  datePrefix: string; // YYYY-MM
  perGame: Partial<GamePlayerStats>;
  startWins?: boolean;
  seasonYear?: number;
}): Game[] {
  const games: Game[] = [];
  const seasonYear = input.seasonYear ?? 2026;
  for (let i = 0; i < input.count; i += 1) {
    const day = String((i % 28) + 1).padStart(2, "0");
    const home = i % 2 === 0;
    const teamScore = input.startWins === false ? 90 : 110;
    const oppScore = input.startWins === false ? 110 : 90;
    const homeTeamId = home ? input.teamId : input.opponentId;
    const awayTeamId = home ? input.opponentId : input.teamId;
    const homeScore = home ? teamScore : oppScore;
    const awayScore = home ? oppScore : teamScore;
    games.push(
      makeFinalGame({
        id: `game_${input.playerId}_${input.datePrefix}_${i}`,
        date: `${input.datePrefix}-${day}`,
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        seasonId: `season_${seasonYear}`,
        playerStats: [
          boxRow(input.playerId, input.teamId, {
            ...input.perGame,
            started: input.perGame.started ?? true,
          }),
        ],
      }),
    );
  }
  return games;
}

export function withPriorSeasonHistory(
  state: GameState,
  playerId: string,
  seasonYear: number,
  regular: Partial<PlayerSeasonStatLine>,
): GameState {
  const line: PlayerSeasonStatLine = {
    ...createEmptyPlayerSeasonStatLine(),
    ...regular,
  };
  const history =
    state.business.playerHistory[playerId] ??
    createEmptyPlayerHistory(asPlayerId(playerId));
  return {
    ...state,
    business: {
      ...state.business,
      playerHistory: {
        ...state.business.playerHistory,
        [playerId]: {
          ...history,
          seasons: [
            ...history.seasons,
            {
              seasonId: asSeasonId(`season_${seasonYear}`),
              seasonYear,
              age: 22,
              overall: 70,
              attributes: state.world.players[playerId]!.attributes,
              developmentStage: "developing",
              injuryKind: "available",
              contractSnapshot: {
                contractId: null,
                salary: null,
                teamId: state.world.players[playerId]!.teamId,
              },
              competition: {
                regular: line,
                playoffs: createEmptyPlayerSeasonStatLine(),
                development: createEmptyPlayerSeasonStatLine(),
                combined: line,
              },
            },
          ],
        },
      },
    },
  };
}

export function awardWinnerId(result: AwardResult | null): string | null {
  return result?.winner.subjectId ?? null;
}

export function primaryTeamIds(state: GameState): [TeamId, TeamId] {
  const ids = Object.keys(state.world.teams) as TeamId[];
  return [ids[0]!, ids[1]!];
}
