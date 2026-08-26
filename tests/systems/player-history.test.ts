import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { createSeededRng } from "@/domain/rng";
import {
  asGameId,
  asPlayerId,
  asTeamId,
} from "@/domain/ids";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  getAllAvailableGames,
  getPlayerGames,
  getPlayerSeasonGames,
} from "@/state/game-access";
import {
  deriveCareerHighs,
  derivePlayerTeamStints,
  toPlayerProfileView,
} from "@/state/player-profile-selectors";
import { toPlayerDetailView } from "@/state/selectors";
import {
  appendAllPlayerSeasonRecords,
  archiveCompletedSeasonGames,
} from "@/systems/player-history";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  processOffseasonLifecycle,
} from "@/systems/simulation/offseason-lifecycle";
import { advanceOffseasonStage } from "@/systems/simulation/offseason-lifecycle";
import { completeDraft } from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";
import { transitionPhase } from "@/systems/simulation/phase-machine";

function emptyPlayerStats(
  playerId: ReturnType<typeof asPlayerId>,
  teamId: ReturnType<typeof asTeamId>,
  firstName: string,
  lastName: string,
  points: number,
) {
  return {
    playerId,
    teamId,
    firstName,
    lastName,
    minutes: 30,
    points,
    rebounds: 5,
    offensiveRebounds: 1,
    defensiveRebounds: 4,
    assists: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
    fieldGoalsMade: Math.floor(points / 2),
    fieldGoalsAttempted: Math.floor(points / 2) + 5,
    threePointersMade: 1,
    threePointersAttempted: 3,
    freeThrowsMade: points % 2,
    freeThrowsAttempted: 2,
    touches: 10,
  };
}

