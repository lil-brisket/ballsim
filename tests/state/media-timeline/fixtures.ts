import {
  createEmptyGamePlayerStats,
  type Game,
  type GameCompetitionType,
  type GamePlayerStats,
  type GameScore,
} from "@/domain/entities/game";
import type { MediaItem } from "@/domain/entities/media-item";
import type { DomainEvent } from "@/domain/events";
import {
  asGameId,
  asMediaItemId,
  asPlayerId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { withOwnedFranchise } from "@/state/owner-context";
import { createTestGame } from "../../factories/game";
import { createPlayer } from "../../factories/player";
import { createTestGameState } from "../../factories/game-state";

export const TODAY = "2026-12-01";

export function timelineState(): GameState {
  const state = createTestGameState();
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate: TODAY },
    },
    competition: {
      ...state.competition,
      season: { ...state.competition.season, phase: "regular" },
      games: {},
      seasonEventLog: [],
    },
  };
}

export const FIXTURE_PLAYER_ID = "tl_player";

/** Adds one named player to the world (CBL test states start without players). */
export function withFixturePlayer(state: GameState, teamId: string): GameState {
  const player = {
    ...createPlayer({ id: asPlayerId(FIXTURE_PLAYER_ID) }),
    firstName: "Rory",
    lastName: "Vance",
    teamId: asTeamId(teamId),
  };
  return {
    ...state,
    world: {
      ...state.world,
      players: { ...state.world.players, [FIXTURE_PLAYER_ID]: player },
    },
  };
}

export function viewerTeam(state: GameState): TeamId {
  return state.user.activeOwnerTeamId;
}

/** League teams other than the viewer's, sorted. */
export function otherTeams(state: GameState): TeamId[] {
  return Object.keys(state.world.teams)
    .filter((id) => id !== state.user.activeOwnerTeamId)
    .sort() as TeamId[];
}

export function statRow(
  playerId: string,
  teamId: string,
  line: Partial<GamePlayerStats> = {},
): GamePlayerStats {
  return {
    ...createEmptyGamePlayerStats(asPlayerId(playerId)),
    teamId: asTeamId(teamId),
    firstName: "Test",
    lastName: playerId,
    minutes: 30,
    ...line,
  };
}

/** Quarters that keep the winner ahead after every period. */
function evenPeriods(home: number, away: number): GameScore[] {
  const periods: GameScore[] = [];
  for (let q = 0; q < 4; q += 1) {
    periods.push({
      home: q < 3 ? Math.floor(home / 4) : home - 3 * Math.floor(home / 4),
      away: q < 3 ? Math.floor(away / 4) : away - 3 * Math.floor(away / 4),
    });
  }
  return periods;
}

export function finalGame(
  state: GameState,
  input: {
    id: string;
    date: string;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
    periods?: GameScore[];
    stats?: GamePlayerStats[];
    competitionType?: GameCompetitionType;
  },
): Game {
  return {
    ...createTestGame({
      id: asGameId(input.id),
      seasonId: state.competition.season.id,
      date: input.date,
      homeTeamId: asTeamId(input.home),
      awayTeamId: asTeamId(input.away),
      competitionType: input.competitionType ?? "regular_season",
    }),
    status: "final",
    score: { home: input.homeScore, away: input.awayScore },
    periodScores:
      input.periods ?? evenPeriods(input.homeScore, input.awayScore),
    playerStats: input.stats ?? [],
  };
}

export function withGames(state: GameState, games: Game[]): GameState {
  const byId = { ...state.competition.games };
  for (const game of games) byId[game.id] = game;
  return { ...state, competition: { ...state.competition, games: byId } };
}

/** Day `n` of a fixture season (Oct 1 + n). */
export function seasonDay(n: number): string {
  const date = new Date(Date.UTC(2026, 9, 1 + n));
  return date.toISOString().slice(0, 10);
}

export function domainEvent(
  id: string,
  type: string,
  occurredOn: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return { id, type, occurredOn, payload } as unknown as DomainEvent;
}

export function mediaItem(
  event: DomainEvent,
  overrides: Partial<MediaItem> = {},
): MediaItem {
  return {
    id: asMediaItemId(`media_domain_event:${event.id}`),
    source: { type: "domain_event", id: event.id },
    sourceKey: `domain_event:${event.id}`,
    occurredOn: event.occurredOn,
    storyType: "league",
    importance: "medium",
    relevanceScore: 0,
    headline: `Headline ${event.id}`,
    summary: `Summary ${event.id}`,
    status: "confirmed",
    href: `/media/${event.id}`,
    ...overrides,
  };
}

export function withMedia(
  state: GameState,
  events: DomainEvent[],
  items: MediaItem[],
  readState: Record<string, { readAt?: string }> = {},
): GameState {
  const next: GameState = {
    ...state,
    competition: { ...state.competition, seasonEventLog: events },
  };
  return withOwnedFranchise(next, viewerTeam(next), (franchise) => ({
    ...franchise,
    mediaFeed: { items },
    mediaReadState: readState,
  }));
}
