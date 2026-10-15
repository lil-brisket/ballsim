import { describe, expect, it } from "vitest";
import {
  createGame,
  type Game,
  type GameCompetitionType,
  type GamePlayerStats,
} from "@/domain/entities/game";
import { createEmptyPlayerSeasonStatLine } from "@/domain/entities/player-history";
import { createSeededRng } from "@/domain/rng";
import {
  asGameId,
  asSeasonId,
  asTeamId,
  type PlayerId,
  type SeasonId,
  type TeamId,
} from "@/domain/ids";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { getPlayerFinalGames } from "@/state/game-access";
import type { GameState } from "@/state/game-state";
import { toPlayerProfileView } from "@/state/player-profile-selectors";
import { toPlayerDetailView } from "@/state/selectors";
import {
  appendAllPlayerSeasonRecords,
  archiveCompletedSeasonGames,
} from "@/systems/player-history";
import { bootstrapWorld } from "@/systems/world-pipeline";

function statRow(
  playerId: PlayerId,
  teamId: TeamId,
  overrides: Partial<GamePlayerStats> = {},
): GamePlayerStats {
  return {
    playerId,
    teamId,
    firstName: null,
    lastName: null,
    minutes: 30,
    points: 10,
    rebounds: 5,
    offensiveRebounds: 1,
    defensiveRebounds: 4,
    assists: 3,
    steals: 1,
    blocks: 1,
    turnovers: 2,
    fouls: 2,
    fieldGoalsMade: 5,
    fieldGoalsAttempted: 10,
    threePointersMade: 0,
    threePointersAttempted: 1,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    touches: 10,
    started: true,
    ...overrides,
  };
}

