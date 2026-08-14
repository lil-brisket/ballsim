import { describe, expect, it } from "vitest";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { getControlledTeam, toDashboardSnapshot } from "@/state/selectors";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";

describe("createInitialGameState", () => {
  it("creates composed slices with owner mode defaults", () => {
    const state = createInitialGameState({
      saveId: "save_test",
      rngSeed: 99,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(state.meta.rngSeed).toBe(99);
    expect(state.user.mode).toBe("owner");
    expect(state.world.league.abbreviation).toBe("CBL");
    expect(Object.keys(state.world.teams).length).toBeGreaterThan(0);
    expect(getControlledTeam(state).abbreviation).toBe("HAR");
  });

  it("round-trips through serialize/deserialize", () => {
    const state = createInitialGameState({
      saveId: "save_roundtrip",
      rngSeed: 3,
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const restored = deserializeGameState(serializeGameState(state));
    expect(restored).toEqual(state);
  });

  it("builds a dashboard snapshot from state", () => {
    const state = createInitialGameState({
      saveId: "save_dash",
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const snapshot = toDashboardSnapshot(state);
    expect(snapshot.leagueName).toBe("Continental Basketball League");
    expect(snapshot.controlledTeam.name).toBe("Titans");
    expect(snapshot.currentDate).toBe("2026-10-01");
  });
});
