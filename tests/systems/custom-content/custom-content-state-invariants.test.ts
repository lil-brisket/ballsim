import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { applyRosterPackage } from "@/systems/custom-content/apply-roster";
import { exportRoster } from "@/systems/custom-content/export";
import { validateGameState } from "@/persistence/validate-game-state";
import { makeFullRosterPackage } from "../../helpers/custom-content";

describe("custom content state invariants", () => {
  it("passes validateGameState after import", () => {
    const state = createInitialGameState({
      saveId: "custom_invariants",
      rngSeed: 15,
      settings: CBL_GAME_SETTINGS,
    });
    const pkg = makeFullRosterPackage({
      teamCount: Object.keys(state.world.teams).length,
    });
    const rng = createSeededRng(state.meta.rngState);
    const applied = applyRosterPackage(state, pkg, rng).state;
    expect(() => validateGameState(applied)).not.toThrow();
    const playerIds = Object.keys(applied.world.players);
    expect(new Set(playerIds).size).toBe(playerIds.length);
    for (const team of Object.values(applied.world.teams)) {
      for (const playerId of team.roster) {
        expect(applied.world.players[playerId]?.teamId).toBe(team.id);
      }
    }
  });

  it("round-trips player data through export then import", () => {
    const state = createInitialGameState({
      saveId: "custom_roundtrip",
      rngSeed: 16,
      settings: CBL_GAME_SETTINGS,
    });
    const pkg = makeFullRosterPackage({
      teamCount: Object.keys(state.world.teams).length,
    });
    const rng = createSeededRng(state.meta.rngState);
    const applied = applyRosterPackage(state, pkg, rng).state;
    const exported = exportRoster(applied);
    const empty = createInitialGameState({
      saveId: "custom_roundtrip_2",
      rngSeed: 17,
      settings: CBL_GAME_SETTINGS,
    });
    const reimported = applyRosterPackage(empty, exported, rng).state;
    const original = Object.values(applied.world.players)[0]!;
    const match = Object.values(reimported.world.players).find(
      (player) =>
        player.firstName === original.firstName &&
        player.lastName === original.lastName,
    );
    expect(match).toBeDefined();
    expect(match?.position).toBe(original.position);
    expect(match?.attributes).toEqual(original.attributes);
    expect(match?.potential).toEqual(original.potential);
    expect(match?.archetype).toBe(original.archetype);
    expect(match?.personality).toEqual(original.personality);
    expect(match?.heightInches).toBe(original.heightInches);
    expect(match?.weightPounds).toBe(original.weightPounds);
  });
});