describe("player history archival", () => {
  function enterFinalizationWithGame() {
    let state = createInitialGameState({
      saveId: "phist",
      rngSeed: 42,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = transitionPhase(state, "regular").state;
    state = transitionPhase(state, "postseason").state;
    state = transitionPhase(state, "offseason").state;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          offseasonStage: "season_finalization",
        },
      },
    };

    const teamIds = Object.keys(state.world.teams);
    const homeTeamId = asTeamId(teamIds[0]!);
    const awayTeamId = asTeamId(teamIds[1]!);
    const homePlayer = Object.values(state.world.players).find(
      (p) => p.teamId === homeTeamId,
    )!;
    const awayPlayer = Object.values(state.world.players).find(
      (p) => p.teamId === awayTeamId,
    )!;
    const game = createGame({
      id: asGameId("game_phist_1"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "final",
      score: { home: 100, away: 90 },
      periodScores: [{ home: 100, away: 90 }],
      events: [],
      playerStats: [
        emptyPlayerStats(
          homePlayer.id,
          homeTeamId,
          homePlayer.firstName,
          homePlayer.lastName,
          28,
        ),
        emptyPlayerStats(
          awayPlayer.id,
          awayTeamId,
          awayPlayer.firstName,
          awayPlayer.lastName,
          22,
        ),
      ],
      homeTeamSnapshot: {
        teamId: homeTeamId,
        city: "Home",
        name: "Club",
        abbreviation: "HOM",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
      awayTeamSnapshot: {
        teamId: awayTeamId,
        city: "Away",
        name: "Side",
        abbreviation: "AWY",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
    });

    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { [game.id]: game },
        schedule: {
          seasonId: state.competition.season.id,
          gameIds: [game.id],
        },
      },
    };

    return { state, rng, game, homePlayer, awayPlayer, homeTeamId, awayTeamId };
  }

  it("archives finalized games before initializeNewSeason wipes competition.games", () => {
    const { state, rng, game } = enterFinalizationWithGame();
    let current = processOffseasonLifecycle(state, rng).state;
    expect(current.business.gameArchive[game.id]).toBeDefined();
    expect(current.competition.games[game.id]).toBeDefined();

    current = advanceOffseasonStage(current).state;
    current = processOffseasonLifecycle(current, rng).state;
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    current = completeDraft(current, draftClassId).state;
    current = processOffseasonLifecycle(current, rng).state;

    expect(Object.keys(current.competition.games)).toHaveLength(0);
    expect(current.business.gameArchive[game.id]).toBeDefined();
    expect(current.business.gameArchive[game.id]!.playerStats[0]!.points).toBe(
      28,
    );
  });

  it("is idempotent: double finalization does not duplicate archive or season records", () => {
    const { state, rng, game, homePlayer } = enterFinalizationWithGame();
    const once = processOffseasonLifecycle(state, rng).state;
    expect(Object.keys(once.business.gameArchive)).toContain(game.id);
    const seasonCount =
      once.business.playerHistory[homePlayer.id]?.seasons.length ?? 0;
    expect(seasonCount).toBe(1);

    const reentered = {
      ...once,
      competition: {
        ...once.competition,
        season: {
          ...once.competition.season,
          offseasonStage: "season_finalization" as const,
        },
      },
    };
    const twice = processOffseasonLifecycle(reentered, rng).state;
    expect(Object.keys(twice.business.gameArchive)).toHaveLength(
      Object.keys(once.business.gameArchive).length,
    );
    expect(twice.business.playerHistory[homePlayer.id]?.seasons).toHaveLength(1);
    expect(JSON.stringify(twice.business.gameArchive)).toBe(
      JSON.stringify(once.business.gameArchive),
    );
  });

  it("archives zero-GP rostered players with season snapshots", () => {
    const { state, rng, homeTeamId } = enterFinalizationWithGame();
    const bench = Object.values(state.world.players).find(
      (p) =>
        p.teamId === homeTeamId &&
        !state.competition.games["game_phist_1"]?.playerStats.some(
          (row) => row.playerId === p.id,
        ),
    );
    expect(bench).toBeDefined();

    const result = processOffseasonLifecycle(state, rng).state;
    const record = result.business.playerHistory[bench!.id]?.seasons[0];
    expect(record).toBeDefined();
    expect(record!.competition.combined.games).toBe(0);
    expect(record!.age).toBe(bench!.age);
    expect(record!.overall).toBeGreaterThan(0);
  });

  it("produces identical player history for the same finalized season (determinism)", () => {
    const a = enterFinalizationWithGame();
    const b = enterFinalizationWithGame();
    const resultA = archiveCompletedSeasonGames(a.state);
    const withPlayersA = appendAllPlayerSeasonRecords(resultA.state);
    const resultB = archiveCompletedSeasonGames(b.state);
    const withPlayersB = appendAllPlayerSeasonRecords(resultB.state);
    expect(JSON.stringify(withPlayersA.state.business.gameArchive)).toBe(
      JSON.stringify(withPlayersB.state.business.gameArchive),
    );
    expect(JSON.stringify(withPlayersA.state.business.playerHistory)).toBe(
      JSON.stringify(withPlayersB.state.business.playerHistory),
    );
  });

  it("derives mid-season trade stints from game archive", () => {
    const { state, homePlayer, homeTeamId, awayTeamId } =
      enterFinalizationWithGame();
    const seasonId = state.competition.season.id;
    const game2 = createGame({
      id: asGameId("game_phist_trade"),
      seasonId,
      date: "2026-02-01",
      homeTeamId: awayTeamId,
      awayTeamId: homeTeamId,
      competitionType: "regular_season",
      status: "final",
      score: { home: 95, away: 90 },
      periodScores: [{ home: 95, away: 90 }],
      events: [],
      playerStats: [
        emptyPlayerStats(
          homePlayer.id,
          awayTeamId,
          homePlayer.firstName,
          homePlayer.lastName,
          18,
        ),
        emptyPlayerStats(
          asPlayerId("filler_away"),
          homeTeamId,
          "Fill",
          "Er",
          10,
        ),
      ],
      homeTeamSnapshot: {
        teamId: awayTeamId,
        city: "Away",
        name: "Side",
        abbreviation: "AWY",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
      awayTeamSnapshot: {
        teamId: homeTeamId,
        city: "Home",
        name: "Club",
        abbreviation: "HOM",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
    });

    // filler player must exist for createGame validation? createGame doesn't check world.
    // But getPlayerGames only cares about playerStats rows.
    // Second player in game2 is fake - createGame allows it.

    let withTrade = {
      ...state,
      competition: {
        ...state.competition,
        games: {
          ...state.competition.games,
          [game2.id]: game2,
        },
      },
    };
    withTrade = archiveCompletedSeasonGames(withTrade).state;

    const stints = derivePlayerTeamStints(withTrade, homePlayer.id);
    const teamIds = new Set(stints.map((s) => s.teamId));
    expect(teamIds.has(homeTeamId)).toBe(true);
    expect(teamIds.has(awayTeamId)).toBe(true);
    expect(stints.reduce((sum, s) => sum + s.games, 0)).toBe(2);
  });
});

describe("game access helpers", () => {
  it("dedupes current and archived games with archive winning", () => {
    let state = createInitialGameState({
      saveId: "gaccess",
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

    const currentGame = createGame({
      id: asGameId("game_dup"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "final",
      score: { home: 100, away: 90 },
      periodScores: [{ home: 100, away: 90 }],
      events: [],
      playerStats: [
        emptyPlayerStats(player.id, homeTeamId, "A", "B", 10),
        emptyPlayerStats(
          Object.values(state.world.players).find((p) => p.teamId === awayTeamId)!
            .id,
          awayTeamId,
          "C",
          "D",
          9,
        ),
      ],
      homeTeamSnapshot: {
        teamId: homeTeamId,
        city: "H",
        name: "T",
        abbreviation: "HOM",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
      awayTeamSnapshot: {
        teamId: awayTeamId,
        city: "A",
        name: "T",
        abbreviation: "AWY",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
    });

    const archived = {
      ...currentGame,
      score: { home: 111, away: 90 },
    };

    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { [currentGame.id]: currentGame },
      },
      business: {
        ...state.business,
        gameArchive: { [archived.id]: archived },
      },
    };

    const all = getAllAvailableGames(state);
    expect(all).toHaveLength(1);
    expect(all[0]!.score.home).toBe(111);

    expect(getPlayerGames(state, player.id)).toHaveLength(1);
    expect(
      getPlayerSeasonGames(state, player.id, state.competition.season.id),
    ).toHaveLength(1);
  });
});

describe("player profile selectors", () => {
  it("builds profile with career highs and empty history messaging fields", () => {
    let state = createInitialGameState({
      saveId: "pprof",
      rngSeed: 11,
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

    const game = createGame({
      id: asGameId("game_prof"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "final",
      score: { home: 110, away: 100 },
      periodScores: [{ home: 110, away: 100 }],
      events: [],
      playerStats: [
        emptyPlayerStats(player.id, homeTeamId, player.firstName, player.lastName, 42),
        emptyPlayerStats(
          opponent.id,
          awayTeamId,
          opponent.firstName,
          opponent.lastName,
          20,
        ),
      ],
      homeTeamSnapshot: {
        teamId: homeTeamId,
        city: "Home",
        name: "Club",
        abbreviation: "HOM",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
      awayTeamSnapshot: {
        teamId: awayTeamId,
        city: "Away",
        name: "Side",
        abbreviation: "AWY",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
    });

    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { [game.id]: game },
      },
    };

    const detail = toPlayerDetailView(state, player.id)!;
    const profile = toPlayerProfileView(state, player.id, detail);
    expect(profile.seasonAverages?.ppg).toBe(42);
    expect(profile.strengths.length + profile.weaknesses.length).toBeGreaterThan(0);
    expect(profile.gameLog).toHaveLength(1);
    expect(profile.trackingStartedSeasonYear).toBeNull();

    const highs = deriveCareerHighs(state, player.id);
    const pointsHigh = highs.find((h) => h.stat === "points");
    expect(pointsHigh?.value).toBe(42);
    expect(pointsHigh?.gameId).toBe(game.id);
  });
});
