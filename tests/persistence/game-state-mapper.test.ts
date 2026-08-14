import { describe, expect, it } from "vitest";
import { NEUTRAL_TEAM_PLAY_STYLE } from "@/domain/entities/team";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
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
    expect(migratedTeam.playStyle).toEqual(NEUTRAL_TEAM_PLAY_STYLE);
    expect(migratedTeam.coachingPhilosophy).toEqual(DEFAULT_COACHING_PHILOSOPHY);
    expect(migratedTeam.name).toBe(controlledTeam.name);
    expect(migratedTeam.city).toBe(controlledTeam.city);
    expect(migratedTeam.abbreviation).toBe(controlledTeam.abbreviation);
  });

  it("migrates schemaVersion 10 teams by adding neutral playStyle only", () => {
    const modern = createInitialGameState({
      saveId: "save_v10_teams",
      rngSeed: 14,
      nowIso: "2026-08-14T12:00:00.000Z",
    });

    const teamIds = Object.keys(modern.world.teams);
    expect(teamIds.length).toBeGreaterThanOrEqual(2);
    const teamAId = teamIds[0]!;
    const teamBId = teamIds[1]!;
    const teamA = modern.world.teams[teamAId]!;
    const teamB = modern.world.teams[teamBId]!;

    const stripToV10 = (team: typeof teamA) => {
      const {
        playStyle: _playStyle,
        coachingPhilosophy: _coachingPhilosophy,
        ...rest
      } = team;
      return rest;
    };

    const v10Teams = {
      [teamAId]: stripToV10(teamA),
      [teamBId]: stripToV10(teamB),
    };

    const v10Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 10,
      },
      world: {
        ...modern.world,
        teams: v10Teams,
      },
    });

    const migrated = deserializeGameState(v10Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const migratedA = migrated.world.teams[teamAId]!;
    const migratedB = migrated.world.teams[teamBId]!;

    expect(migratedA.playStyle).toEqual(NEUTRAL_TEAM_PLAY_STYLE);
    expect(migratedB.playStyle).toEqual(NEUTRAL_TEAM_PLAY_STYLE);
    expect(migratedA.playStyle).not.toBe(migratedB.playStyle);
    expect(migratedA.coachingPhilosophy).toEqual(DEFAULT_COACHING_PHILOSOPHY);
    expect(migratedB.coachingPhilosophy).toEqual(DEFAULT_COACHING_PHILOSOPHY);

    const {
      playStyle: _a,
      coachingPhilosophy: _ca,
      ...fieldsA
    } = migratedA;
    const {
      playStyle: _b,
      coachingPhilosophy: _cb,
      ...fieldsB
    } = migratedB;
    expect(fieldsA).toEqual(v10Teams[teamAId]);
    expect(fieldsB).toEqual(v10Teams[teamBId]);
  });

  it("migrates schemaVersion 11 teams by adding balanced coachingPhilosophy only", () => {
    const modern = createInitialGameState({
      saveId: "save_v11_teams",
      rngSeed: 15,
      nowIso: "2026-08-14T12:00:00.000Z",
    });

    const teamIds = Object.keys(modern.world.teams);
    expect(teamIds.length).toBeGreaterThanOrEqual(2);
    const teamAId = teamIds[0]!;
    const teamBId = teamIds[1]!;
    const teamA = modern.world.teams[teamAId]!;
    const teamB = modern.world.teams[teamBId]!;

    const customPlayStyleA = {
      ...NEUTRAL_TEAM_PLAY_STYLE,
      pace: 72,
      threePointFrequency: 81,
    };
    const customPlayStyleB = {
      ...NEUTRAL_TEAM_PLAY_STYLE,
      defensiveAggression: 33,
      insideFrequency: 61,
    };

    const stripCoaching = (team: typeof teamA, playStyle: typeof customPlayStyleA) => {
      const { coachingPhilosophy: _coachingPhilosophy, ...rest } = team;
      return { ...rest, playStyle: { ...playStyle } };
    };

    const v11Teams = {
      [teamAId]: stripCoaching(teamA, customPlayStyleA),
      [teamBId]: stripCoaching(teamB, customPlayStyleB),
    };

    const v11Json = JSON.stringify({
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 11,
      },
      world: {
        ...modern.world,
        teams: v11Teams,
      },
    });

    const migrated = deserializeGameState(v11Json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const migratedA = migrated.world.teams[teamAId]!;
    const migratedB = migrated.world.teams[teamBId]!;

    expect(migratedA.playStyle).toEqual(customPlayStyleA);
    expect(migratedB.playStyle).toEqual(customPlayStyleB);
    expect(migratedA.coachingPhilosophy).toEqual(DEFAULT_COACHING_PHILOSOPHY);
    expect(migratedB.coachingPhilosophy).toEqual(DEFAULT_COACHING_PHILOSOPHY);
    expect(migratedA.coachingPhilosophy).not.toBe(migratedB.coachingPhilosophy);

    const { coachingPhilosophy: _ca, ...fieldsA } = migratedA;
    const { coachingPhilosophy: _cb, ...fieldsB } = migratedB;
    expect(fieldsA).toEqual(v11Teams[teamAId]);
    expect(fieldsB).toEqual(v11Teams[teamBId]);
  });

  it("serializes coachingPhilosophy on current teams", () => {
    const modern = createInitialGameState({
      saveId: "save_current_coaching",
      rngSeed: 16,
      nowIso: "2026-08-14T12:00:00.000Z",
    });
    const json = serializeGameState(modern);
    const restored = deserializeGameState(json);
    const team = Object.values(restored.world.teams)[0]!;
    expect(team.coachingPhilosophy).toEqual(DEFAULT_COACHING_PHILOSOPHY);
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
        offensiveRebounds: 0,
        defensiveRebounds: 0,
        assists: 5,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        threePointersMade: 0,
        threePointersAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        touches: 0,
      },
    ]);
    expect(finalGame.periodScores).toEqual([]);
    expect("homeScore" in finalGame).toBe(false);
    expect("boxScore" in finalGame).toBe(false);
  });

  it("migrates schemaVersion 8 games to periodScores and extended player stats", () => {
    const playerId = "player_v8";
    const stateV8 = {
      meta: {
        saveId: "save_v8",
        schemaVersion: 8,
        createdAt: "2026-08-13T12:00:00.000Z",
        updatedAt: "2026-08-13T12:00:00.000Z",
        rngSeed: 8,
        rngState: 8,
      },
      world: {
        calendar: { currentDate: "2026-10-01" },
        league: {
          id: "league_1",
          name: "Test",
          abbreviation: "TST",
          conferenceIds: [],
        },
        conferences: {},
        divisions: {},
        teams: {},
        players: {},
        coaches: {},
        staff: {},
      },
      competition: {
        season: {
          id: "season_1",
          leagueId: "league_1",
          year: 2026,
          phase: "regular",
        },
        schedule: { seasonId: "season_1", gameIds: ["game_v8"] },
        games: {
          game_v8: {
            id: "game_v8",
            seasonId: "season_1",
            date: "2026-10-15",
            homeTeamId: "team_h",
            awayTeamId: "team_a",
            status: "final",
            score: { home: 100, away: 98 },
            events: [],
            playerStats: [
              {
                playerId,
                minutes: 30,
                points: 15,
                rebounds: 4,
                assists: 3,
                steals: 1,
                blocks: 0,
                turnovers: 2,
                fouls: 1,
              },
            ],
          },
        },
        standings: { seasonId: "season_1", byTeamId: {} },
      },
      business: { contracts: {}, finances: {} },
      user: { controlledTeamId: "team_h", mode: "owner" },
    };

    const migrated = deserializeGameState(JSON.stringify(stateV8));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    const game = migrated.competition.games.game_v8!;
    expect(game.periodScores).toEqual([]);
    expect(game.playerStats[0]).toEqual({
      playerId,
      minutes: 30,
      points: 15,
      rebounds: 4,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      assists: 3,
      steals: 1,
      blocks: 0,
      turnovers: 2,
      fouls: 1,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      touches: 0,
    });
  });

  it("migrates schemaVersion 9 games by adding touches only", () => {
    const playerId = "player_v9";
    const stateV9 = {
      meta: {
        saveId: "save_v9",
        schemaVersion: 9,
        createdAt: "2026-08-14T12:00:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
        rngSeed: 9,
        rngState: 9,
      },
      world: {
        calendar: { currentDate: "2026-10-01" },
        league: {
          id: "league_1",
          name: "Test",
          abbreviation: "TST",
          conferenceIds: [],
        },
        conferences: {},
        divisions: {},
        teams: {},
        players: {},
        coaches: {},
        staff: {},
      },
      competition: {
        season: {
          id: "season_1",
          leagueId: "league_1",
          year: 2026,
          phase: "regular",
        },
        schedule: { seasonId: "season_1", gameIds: ["game_v9"] },
        games: {
          game_v9: {
            id: "game_v9",
            seasonId: "season_1",
            date: "2026-10-15",
            homeTeamId: "team_h",
            awayTeamId: "team_a",
            status: "final",
            score: { home: 110, away: 108 },
            periodScores: [
              { home: 28, away: 27 },
              { home: 26, away: 25 },
              { home: 30, away: 28 },
              { home: 26, away: 28 },
            ],
            events: [],
            playerStats: [
              {
                playerId,
                minutes: 32,
                points: 20,
                rebounds: 5,
                offensiveRebounds: 1,
                defensiveRebounds: 4,
                assists: 4,
                steals: 1,
                blocks: 0,
                turnovers: 2,
                fouls: 2,
                fieldGoalsMade: 8,
                fieldGoalsAttempted: 16,
                threePointersMade: 2,
                threePointersAttempted: 5,
                freeThrowsMade: 2,
                freeThrowsAttempted: 2,
              },
            ],
          },
        },
        standings: { seasonId: "season_1", byTeamId: {} },
      },
      business: { contracts: {}, finances: {} },
      user: { controlledTeamId: "team_h", mode: "owner" },
    };

    const migrated = deserializeGameState(JSON.stringify(stateV9));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    const game = migrated.competition.games.game_v9!;
    expect(game.periodScores).toHaveLength(4);
    expect(game.playerStats[0]).toEqual({
      playerId,
      minutes: 32,
      points: 20,
      rebounds: 5,
      offensiveRebounds: 1,
      defensiveRebounds: 4,
      assists: 4,
      steals: 1,
      blocks: 0,
      turnovers: 2,
      fouls: 2,
      fieldGoalsMade: 8,
      fieldGoalsAttempted: 16,
      threePointersMade: 2,
      threePointersAttempted: 5,
      freeThrowsMade: 2,
      freeThrowsAttempted: 2,
      touches: 0,
    });
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

  it("migrates schemaVersion 12 standings by recomputing expanded TeamStanding", () => {
    const modern = createInitialGameState({
      saveId: "save_v12_standings",
      rngSeed: 17,
      nowIso: "2026-08-14T12:00:00.000Z",
    });

    const teamIds = Object.keys(modern.world.teams).sort();
    const homeTeamId = teamIds[0]!;
    const awayTeamId = teamIds[1]!;
    const seasonId = modern.competition.season.id;

    const v12Standings = Object.fromEntries(
      teamIds.map((teamId) => [teamId, { teamId, wins: 0, losses: 0 }]),
    );

    const stateV12 = {
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 12,
      },
      competition: {
        ...modern.competition,
        schedule: {
          seasonId,
          gameIds: ["game_final_v12"],
        },
        games: {
          game_final_v12: {
            id: "game_final_v12",
            seasonId,
            date: "2026-10-01",
            homeTeamId,
            awayTeamId,
            status: "final",
            score: { home: 110, away: 100 },
            periodScores: [],
            events: [],
            playerStats: [],
          },
          game_scheduled_v12: {
            id: "game_scheduled_v12",
            seasonId,
            date: "2026-10-02",
            homeTeamId,
            awayTeamId,
            status: "scheduled",
            score: { home: 0, away: 0 },
            periodScores: [],
            events: [],
            playerStats: [],
          },
        },
        standings: { byTeamId: v12Standings },
      },
    };

    const migrated = deserializeGameState(JSON.stringify(stateV12));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const home = migrated.competition.standings.byTeamId[homeTeamId]!;
    const away = migrated.competition.standings.byTeamId[awayTeamId]!;
    expect(home).toMatchObject({
      teamId: homeTeamId,
      wins: 1,
      losses: 0,
      winPercentage: 1,
      pointsFor: 110,
      pointsAgainst: 100,
      pointDifferential: 10,
      streak: { type: "W", count: 1 },
    });
    expect(away).toMatchObject({
      teamId: awayTeamId,
      wins: 0,
      losses: 1,
      winPercentage: 0,
      pointsFor: 100,
      pointsAgainst: 110,
      pointDifferential: -10,
      streak: { type: "L", count: 1 },
    });
    expect(Object.keys(migrated.competition.standings.byTeamId).sort()).toEqual(
      teamIds,
    );
  });
});