function setup() {
  let state = createInitialGameState({
    saveId: "pcareer",
    rngSeed: 3,
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  const teamIds = Object.keys(state.world.teams).map(asTeamId);
  const player = Object.values(state.world.players).find(
    (p) => p.teamId === teamIds[0],
  )!;
  const opponent = Object.values(state.world.players).find(
    (p) => p.teamId === teamIds[1],
  )!;
  const currentSeasonId = state.competition.season.id;
  const previousSeasonId = asSeasonId(
    `season_${state.competition.season.year - 1}`,
  );

  let counter = 0;
  function game(input: {
    seasonId: SeasonId;
    teamId: TeamId;
    opponentTeamId: TeamId;
    points: number;
    fieldGoalsMade?: number;
    fieldGoalsAttempted?: number;
    competitionType?: GameCompetitionType;
  }): Game {
    counter += 1;
    const made = input.fieldGoalsMade ?? input.points / 2;
    const playerRow = statRow(player.id, input.teamId, {
      points: input.points,
      fieldGoalsMade: made,
      fieldGoalsAttempted: input.fieldGoalsAttempted ?? made * 2,
    });
    const opponentRow = statRow(opponent.id, input.opponentTeamId, {
      points: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 3,
    });
    return createGame({
      id: asGameId(`game_pcareer_${counter}`),
      seasonId: input.seasonId,
      date: `2026-02-${String(counter).padStart(2, "0")}`,
      homeTeamId: input.teamId,
      awayTeamId: input.opponentTeamId,
      competitionType: input.competitionType ?? "regular_season",
      status: "final",
      score: { home: input.points, away: 0 },
      periodScores: [{ home: input.points, away: 0 }],
      events: [],
      playerStats: [playerRow, opponentRow],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
  }

  function withGames(
    base: GameState,
    archived: Game[],
    current: Game[],
  ): GameState {
    const withCurrent: GameState = {
      ...base,
      competition: {
        ...base.competition,
        games: Object.fromEntries(archived.map((g) => [g.id, g])),
      },
    };
    // Route archived games through the real archiver so the index is built.
    const archivedState = archiveCompletedSeasonGames(withCurrent).state;
    return {
      ...archivedState,
      competition: {
        ...archivedState.competition,
        games: Object.fromEntries(current.map((g) => [g.id, g])),
      },
    };
  }

  function profile(target: GameState) {
    const detail = toPlayerDetailView(target, player.id)!;
    return toPlayerProfileView(target, player.id, detail);
  }

  return {
    state,
    player,
    teamIds,
    currentSeasonId,
    previousSeasonId,
    game,
    withGames,
    profile,
  };
}

describe("career stats from box scores", () => {
  it("sums seasons across a team change without double counting", () => {
    const ctx = setup();
    const [teamA, teamB, teamC] = ctx.teamIds;
    const lastSeason = [
      ctx.game({
        seasonId: ctx.previousSeasonId,
        teamId: teamC!,
        opponentTeamId: teamB!,
        points: 40,
      }),
    ];
    const thisSeason = [10, 10, 10].map((points) =>
      ctx.game({
        seasonId: ctx.currentSeasonId,
        teamId: teamA!,
        opponentTeamId: teamB!,
        points,
      }),
    );
    const state = ctx.withGames(ctx.state, lastSeason, thisSeason);
    const view = ctx.profile(state);

    expect(view.seasonLines.map((s) => s.combined.games)).toEqual([1, 3]);
    expect(view.seasonLines.every((s) => s.source === "games")).toBe(true);
    expect(view.seasonLines.at(-1)?.current).toBe(true);
    expect(view.career.combined.games).toBe(4);
    expect(view.career.combined.points).toBe(70);
    // 70 / 4, not the 25.0 average of the two season averages.
    expect(view.careerAverages?.ppg).toBe(17.5);
    expect(view.career.extendedColumnsComplete).toBe(true);
    expect(view.teamStints.map((stint) => stint.teamId).sort()).toEqual(
      [teamA, teamC].sort(),
    );
  });

  it("computes career shooting from total makes over total attempts", () => {
    const ctx = setup();
    const [teamA, teamB] = ctx.teamIds;
    const games = [
      ctx.game({
        seasonId: ctx.previousSeasonId,
        teamId: teamA!,
        opponentTeamId: teamB!,
        points: 2,
        fieldGoalsMade: 1,
        fieldGoalsAttempted: 1,
      }),
      ctx.game({
        seasonId: ctx.currentSeasonId,
        teamId: teamA!,
        opponentTeamId: teamB!,
        points: 2,
        fieldGoalsMade: 1,
        fieldGoalsAttempted: 9,
      }),
    ];
    const view = ctx.profile(
      ctx.withGames(ctx.state, [games[0]!], [games[1]!]),
    );
    // 2 / 10 = 20%, not the 55.6% mean of 100% and 11.1%.
    expect(view.careerAverages?.fgPct).toBe(20);
  });

  it("keeps regular season and playoffs separate", () => {
    const ctx = setup();
    const [teamA, teamB] = ctx.teamIds;
    const games = [
      ctx.game({
        seasonId: ctx.currentSeasonId,
        teamId: teamA!,
        opponentTeamId: teamB!,
        points: 10,
      }),
      ctx.game({
        seasonId: ctx.currentSeasonId,
        teamId: teamA!,
        opponentTeamId: teamB!,
        points: 30,
        competitionType: "playoffs",
      }),
    ];
    const view = ctx.profile(ctx.withGames(ctx.state, [], games));
    expect(view.career.regular.points).toBe(10);
    expect(view.career.playoffs.points).toBe(30);
    expect(view.career.combined.points).toBe(40);
  });

  it("falls back to the snapshot for a season with no archived games", () => {
    const ctx = setup();
    const [teamA, teamB] = ctx.teamIds;
    const legacyLine = {
      ...createEmptyPlayerSeasonStatLine(),
      games: 10,
      points: 200,
    };
    const base = ctx.withGames(
      ctx.state,
      [],
      [
        ctx.game({
          seasonId: ctx.currentSeasonId,
          teamId: teamA!,
          opponentTeamId: teamB!,
          points: 20,
        }),
      ],
    );
    const state: GameState = {
      ...base,
      business: {
        ...base.business,
        playerHistory: {
          [ctx.player.id]: {
            playerId: ctx.player.id,
            trackingStartedSeasonYear: 2000,
            seasons: [
              {
                seasonId: asSeasonId("season_2000"),
                seasonYear: 2000,
                age: 22,
                overall: 61,
                attributes: { ...ctx.player.attributes },
                developmentStage: ctx.player.development.stage,
                injuryKind: "available",
                contractSnapshot: {
                  contractId: null,
                  salary: null,
                  teamId: null,
                },
                competition: {
                  regular: legacyLine,
                  playoffs: createEmptyPlayerSeasonStatLine(),
                  development: createEmptyPlayerSeasonStatLine(),
                  combined: legacyLine,
                },
              },
            ],
          },
        },
      },
    };

    const view = ctx.profile(state);
    const legacy = view.seasonLines[0]!;
    expect(legacy.source).toBe("snapshot");
    expect(legacy.age).toBe(22);
    expect(legacy.overall).toBe(61);
    expect(legacy.combined.gamesStarted).toBe(0);
    expect(view.career.combined.games).toBe(11);
    expect(view.career.combined.points).toBe(220);
    expect(view.career.extendedColumnsComplete).toBe(false);
  });

  it("leaves career unchanged across a new-season rollover", () => {
    const ctx = setup();
    const [teamA, teamB] = ctx.teamIds;
    const games = [12, 18, 24].map((points) =>
      ctx.game({
        seasonId: ctx.currentSeasonId,
        teamId: teamA!,
        opponentTeamId: teamB!,
        points,
      }),
    );
    const before = ctx.withGames(ctx.state, [], games);
    const careerBefore = ctx.profile(before).career;

    // Season end: archive, snapshot, then wipe current games and advance.
    let after = archiveCompletedSeasonGames(before).state;
    after = appendAllPlayerSeasonRecords(after).state;
    after = {
      ...after,
      competition: {
        ...after.competition,
        games: {},
        season: {
          ...after.competition.season,
          id: asSeasonId(`season_${after.competition.season.year + 1}`),
          year: after.competition.season.year + 1,
        },
      },
    };
    const view = ctx.profile(after);

    expect(view.career).toEqual(careerBefore);
    expect(view.seasonLines).toHaveLength(1);
    expect(view.seasonLines[0]!.source).toBe("games");
    expect(view.seasonLines[0]!.current).toBe(false);
  });
});

describe("profile trends and lookups", () => {
  it("exposes SPG and BPG season trends", () => {
    const ctx = setup();
    const [teamA, teamB] = ctx.teamIds;
    const view = ctx.profile(
      ctx.withGames(
        ctx.state,
        [],
        [
          ctx.game({
            seasonId: ctx.currentSeasonId,
            teamId: teamA!,
            opponentTeamId: teamB!,
            points: 10,
          }),
        ],
      ),
    );
    expect(view.trendSeries.spg).toEqual([
      { season: ctx.state.competition.season.year, value: 1 },
    ]);
    expect(view.trendSeries.bpg).toEqual([
      { season: ctx.state.competition.season.year, value: 1 },
    ]);
  });

  it("dedupes games that are both archived and still current", () => {
    const ctx = setup();
    const [teamA, teamB] = ctx.teamIds;
    const g = ctx.game({
      seasonId: ctx.currentSeasonId,
      teamId: teamA!,
      opponentTeamId: teamB!,
      points: 10,
    });
    const state = ctx.withGames(ctx.state, [g], [g]);
    expect(getPlayerFinalGames(state, ctx.player.id)).toHaveLength(1);
    expect(ctx.profile(state).career.combined.games).toBe(1);
  });
});
