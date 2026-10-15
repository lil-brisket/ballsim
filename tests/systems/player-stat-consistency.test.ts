import { describe, expect, it } from "vitest";
import {
  createGame,
  type GameCompetitionType,
  type GamePlayerStats,
} from "@/domain/entities/game";
import { validateCompletedGameBoxScore } from "@/domain/entities/game-box-score";
import { createSeededRng } from "@/domain/rng";
import { asGameId, asTeamId, type PlayerId, type TeamId } from "@/domain/ids";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { toPlayerDrawerView } from "@/state/entity-drawer-selectors";
import {
  aggregatePlayerSeasonStats,
  deriveCareerHighs,
  derivePlayerTeamStints,
  toPlayerProfileView,
} from "@/state/player-profile-selectors";
import type { GameState } from "@/state/game-state";
import { toPlayerDetailView } from "@/state/selectors";
import { appendAllPlayerSeasonRecords } from "@/systems/player-history";
import { bootstrapWorld } from "@/systems/world-pipeline";

function statRow(
  playerId: PlayerId,
  teamId: TeamId,
  points: number,
): GamePlayerStats {
  const made = Math.floor(points / 2);
  return {
    playerId,
    teamId,
    firstName: null,
    lastName: null,
    minutes: 30,
    points: made * 2,
    rebounds: 5,
    offensiveRebounds: 1,
    defensiveRebounds: 4,
    assists: 3,
    steals: 2,
    blocks: 1,
    turnovers: 2,
    fouls: 2,
    fieldGoalsMade: made,
    fieldGoalsAttempted: made + 5,
    threePointersMade: 0,
    threePointersAttempted: 2,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    touches: 10,
    started: true,
  };
}

/**
 * One season with a game of every competition type. Player scores 20 in
 * regular season, 30 in playoffs, and big numbers in games that must not
 * count (preseason 50, tournament 60).
 */
function buildMixedSeason() {
  let state = createInitialGameState({
    saveId: "pstat",
    rngSeed: 7,
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  const teamIds = Object.keys(state.world.teams);
  const homeTeamId = asTeamId(teamIds[0]!);
  const awayTeamId = asTeamId(teamIds[1]!);
  const player = Object.values(state.world.players).find(
    (p) => p.teamId === homeTeamId,
  )!;
  const opponent = Object.values(state.world.players).find(
    (p) => p.teamId === awayTeamId,
  )!;

  const entries: Array<[GameCompetitionType, number]> = [
    ["preseason", 50],
    ["regular_season", 20],
    ["midseason_tournament", 60],
    ["playoffs", 30],
  ];
  const games = entries.map(([competitionType, points], index) => {
    const playerRow = statRow(player.id, homeTeamId, points);
    const opponentRow = statRow(opponent.id, awayTeamId, 10);
    return createGame({
      id: asGameId(`game_pstat_${index}`),
      seasonId: state.competition.season.id,
      date: `2026-0${index + 1}-15`,
      homeTeamId,
      awayTeamId,
      competitionType,
      status: "final",
      score: { home: playerRow.points, away: opponentRow.points },
      periodScores: [{ home: playerRow.points, away: opponentRow.points }],
      events: [],
      playerStats: [playerRow, opponentRow],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
  });

  state = {
    ...state,
    competition: {
      ...state.competition,
      games: Object.fromEntries(games.map((game) => [game.id, game])),
    },
  } satisfies GameState;

  return { state, player, games };
}

describe("player stat consistency across consumers", () => {
  it("profile, player card and season snapshot count the same games", () => {
    const { state, player } = buildMixedSeason();

    const season = aggregatePlayerSeasonStats(state, player.id);
    expect(season.regular.games).toBe(1);
    expect(season.playoffs.games).toBe(1);
    expect(season.combined.points).toBe(50);

    const detail = toPlayerDetailView(state, player.id)!;
    const profile = toPlayerProfileView(state, player.id, detail);
    expect(profile.seasonAverages?.games).toBe(2);
    expect(profile.seasonAverages?.ppg).toBe(25);
    expect(profile.seasonAverages?.spg).toBe(2);
    expect(profile.seasonAverages?.bpg).toBe(1);

    const card = toPlayerDrawerView(state, player.id, "pstat")!;
    expect(card.performance.games).toBe(2);
    expect(card.performance.ppg).toBe(25);

    const snapshot =
      appendAllPlayerSeasonRecords(state).state.business.playerHistory[
        player.id
      ]!.seasons[0]!;
    expect(snapshot.competition.combined.games).toBe(2);
    expect(snapshot.competition.combined.points).toBe(50);
    expect(snapshot.competition.combined.steals).toBe(4);
    expect(snapshot.competition.combined.blocks).toBe(2);
  });

  it("keeps the saved season snapshot shape unchanged", () => {
    const { state, player } = buildMixedSeason();
    const snapshot =
      appendAllPlayerSeasonRecords(state).state.business.playerHistory[
        player.id
      ]!.seasons[0]!;
    for (const line of Object.values(snapshot.competition)) {
      expect(Object.keys(line)).toHaveLength(14);
      expect(line).not.toHaveProperty("gamesStarted");
    }
  });

  it("career highs, recent form and team stints ignore uncounted games", () => {
    const { state, player } = buildMixedSeason();

    const pointsHigh = deriveCareerHighs(state, player.id).find(
      (high) => high.stat === "points",
    );
    expect(pointsHigh?.value).toBe(30);

    const stints = derivePlayerTeamStints(state, player.id);
    expect(stints.reduce((sum, stint) => sum + stint.games, 0)).toBe(2);

    const detail = toPlayerDetailView(state, player.id)!;
    const profile = toPlayerProfileView(state, player.id, detail);
    expect(profile.recentForm.last5?.games).toBe(2);
    expect(profile.recentForm.last5?.points).toBe(50);
  });

  it("still lists every game in the game log", () => {
    const { state, player } = buildMixedSeason();
    const detail = toPlayerDetailView(state, player.id)!;
    const profile = toPlayerProfileView(state, player.id, detail);
    expect(profile.gameLog).toHaveLength(4);
  });
});

describe("box-score validation", () => {
  it("rejects negative steals and blocks", () => {
    const { games } = buildMixedSeason();
    const game = games[1]!;
    const corrupted = {
      ...game,
      playerStats: game.playerStats.map((row, index) =>
        index === 0 ? { ...row, steals: -1, blocks: -2 } : row,
      ),
    };
    const details = validateCompletedGameBoxScore(corrupted).map(
      (failure) => failure.detail,
    );
    expect(details.some((detail) => detail.includes("steals=-1"))).toBe(true);
    expect(details.some((detail) => detail.includes("blocks=-2"))).toBe(true);
  });
});
