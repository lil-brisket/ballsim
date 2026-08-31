import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import {
  asGameId,
  asSeasonId,
  asTeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createTestGameState } from "../factories/game-state";
import {
  canOpenGameBoxScore,
  toGameBoxScoreView,
} from "@/state/selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("game box score selectors", () => {
  it("opens finalized current-season games only", () => {
    let state = createTestGameState({ saveId: "box_sel" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
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
      id: asGameId("game_box_sel"),
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
        {
          playerId: homePlayer.id,
          teamId: homeTeamId,
          firstName: homePlayer.firstName,
          lastName: homePlayer.lastName,
          minutes: 34,
          points: 110,
          rebounds: 10,
          offensiveRebounds: 3,
          defensiveRebounds: 7,
          assists: 5,
          steals: 0,
          blocks: 0,
          turnovers: 2,
          fouls: 3,
          fieldGoalsMade: 40,
          fieldGoalsAttempted: 80,
          threePointersMade: 10,
          threePointersAttempted: 30,
          freeThrowsMade: 20,
          freeThrowsAttempted: 24,
          touches: 0,
        started: false,
        },
        {
          playerId: awayPlayer.id,
          teamId: awayTeamId,
          firstName: awayPlayer.firstName,
          lastName: awayPlayer.lastName,
          minutes: 33,
          points: 100,
          rebounds: 8,
          offensiveRebounds: 2,
          defensiveRebounds: 6,
          assists: 4,
          steals: 0,
          blocks: 0,
          turnovers: 3,
          fouls: 4,
          fieldGoalsMade: 38,
          fieldGoalsAttempted: 82,
          threePointersMade: 8,
          threePointersAttempted: 28,
          freeThrowsMade: 16,
          freeThrowsAttempted: 20,
          touches: 0,
        started: false,
        },
      ],
      homeTeamSnapshot: {
        teamId: homeTeamId,
        city: "SnapCity",
        name: "Snappers",
        abbreviation: "SNP",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
      awayTeamSnapshot: {
        teamId: awayTeamId,
        city: "Visit",
        name: "Visitors",
        abbreviation: "VIS",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
    });

    const withGame = {
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

    expect(canOpenGameBoxScore(withGame, game.id)).toBe(true);
    const view = toGameBoxScoreView(withGame, game.id);
    expect(view).not.toBeNull();
    expect(view!.home.city).toBe("SnapCity");
    expect(view!.away.abbreviation).toBe("VIS");
    expect(view!.home.players[0]!.playerName).toBe(
      `${homePlayer.firstName} ${homePlayer.lastName}`,
    );
    expect(view!.winner).toBe("home");
    expect(view!.margin).toBe(10);
    expect(view!.seasonGameNumber).toBe(1);
    expect(view!.competitionTypeLabel).toBe("Regular Season");

    const wrongSeason = {
      ...withGame,
      competition: {
        ...withGame.competition,
        season: {
          ...withGame.competition.season,
          id: asSeasonId("season_other"),
        },
      },
    };
    expect(canOpenGameBoxScore(wrongSeason, game.id)).toBe(false);
    expect(toGameBoxScoreView(wrongSeason, game.id)).toBeNull();
  });

  it("does not open scheduled games", () => {
    let state = createTestGameState({ saveId: "box_sched" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams);
    const game = createGame({
      id: asGameId("game_upcoming"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId: asTeamId(teamIds[0]!),
      awayTeamId: asTeamId(teamIds[1]!),
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    const withGame = {
      ...state,
      competition: {
        ...state.competition,
        games: { [game.id]: game },
      },
    };
    expect(canOpenGameBoxScore(withGame, game.id)).toBe(false);
    expect(toGameBoxScoreView(withGame, game.id)).toBeNull();
  });
});
