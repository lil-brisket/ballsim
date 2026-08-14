import { describe, expect, it } from "vitest";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";

const V4_ATTRIBUTE_KEYS = [
  "speed",
  "strength",
  "athleticism",
  "stamina",
  "finishing",
  "midRange",
  "threePoint",
  "freeThrow",
  "ballHandling",
  "passing",
  "perimeterDefense",
  "interiorDefense",
  "steal",
  "block",
  "rebounding",
  "basketballIq",
  "offensiveIq",
  "defensiveIq",
  "consistency",
] as const;

describe("GameState schema migration", () => {
  it("migrates schemaVersion 1 saves through to current schema version", () => {
    const modern = createInitialGameState({
      saveId: "save_migrate",
      rngSeed: 5,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const playerId = asPlayerId("player_legacy");
    const teamId = modern.user.controlledTeamId;
    const contractId = asContractId("contract_legacy");

    const v1Json = JSON.stringify({
      ...modern,
      meta: {
        saveId: modern.meta.saveId,
        schemaVersion: 1,
        createdAt: modern.meta.createdAt,
        updatedAt: modern.meta.updatedAt,
        rngSeed: modern.meta.rngSeed,
      },
      world: {
        ...modern.world,
        players: {
          [playerId]: {
            id: playerId,
            teamId,
            firstName: "Legacy",
            lastName: "Player",
            position: "SF",
            age: 27,
            ratings: { overall: 75, offense: 80, defense: 70 },
          },
        },
      },
      business: {
        ...modern.business,
        contracts: {
          [contractId]: {
            id: contractId,
            playerId,
            teamId,
            salaryPerYear: 1_000_000,
            yearsRemaining: 2,
          },
        },
      },
      competition: {
        ...modern.competition,
        games: {
          game_legacy: {
            id: "game_legacy",
            seasonId: modern.competition.season.id,
            date: "2026-10-02",
            homeTeamId: modern.user.controlledTeamId,
            awayTeamId: Object.keys(modern.world.teams).find(
              (id) => id !== modern.user.controlledTeamId,
            ),
            status: "scheduled",
            homeScore: null,
            awayScore: null,
          },
        },
      },
    });

    const migrated = deserializeGameState(v1Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.meta.rngState).toBe(5);
    expect(migrated.competition.games.game_legacy?.playerStats).toEqual([]);
    expect(migrated.competition.games.game_legacy?.score).toEqual({
      home: 0,
      away: 0,
    });
    expect(migrated.competition.games.game_legacy?.events).toEqual([]);
    expect(migrated.competition.games.game_legacy?.status).toBe("scheduled");
    expect(
      "homeScore" in (migrated.competition.games.game_legacy ?? {}),
    ).toBe(false);
    expect(
      "awayScore" in (migrated.competition.games.game_legacy ?? {}),
    ).toBe(false);
    expect(
      "boxScore" in (migrated.competition.games.game_legacy ?? {}),
    ).toBe(false);

    const player = migrated.world.players[playerId]!;
    expect(player.attributes.midRange).toBe(80);
    expect(player.attributes.threePoint).toBe(80);
    expect(player.attributes.freeThrow).toBe(80);
    expect(player.attributes.finishing).toBe(80);
    expect(player.attributes.perimeterDefense).toBe(70);
    expect(player.attributes.steal).toBe(70);
    expect(player.attributes.athleticism).toBe(75);
    expect(player.attributes.speed).toBe(75);
    expect(player.potential.overall).toBe(75);
    expect(player.heightInches).toBe(78);
    expect(player.weightPounds).toBe(215);
    expect(player.personality.workEthic).toBe(50);
    expect(player.injury).toEqual({ kind: "healthy" });
    expect(player.development).toEqual({ stage: "prime" });
    expect(player.contractId).toBe(contractId);
    expect("shooting" in player.attributes).toBe(false);
    expect(player.archetype).toBe("three_and_d_wing");
    expect(player.firstName).toBe("Legacy");
    expect(player.lastName).toBe("Player");
    expect(player.position).toBe("SF");
    expect(player.age).toBe(27);
    expect(player.nationality).toBe("USA");
    for (const migratedPlayer of Object.values(migrated.world.players)) {
      expect(migratedPlayer.nationality).toBe("USA");
    }
  });

  it("migrates schemaVersion 2 players to current schema deterministically", () => {
    const modern = createInitialGameState({
      saveId: "save_v2",
      rngSeed: 9,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const playerId = asPlayerId("player_v2");
    const teamId = asTeamId(String(modern.user.controlledTeamId));
    const contractId = asContractId("contract_v2");

    const v2Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 2,
      },
      world: {
        ...modern.world,
        players: {
          [playerId]: {
            id: playerId,
            teamId,
            firstName: "V2",
            lastName: "Star",
            position: "PG",
            age: 24,
            ratings: { overall: 72, offense: 78, defense: 66 },
          },
        },
      },
      business: {
        ...modern.business,
        contracts: {
          [contractId]: {
            id: contractId,
            playerId,
            teamId,
            salaryPerYear: 2_000_000,
            yearsRemaining: 3,
          },
        },
      },
    });

    const migrated = deserializeGameState(v2Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const player = migrated.world.players[playerId]!;
    expect(player.firstName).toBe("V2");
    expect(player.attributes).toEqual({
      speed: 72,
      strength: 72,
      athleticism: 72,
      stamina: 72,
      finishing: 78,
      midRange: 78,
      threePoint: 78,
      freeThrow: 78,
      ballHandling: 78,
      passing: 78,
      perimeterDefense: 66,
      interiorDefense: 66,
      steal: 66,
      block: 66,
      rebounding: 66,
      basketballIq: 72,
      offensiveIq: 72,
      defensiveIq: 72,
      consistency: 72,
    });
    expect(Object.keys(player.attributes).sort()).toEqual(
      [...V4_ATTRIBUTE_KEYS].sort(),
    );
    expect(player.potential.overall).toBe(72);
    expect(player.contractId).toBe(contractId);
    expect(player.injury.kind).toBe("healthy");
    expect(player.development.stage).toBe("prime");
    expect(player.archetype).toBe("floor_general");
    expect(player.nationality).toBe("USA");
  });

  it("migrates schemaVersion 3 players to current schema with distinguishable mappings", () => {
    const modern = createInitialGameState({
      saveId: "save_v3",
      rngSeed: 11,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const playerId = asPlayerId("player_v3");
    const teamId = modern.user.controlledTeamId;
    const contractId = asContractId("contract_v3");

    const v3Attributes = {
      shooting: 81,
      finishing: 62,
      passing: 55,
      ballHandling: 59,
      perimeterDefense: 54,
      interiorDefense: 47,
      rebounding: 43,
      athleticism: 73,
      basketballIq: 91,
    };

    const v3Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 3,
      },
      world: {
        ...modern.world,
        players: {
          [playerId]: {
            id: playerId,
            teamId,
            firstName: "V3",
            lastName: "Mapped",
            position: "SF",
            age: 26,
            heightInches: 78,
            weightPounds: 215,
            attributes: v3Attributes,
            potential: { overall: 88 },
            personality: {
              workEthic: 50,
              loyalty: 50,
              competitiveness: 50,
              leadership: 50,
              composure: 50,
            },
            contractId,
            injury: { kind: "healthy" },
            development: { stage: "prime" },
          },
        },
      },
    });

    const migrated = deserializeGameState(v3Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const player = migrated.world.players[playerId]!;
    expect(player.attributes.midRange).toBe(81);
    expect(player.attributes.threePoint).toBe(81);
    expect(player.attributes.freeThrow).toBe(81);
    expect(player.attributes.finishing).toBe(62);
    expect(player.attributes.passing).toBe(55);
    expect(player.attributes.ballHandling).toBe(59);
    expect(player.attributes.speed).toBe(73);
    expect(player.attributes.strength).toBe(73);
    expect(player.attributes.stamina).toBe(73);
    expect(player.attributes.athleticism).toBe(73);
    expect(player.attributes.perimeterDefense).toBe(54);
    expect(player.attributes.steal).toBe(54);
    expect(player.attributes.interiorDefense).toBe(47);
    expect(player.attributes.block).toBe(47);
    expect(player.attributes.rebounding).toBe(43);
    expect(player.attributes.basketballIq).toBe(91);
    expect(player.attributes.offensiveIq).toBe(91);
    expect(player.attributes.defensiveIq).toBe(91);
    expect(player.attributes.consistency).toBe(91);
    expect(Object.keys(player.attributes).sort()).toEqual(
      [...V4_ATTRIBUTE_KEYS].sort(),
    );
    expect("shooting" in player.attributes).toBe(false);
    expect(player.potential.overall).toBe(88);
    expect(player.personality.workEthic).toBe(50);
    expect(player.contractId).toBe(contractId);
    expect(player.archetype).toBe("three_and_d_wing");
    expect(player.nationality).toBe("USA");
  });

  it("migrates schemaVersion 4 players by adding deterministic archetype only", () => {
    const modern = createInitialGameState({
      saveId: "save_v4",
      rngSeed: 17,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const playerId = asPlayerId("player_v4");
    const teamId = modern.user.controlledTeamId;
    const contractId = asContractId("contract_v4");

    const attributes = Object.fromEntries(
      V4_ATTRIBUTE_KEYS.map((key, index) => [key, 60 + index]),
    );

    const v4Player = {
      id: playerId,
      teamId,
      firstName: "V4",
      lastName: "Holdover",
      position: "PF" as const,
      age: 28,
      heightInches: 81,
      weightPounds: 240,
      attributes,
      potential: { overall: 86 },
      personality: {
        workEthic: 61,
        loyalty: 52,
        competitiveness: 70,
        leadership: 48,
        composure: 55,
      },
      contractId,
      injury: { kind: "healthy" as const },
      development: { stage: "prime" as const },
    };

    const v4Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 4,
        rngState: 12345,
      },
      world: {
        ...modern.world,
        players: {
          [playerId]: v4Player,
        },
      },
    });

    const migrated = deserializeGameState(v4Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.meta.rngState).toBe(12345);

    const player = migrated.world.players[playerId]!;
    expect(player.archetype).toBe("two_way_forward");
    expect(player.attributes).toEqual(attributes);
    expect(player.potential).toEqual(v4Player.potential);
    expect(player.personality).toEqual(v4Player.personality);
    expect(player.injury).toEqual(v4Player.injury);
    expect(player.development).toEqual(v4Player.development);
    expect(player.firstName).toBe("V4");
    expect(player.position).toBe("PF");
    expect(player.heightInches).toBe(81);
    expect(player.weightPounds).toBe(240);
    expect(player.contractId).toBe(contractId);
    expect(player.nationality).toBe("USA");
  });

  it("migrates schemaVersion 5 players by adding deterministic USA nationality only", () => {
    const modern = createInitialGameState({
      saveId: "save_v5",
      rngSeed: 21,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const playerId = asPlayerId("player_v5");
    const teamId = modern.user.controlledTeamId;
    const contractId = asContractId("contract_v5");

    const attributes = Object.fromEntries(
      V4_ATTRIBUTE_KEYS.map((key, index) => [key, 55 + index]),
    );

    const v5Player = {
      id: playerId,
      teamId,
      firstName: "V5",
      lastName: "Holdover",
      position: "SG" as const,
      archetype: "scoring_guard" as const,
      age: 25,
      heightInches: 76,
      weightPounds: 205,
      attributes,
      potential: { overall: 84 },
      personality: {
        workEthic: 63,
        loyalty: 58,
        competitiveness: 71,
        leadership: 44,
        composure: 60,
      },
      contractId,
      injury: { kind: "healthy" as const },
      development: { stage: "developing" as const },
    };

    const v5Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 5,
        rngState: 98765,
      },
      world: {
        ...modern.world,
        players: {
          [playerId]: v5Player,
        },
      },
    });

    const migrated = deserializeGameState(v5Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.meta.rngState).toBe(98765);

    const player = migrated.world.players[playerId]!;
    expect(player.id).toBe(v5Player.id);
    expect(player.teamId).toBe(v5Player.teamId);
    expect(player.firstName).toBe("V5");
    expect(player.lastName).toBe("Holdover");
    expect(player.position).toBe("SG");
    expect(player.archetype).toBe("scoring_guard");
    expect(player.age).toBe(25);
    expect(player.heightInches).toBe(76);
    expect(player.weightPounds).toBe(205);
    expect(player.attributes).toEqual(attributes);
    expect(player.potential).toEqual(v5Player.potential);
    expect(player.personality).toEqual(v5Player.personality);
    expect(player.contractId).toBe(contractId);
    expect(player.injury).toEqual(v5Player.injury);
    expect(player.development).toEqual(v5Player.development);
    expect(player.nationality).toBe("USA");
    expect(Object.keys(player).sort()).toEqual(
      [...Object.keys(v5Player), "nationality"].sort(),
    );
  });

  it("sets contractId to null when zero or multiple contracts match", () => {
    const modern = createInitialGameState({
      saveId: "save_v2_multi",
      rngSeed: 3,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const playerId = asPlayerId("player_multi");
    const teamId = modern.user.controlledTeamId;

    const v2Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 2,
      },
      world: {
        ...modern.world,
        players: {
          [playerId]: {
            id: playerId,
            teamId,
            firstName: "Multi",
            lastName: "Contract",
            position: "C",
            age: 30,
            ratings: { overall: 70, offense: 70, defense: 70 },
          },
        },
      },
      business: {
        ...modern.business,
        contracts: {
          c1: {
            id: "c1",
            playerId,
            teamId,
            salaryPerYear: 1,
            yearsRemaining: 1,
          },
          c2: {
            id: "c2",
            playerId,
            teamId,
            salaryPerYear: 2,
            yearsRemaining: 1,
          },
        },
      },
    });

    const migrated = deserializeGameState(v2Json);
    expect(migrated.world.players[playerId]!.contractId).toBeNull();
  });

  it("migrates schemaVersion 6 teams to schemaVersion 7 relationship fields", () => {
    const modern = createInitialGameState({
      saveId: "save_v6_teams",
      rngSeed: 11,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const controlledTeamId = modern.user.controlledTeamId;
    const controlledTeam = modern.world.teams[controlledTeamId]!;
    const division = modern.world.divisions[controlledTeam.divisionId]!;

    const v6Teams = Object.fromEntries(
      Object.entries(modern.world.teams).map(([teamId, team]) => [
        teamId,
        {
          id: team.id,
          divisionId: team.divisionId,
          city: team.city,
          name: team.name,
          abbreviation: team.abbreviation,
        },
      ]),
    );

    const v6Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 6,
      },
      world: {
        ...modern.world,
        teams: v6Teams,
      },
    });

    const migrated = deserializeGameState(v6Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const migratedTeam = migrated.world.teams[controlledTeamId]!;
    expect(migratedTeam.conferenceId).toBe(division.conferenceId);
    expect(migratedTeam.roster).toEqual([]);
    expect(migratedTeam.staff).toEqual([]);
    expect(migratedTeam.finances).toEqual({});
    expect(migratedTeam.arenaId).toBe(`arena_${controlledTeamId}`);
    expect(migratedTeam.reputation).toBe(50);
    expect(migratedTeam.name).toBe(controlledTeam.name);
    expect(migratedTeam.city).toBe(controlledTeam.city);
    expect(migratedTeam.abbreviation).toBe(controlledTeam.abbreviation);
  });

  it("migrates schemaVersion 7 games to score, events, and playerStats", () => {
    const modern = createInitialGameState({
      saveId: "save_v7_games",
      rngSeed: 12,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const homeTeamId = modern.user.controlledTeamId;
    const awayTeamId = Object.keys(modern.world.teams).find(
      (id) => id !== homeTeamId,
    )!;
    const playerId = asPlayerId("player_box");

    const v7Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 7,
      },
      competition: {
        ...modern.competition,
        games: {
          game_null_scores: {
            id: "game_null_scores",
            seasonId: modern.competition.season.id,
            date: "2026-10-02",
            homeTeamId,
            awayTeamId,
            status: "scheduled",
            homeScore: null,
            awayScore: null,
            boxScore: null,
          },
          game_final: {
            id: "game_final",
            seasonId: modern.competition.season.id,
            date: "2026-10-03",
            homeTeamId,
            awayTeamId,
            status: "final",
            homeScore: 110,
            awayScore: 104,
            boxScore: [
              {
                playerId,
                minutes: 34,
                points: 22,
                rebounds: 6,
                assists: 5,
              },
            ],
          },
        },
      },
    });

    const migrated = deserializeGameState(v7Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const scheduled = migrated.competition.games.game_null_scores!;
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.score).toEqual({ home: 0, away: 0 });
    expect(scheduled.events).toEqual([]);
    expect(scheduled.playerStats).toEqual([]);
    expect("homeScore" in scheduled).toBe(false);
    expect("awayScore" in scheduled).toBe(false);
    expect("boxScore" in scheduled).toBe(false);

    const finalGame = migrated.competition.games.game_final!;
    expect(finalGame.status).toBe("final");
    expect(finalGame.score).toEqual({ home: 110, away: 104 });
    expect(finalGame.events).toEqual([]);
    expect(finalGame.playerStats).toEqual([
      {
        playerId,
        minutes: 34,
        points: 22,
        rebounds: 6,
        assists: 5,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
      },
    ]);
    expect("homeScore" in finalGame).toBe(false);
    expect("boxScore" in finalGame).toBe(false);
  });

  it("round-trips current schema version including rngState", () => {
    const state = createInitialGameState({
      saveId: "save_current",
      rngSeed: 9,
    });
    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(restored.meta.rngState).toBe(state.meta.rngState);
    expect(restored).toEqual(state);
  });
});
