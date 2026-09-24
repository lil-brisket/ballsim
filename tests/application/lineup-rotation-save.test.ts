import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  createNewOwnerSave,
  previewOwnerOptimizeRotation,
  selectOwnerTeam,
  updateOwnerLineupAndRotation,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { getTeamRosterManagement } from "@/systems/roster-management";
import { TEST_RNG_SEED } from "../helpers/determinism";

describe("updateOwnerLineupAndRotation persistence", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("persists lineup + rotation once and survives reload", async () => {
    const created = await createNewOwnerSave(
      {
        settings: CBL_GAME_SETTINGS,
        name: "Lineup Rotation Save",
        rngSeed: TEST_RNG_SEED,
      },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const saveId = created.save.id;
    const teamId = created.dashboard.controlledTeam.id;
    await selectOwnerTeam(saveId, teamId, store);

    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    const mgmt = getTeamRosterManagement(loaded.state, teamId as never);
    const patchedMinutes = mgmt.rotation.map((entry, index) =>
      index === 0
        ? { ...entry, targetMinutes: Math.max(1, entry.targetMinutes - 1) }
        : entry,
    );

    const result = await updateOwnerLineupAndRotation(
      saveId,
      {
        teamId,
        startingLineup: mgmt.startingLineup.map((s) => ({
          playerId: s.playerId,
          slot: s.slot,
        })),
        bench: mgmt.bench.map(String),
        inactive: mgmt.inactive.map(String),
        rotation: patchedMinutes.map((entry) => ({
          playerId: entry.playerId,
          targetMinutes: entry.targetMinutes,
          minimumMinutes: entry.minimumMinutes,
          normalMaximumMinutes: entry.normalMaximumMinutes,
          absoluteMaximumMinutes: entry.absoluteMaximumMinutes,
          rotationPriority: entry.rotationPriority,
          rotationStatus: entry.rotationStatus,
          role: entry.role,
          preferredPositions: entry.preferredPositions.map(String),
          secondaryPositions: entry.secondaryPositions.map(String),
          minutePriorityBias: entry.minutePriorityBias,
          overrideMedicalRecommendation: entry.overrideMedicalRecommendation,
        })),
        rotationPreset: "custom",
        closingLineupPolicy: mgmt.closingLineupPolicy,
        closingLineupIds: mgmt.closingLineupIds.map(String),
      },
      store,
    );
    expect(result.ok).toBe(true);

    const reloaded = await store.load(saveId);
    expect(reloaded).not.toBeNull();
    if (!reloaded) return;

    const after = getTeamRosterManagement(reloaded.state, teamId as never);
    expect(after.rotationPreset).toBe("custom");
    expect(after.startingLineup.map((s) => s.playerId)).toEqual(
      mgmt.startingLineup.map((s) => s.playerId),
    );
    expect(after.rotation[0]?.targetMinutes).toBe(
      patchedMinutes[0]?.targetMinutes,
    );
  });

  it("preview optimize does not persist; save after optimize does", async () => {
    const created = await createNewOwnerSave(
      {
        settings: CBL_GAME_SETTINGS,
        name: "Optimize Preview Save",
        rngSeed: TEST_RNG_SEED,
      },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const saveId = created.save.id;
    const teamId = created.dashboard.controlledTeam.id;
    await selectOwnerTeam(saveId, teamId, store);

    const loaded = await store.load(saveId);
    if (!loaded) return;
    const before = getTeamRosterManagement(loaded.state, teamId as never);
    const beforeJson = JSON.stringify(before.rotation.map((e) => e.targetMinutes));

    const preview = await previewOwnerOptimizeRotation(
      saveId,
      {
        teamId,
        startingLineup: before.startingLineup.map((s) => ({
          playerId: s.playerId,
          slot: s.slot,
        })),
        bench: before.bench.map(String),
        inactive: before.inactive.map(String),
        rotation: before.rotation.map((entry) => ({
          playerId: entry.playerId,
          targetMinutes: entry.targetMinutes,
          rotationPriority: entry.rotationPriority,
          rotationStatus: entry.rotationStatus,
          role: entry.role,
          preferredPositions: entry.preferredPositions.map(String),
          secondaryPositions: entry.secondaryPositions.map(String),
          minutePriorityBias: entry.minutePriorityBias,
        })),
        rotationPreset: "balanced",
        closingLineupPolicy: before.closingLineupPolicy,
        closingLineupIds: before.closingLineupIds.map(String),
      },
      store,
    );
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const still = await store.load(saveId);
    expect(still).not.toBeNull();
    if (!still) return;
    const mid = getTeamRosterManagement(still.state, teamId as never);
    expect(JSON.stringify(mid.rotation.map((e) => e.targetMinutes))).toBe(
      beforeJson,
    );

    const saved = await updateOwnerLineupAndRotation(
      saveId,
      {
        teamId,
        startingLineup: preview.management.startingLineup.map((s) => ({
          playerId: s.playerId,
          slot: s.slot,
        })),
        bench: preview.management.bench.map(String),
        inactive: preview.management.inactive.map(String),
        rotation: preview.management.rotation.map((entry) => ({
          playerId: entry.playerId,
          targetMinutes: entry.targetMinutes,
          rotationPriority: entry.rotationPriority,
          rotationStatus: entry.rotationStatus,
          role: entry.role,
          preferredPositions: entry.preferredPositions.map(String),
          secondaryPositions: entry.secondaryPositions.map(String),
          minutePriorityBias: entry.minutePriorityBias,
          overrideMedicalRecommendation: entry.overrideMedicalRecommendation,
        })),
        rotationPreset: preview.management.rotationPreset,
        closingLineupPolicy: preview.management.closingLineupPolicy,
        closingLineupIds: preview.management.closingLineupIds.map(String),
      },
      store,
    );
    expect(saved.ok).toBe(true);

    const afterLoad = await store.load(saveId);
    expect(afterLoad).not.toBeNull();
    if (!afterLoad) return;
    const after = getTeamRosterManagement(afterLoad.state, teamId as never);
    expect(after.rotation.map((e) => e.targetMinutes)).toEqual(
      preview.management.rotation.map((e) => e.targetMinutes),
    );
  });
});
