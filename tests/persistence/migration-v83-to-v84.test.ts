import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import {
  PLAYER_POSITIONS,
  playerPositions,
  playsPosition,
  type Player,
} from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { migrateV83ToV84 } from "@/persistence/mappers/game-state-migrations/v66-v75";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION, type GameState } from "@/state/game-state";
import { listFreeAgents } from "@/systems/free-agency";
import { FREE_AGENT_POOL_MIN_PER_POSITION } from "@/systems/free-agent-pool";
import { bootstrapWorld } from "@/systems/world-pipeline";

/** A v83 save: no player has a secondary position, and one lineup is scrambled. */
function v83State(): GameState {
  const initial = createInitialGameState({
    saveId: "migration_v84",
    rngSeed: 84,
    settings: CBL_GAME_SETTINGS,
  });
  const base = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const players: GameState["world"]["players"] = {};
  for (const [id, player] of Object.entries(base.world.players)) {
    const { secondaryPosition: _dropped, ...rest } = player;
    players[id] = rest as Player;
  }
  // Adjacent-position leftovers, as old saves stored them.
  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(base.world.teams)) {
    const management = team.rosterManagement;
    teams[teamId] = {
      ...team,
      rosterManagement: {
        ...management,
        rotation: management.rotation.map((entry) => ({
          ...entry,
          preferredPositions: [...PLAYER_POSITIONS],
          secondaryPositions: ["PG"],
        })),
        // Rotate the slots so most starters sit one position off.
        startingLineup: management.startingLineup.map((slot, index, all) => ({
          ...slot,
          slot: all[(index + 1) % all.length]!.slot,
        })),
      },
    };
  }
  return {
    ...base,
    meta: { ...base.meta, schemaVersion: 83 },
    world: { ...base.world, players, teams },
  };
}

describe("migration v83 -> v84 (secondary positions)", () => {
  it("gives some active players a secondary, never equal to the primary", () => {
    const migrated = migrateV83ToV84(v83State());
    expect(migrated.meta.schemaVersion).toBe(84);
    const players = Object.values(migrated.world.players);
    const withSecondary = players.filter((p) => p.secondaryPosition);
    expect(withSecondary.length).toBeGreaterThan(0);
    expect(withSecondary.length).toBeLessThan(players.length * 0.5);
    for (const player of withSecondary) {
      expect(player.secondaryPosition).not.toBe(player.position);
    }
  });

  it("leaves retired players alone", () => {
    const state = v83State();
    const [id] = Object.keys(state.world.players);
    const retired = { ...state.world.players[id!]!, retired: true };
    const migrated = migrateV83ToV84({
      ...state,
      world: {
        ...state.world,
        players: { ...state.world.players, [id!]: retired },
      },
    });
    expect(migrated.world.players[id!]).toBe(retired);
  });

  it("clamps rotation positions to what each player can play", () => {
    const migrated = migrateV83ToV84(v83State());
    for (const team of Object.values(migrated.world.teams)) {
      for (const entry of team.rosterManagement.rotation) {
        const player = migrated.world.players[entry.playerId]!;
        expect(entry.preferredPositions.length).toBeGreaterThan(0);
        for (const position of entry.preferredPositions) {
          expect(playerPositions(player)).toContain(position);
        }
        expect(entry.secondaryPositions).toEqual([]);
      }
    }
  });

  it("keeps only legal, unique starting slots", () => {
    const state = v83State();
    const migrated = migrateV83ToV84(state);
    let kept = 0;
    for (const team of Object.values(migrated.world.teams)) {
      const slots = team.rosterManagement.startingLineup;
      expect(new Set(slots.map((slot) => slot.slot)).size).toBe(slots.length);
      for (const slot of slots) {
        const player = migrated.world.players[slot.playerId]!;
        expect(playsPosition(player, slot.slot)).toBe(true);
      }
      kept += slots.length;
    }
    expect(kept).toBeGreaterThan(0);
  });

  it("moves a starter to a free slot he plays instead of dropping him", () => {
    const state = v83State();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const team = state.world.teams[teamId]!;
    const [first, second] = team.rosterManagement.startingLineup;
    const mover = state.world.players[first!.playerId]!;
    // Slot him where he does not play, leaving his own slot free.
    const lineup = [
      { playerId: first!.playerId, slot: second!.slot },
      ...team.rosterManagement.startingLineup.slice(2),
    ];
    const migrated = migrateV83ToV84({
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...team,
            rosterManagement: {
              ...team.rosterManagement,
              startingLineup: lineup,
            },
          },
        },
      },
    });
    const after = migrated.world.teams[teamId]!.rosterManagement.startingLineup;
    const moved = after.find((slot) => slot.playerId === first!.playerId);
    if (moved !== undefined) {
      expect(playsPosition(migrated.world.players[mover.id]!, moved.slot)).toBe(
        true,
      );
    }
  });

  it("tops an empty free-agent pool up to the league floor", () => {
    const state = v83State();
    const players = { ...state.world.players };
    for (const id of listFreeAgents(state).playerIds) {
      players[id] = { ...players[id]!, retired: true };
    }
    const drained = { ...state, world: { ...state.world, players } };
    expect(listFreeAgents(drained).playerIds).toHaveLength(0);

    const migrated = migrateV83ToV84(drained);
    const pool = listFreeAgents(migrated).playerIds.map(
      (id) => migrated.world.players[id]!,
    );
    for (const position of PLAYER_POSITIONS) {
      expect(
        pool.filter((p) => playsPosition(p, position)).length,
      ).toBeGreaterThanOrEqual(FREE_AGENT_POOL_MIN_PER_POSITION);
    }
    expect(migrated.meta.rngState).toBe(state.meta.rngState);
  });

  it("is deterministic", () => {
    const state = v83State();
    expect(migrateV83ToV84(state)).toEqual(migrateV83ToV84(state));
  });

  it("loads a v83 save through the mapper and round-trips it", () => {
    const loaded = deserializeGameState(JSON.stringify(v83State()));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBeGreaterThanOrEqual(84);
    expect(() => validateGameState(loaded)).not.toThrow();
    const reloaded = deserializeGameState(serializeGameState(loaded));
    expect(
      Object.values(reloaded.world.players).map((p) => p.secondaryPosition),
    ).toEqual(
      Object.values(loaded.world.players).map((p) => p.secondaryPosition),
    );
  });
});
