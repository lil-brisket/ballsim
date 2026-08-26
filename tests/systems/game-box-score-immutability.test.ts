import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import {
  asGameId,
  asTeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createTestGameState } from "../factories/game-state";
import { toGameBoxScoreView } from "@/state/selectors";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";

function seedFinalGame(state: GameState) {
  const teamIds = Object.keys(state.world.teams);
  const homeTeamId = asTeamId(teamIds[0]!);
  const awayTeamId = asTeamId(teamIds[1]!);
  const homeTeam = state.world.teams[homeTeamId]!;
  const awayTeam = state.world.teams[awayTeamId]!;
  const homePlayer = Object.values(state.world.players).find(
    (p) => p.teamId === homeTeamId,
  )!;
  const awayPlayer = Object.values(state.world.players).find(
    (p) => p.teamId === awayTeamId,
  )!;

  const game = createGame({
    id: asGameId("game_immut_1"),
    seasonId: state.competition.season.id,
    date: state.world.calendar.currentDate,
    homeTeamId,
    awayTeamId,
    competitionType: "regular_season",
    status: "final",
    score: { home: 112, away: 104 },
    periodScores: [{ home: 112, away: 104 }],
    events: [],
    playerStats: [
      {
        playerId: homePlayer.id,
        teamId: homeTeamId,
        firstName: homePlayer.firstName,
        lastName: homePlayer.lastName,
        minutes: 36,
        points: 112,
        rebounds: 12,
        offensiveRebounds: 4,
        defensiveRebounds: 8,
        assists: 8,
        steals: 0,
        blocks: 0,
        turnovers: 2,
        fouls: 2,
        fieldGoalsMade: 42,
        fieldGoalsAttempted: 88,
        threePointersMade: 12,
        threePointersAttempted: 36,
        freeThrowsMade: 16,
        freeThrowsAttempted: 20,
        touches: 0,
      },
      {
        playerId: awayPlayer.id,
        teamId: awayTeamId,
        firstName: awayPlayer.firstName,
        lastName: awayPlayer.lastName,
        minutes: 35,
        points: 104,
        rebounds: 10,
        offensiveRebounds: 3,
        defensiveRebounds: 7,
        assists: 6,
        steals: 0,
        blocks: 0,
        turnovers: 4,
        fouls: 3,
        fieldGoalsMade: 40,
        fieldGoalsAttempted: 90,
        threePointersMade: 10,
        threePointersAttempted: 34,
        freeThrowsMade: 14,
        freeThrowsAttempted: 18,
        touches: 0,
      },
    ],
    homeTeamSnapshot: {
      teamId: homeTeamId,
      city: homeTeam.city,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      branding: homeTeam.branding,
    },
    awayTeamSnapshot: {
      teamId: awayTeamId,
      city: awayTeam.city,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      branding: awayTeam.branding,
    },
  });

  const next: GameState = {
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

  return {
    state: next,
    gameId: game.id,
    homeTeamId,
    awayTeamId,
    homePlayerId: homePlayer.id,
    originalHomeCity: homeTeam.city,
    originalHomeName: homeTeam.name,
    originalHomePlayerName: `${homePlayer.firstName} ${homePlayer.lastName}`,
  };
}

function bootstrapped(saveId: string): GameState {
  const state = createTestGameState({ saveId });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

describe("game box score historical immutability", () => {
  it("preserves player team after trade across save/reload", () => {
    const seeded = seedFinalGame(bootstrapped("immut_trade"));
    const saved = deserializeGameState(serializeGameState(seeded.state));

    const tradedAwayId = Object.keys(saved.world.teams).find(
      (id) => id !== seeded.homeTeamId && id !== seeded.awayTeamId,
    )!;
    const player = saved.world.players[seeded.homePlayerId]!;
    const afterTrade: GameState = {
      ...saved,
      world: {
        ...saved.world,
        players: {
          ...saved.world.players,
          [seeded.homePlayerId]: {
            ...player,
            teamId: asTeamId(tradedAwayId),
            firstName: "Changed",
            lastName: "Name",
          },
        },
      },
    };

    const reloaded = deserializeGameState(serializeGameState(afterTrade));
    const view = toGameBoxScoreView(reloaded, seeded.gameId);
    expect(view).not.toBeNull();
    const homeRow = view!.home.players.find(
      (row) => row.playerId === seeded.homePlayerId,
    );
    expect(homeRow).toBeDefined();
    expect(homeRow!.playerName).toBe(seeded.originalHomePlayerName);
    expect(
      reloaded.competition.games[seeded.gameId]!.playerStats.find(
        (row) => row.playerId === seeded.homePlayerId,
      )!.teamId,
    ).toBe(seeded.homeTeamId);
  });

  it("preserves team identity after rename/relocate across save/reload", () => {
    const seeded = seedFinalGame(bootstrapped("immut_rename"));
    const saved = deserializeGameState(serializeGameState(seeded.state));
    const home = saved.world.teams[seeded.homeTeamId]!;
    const afterRename: GameState = {
      ...saved,
      world: {
        ...saved.world,
        teams: {
          ...saved.world.teams,
          [seeded.homeTeamId]: {
            ...home,
            city: "Las Vegas",
            name: "Aces",
            abbreviation: "LVA",
          },
        },
      },
    };

    const reloaded = deserializeGameState(serializeGameState(afterRename));
    const view = toGameBoxScoreView(reloaded, seeded.gameId);
    expect(view).not.toBeNull();
    expect(view!.home.city).toBe(seeded.originalHomeCity);
    expect(view!.home.name).toBe(seeded.originalHomeName);
    expect(reloaded.world.teams[seeded.homeTeamId]!.city).toBe("Las Vegas");
  });
});
