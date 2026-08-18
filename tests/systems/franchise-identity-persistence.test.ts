import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { isAiProfile, isOwnershipAxis } from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";
import {
  captureIdentityAxes,
  assertIdentityAxesUnchanged,
  snapshotAllFranchiseIdentities,
  meanFingerprintsByProfile,
} from "@/systems/economy/franchise-identity-metrics";
import { runIdentityLeagueObservation } from "@/systems/economy/identity-league-observation";

describe("franchise identity persistence", () => {
  it("round-trips identity fields through serialize/deserialize", () => {
    let state = createInitialGameState({
      saveId: "id_roundtrip",
      rngSeed: 88,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const json = serializeGameState(state);
    const loaded = deserializeGameState(json);
    for (const teamId of Object.keys(loaded.world.teams) as TeamId[]) {
      const ops = loaded.business.franchiseOps[teamId]!;
      expect(isAiProfile(ops.aiProfile)).toBe(true);
      expect(isOwnershipAxis(ops.spendingTolerance)).toBe(true);
      expect(isOwnershipAxis(ops.patience)).toBe(true);
      expect(isOwnershipAxis(ops.riskTolerance)).toBe(true);
      expect(ops).toEqual(state.business.franchiseOps[teamId]);
    }
  });

  it("migrates v26 ops missing axes to v27 without rewriting aiProfile", () => {
    let state = createInitialGameState({
      saveId: "id_migrate",
      rngSeed: 55,
      settings: CBL_GAME_SETTINGS,
    });
    const preserved = Object.fromEntries(
      Object.entries(state.business.franchiseOps).map(([id, ops]) => [
        id,
        ops.aiProfile,
      ]),
    );
    // Simulate a v26 payload: strip axes and set schemaVersion 26
    const legacyOps = Object.fromEntries(
      Object.entries(state.business.franchiseOps).map(([id, ops]) => {
        const {
          spendingTolerance: _s,
          patience: _p,
          riskTolerance: _r,
          ...rest
        } = ops;
        return [id, rest];
      }),
    );
    const v26 = {
      ...state,
      meta: { ...state.meta, schemaVersion: 26 },
      business: { ...state.business, franchiseOps: legacyOps },
    };
    const json = JSON.stringify(v26);
    const migrated = deserializeGameState(json);
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    for (const teamId of Object.keys(migrated.world.teams) as TeamId[]) {
      const ops = migrated.business.franchiseOps[teamId]!;
      expect(ops.aiProfile).toBe(preserved[teamId]);
      expect(isOwnershipAxis(ops.spendingTolerance)).toBe(true);
      expect(isOwnershipAxis(ops.patience)).toBe(true);
      expect(isOwnershipAxis(ops.riskTolerance)).toBe(true);
      expect(ops.premiumTicketPrice).toBeGreaterThan(0);
    }
  });

  it("does not drift identity axes across a short multi-season observation", () => {
    // 1 season is enough to exercise AI paths; full 10-season runs are for tuning.
    const observation = runIdentityLeagueObservation(1, { seed: 101 });
    expect(observation.seasonsSimulated).toBe(1);
    assertIdentityAxesUnchanged(observation.initialAxes, observation.finalState);
    expect(observation.finalAxes).toEqual(observation.initialAxes);
    expect(observation.sampleDecisionReasons.length).toBeGreaterThan(0);
    expect(observation.fingerprints.length).toBeGreaterThan(0);
  }, 120_000);

  it("produces multiple strategy clusters in a fresh league", () => {
    const state = createInitialGameState({
      saveId: "id_clusters",
      rngSeed: 202,
      settings: CBL_GAME_SETTINGS,
    });
    const rows = snapshotAllFranchiseIdentities(state);
    const means = meanFingerprintsByProfile(rows);
    expect(means.length).toBeGreaterThanOrEqual(3);
    const axes = captureIdentityAxes(state);
    expect(Object.keys(axes).length).toBe(rows.length);
  });
});
