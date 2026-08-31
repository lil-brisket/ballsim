import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createGame } from "@/domain/entities/game";
import { createSeededRng } from "@/domain/rng";
import {
  asGameId,
  asSeasonId,
  asTeamId,
} from "@/domain/ids";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("v34 → v35 migration", () => {
  function bootstrappedState(saveId: string) {
    let state = createTestGameState({ saveId });
    const rng = createSeededRng(state.meta.rngState);
    return bootstrapWorld(state, rng).state;
  }

  it("adds competitionType and null identity fields without using current roster", () => {
    const modern = bootstrappedState("mig_v35");
    const teamIds = Object.keys(modern.world.teams);
    const homeTeamId = asTeamId(teamIds[0]!);
    const awayTeamId = asTeamId(teamIds[1]!);
    const homePlayer = Object.values(modern.world.players).find(
      (p) => p.teamId === homeTeamId,
    )!;
    const awayPlayer = Object.values(modern.world.players).find(
      (p) => p.teamId === awayTeamId,
    )!;

    const game = createGame({
      id: asGameId("game_legacy_1"),
      seasonId: modern.competition.season.id,
      date: modern.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "final",
      score: { home: 100, away: 98 },
      periodScores: [{ home: 100, away: 98 }],
      events: [],
      playerStats: [
        {
          playerId: homePlayer.id,
          teamId: homeTeamId,
          firstName: "Snap",
          lastName: "Shot",
          minutes: 30,
          points: 100,
          rebounds: 0,
          offensiveRebounds: 0,
          defensiveRebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          fieldGoalsMade: 40,
          fieldGoalsAttempted: 80,
          threePointersMade: 10,
          threePointersAttempted: 30,
          freeThrowsMade: 10,
          freeThrowsAttempted: 12,
          touches: 0,
        started: false,
        },
        {
          playerId: awayPlayer.id,
          teamId: awayTeamId,
          firstName: "Away",
          lastName: "Ace",
          minutes: 30,
          points: 98,
          rebounds: 0,
          offensiveRebounds: 0,
          defensiveRebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          fieldGoalsMade: 39,
          fieldGoalsAttempted: 80,
          threePointersMade: 10,
          threePointersAttempted: 30,
          freeThrowsMade: 10,
          freeThrowsAttempted: 12,
          touches: 0,
        started: false,
        },
      ],
      homeTeamSnapshot: {
        teamId: homeTeamId,
        city: "Old City",
        name: "Old Name",
        abbreviation: "OLD",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
      awayTeamSnapshot: {
        teamId: awayTeamId,
        city: "Other",
        name: "Side",
        abbreviation: "OTH",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
      },
    });

    const withGame = {
      ...modern,
      competition: {
        ...modern.competition,
        games: { [game.id]: game },
        schedule: {
          seasonId: modern.competition.season.id,
          gameIds: [game.id],
        },
      },
    };

    const parsed = JSON.parse(serializeGameState(withGame)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 34;

    const competition = parsed.competition as {
      games: Record<string, Record<string, unknown>>;
    };
    const legacyGame = competition.games[game.id]!;
    delete legacyGame.competitionType;
    delete legacyGame.homeTeamSnapshot;
    delete legacyGame.awayTeamSnapshot;
    legacyGame.playerStats = (
      legacyGame.playerStats as Array<Record<string, unknown>>
    ).map((row) => {
      const next = { ...row };
      delete next.teamId;
      delete next.firstName;
      delete next.lastName;
      return next;
    });

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(57);

    const migrated = loaded.competition.games[game.id]!;
    expect(migrated.competitionType).toBe("regular_season");
    expect(migrated.homeTeamSnapshot).toBeNull();
    expect(migrated.awayTeamSnapshot).toBeNull();
    expect(migrated.playerStats[0]!.teamId).toBeNull();
    expect(migrated.playerStats[0]!.firstName).toBeNull();
    expect(migrated.playerStats[0]!.lastName).toBeNull();
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("infers playoffs competitionType from playoff_ id prefix", () => {
    const modern = bootstrappedState("mig_v35_po");
    const teamIds = Object.keys(modern.world.teams);
    const gameId = asGameId(
      `playoff_${modern.competition.season.id}_g0`,
    );
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 34;
    const competition = parsed.competition as {
      games: Record<string, unknown>;
      season: { id: string };
    };
    competition.games[gameId] = {
      id: gameId,
      seasonId: competition.season.id,
      date: modern.world.calendar.currentDate,
      homeTeamId: teamIds[0],
      awayTeamId: teamIds[1],
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
    };

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.competition.games[gameId]!.competitionType).toBe(
      "playoffs",
    );
  });
});
