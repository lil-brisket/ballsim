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
  it("migrates schemaVersion 1 saves through to version 4", () => {
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
    expect(migrated.competition.games.game_legacy?.boxScore).toBeNull();

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
  });

  it("migrates schemaVersion 2 players to version 4 deterministically", () => {
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
  });

  it("migrates schemaVersion 3 players to version 4 with distinguishable mappings", () => {
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

  it("round-trips schema version 4 including rngState", () => {
    const state = createInitialGameState({
      saveId: "save_v4",
      rngSeed: 9,
    });
    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(restored.meta.rngState).toBe(state.meta.rngState);
    expect(restored).toEqual(state);
  });
});
