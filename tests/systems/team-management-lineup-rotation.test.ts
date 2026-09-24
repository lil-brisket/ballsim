import { describe, expect, it } from "vitest";
import { asTeamId } from "@/domain/ids";
import { generateRosters } from "@/systems/roster-generation";
import {
  getTeamRosterManagement,
  previewOptimizeRotation,
  recommendRosterManagement,
  withTeamRosterManagement,
} from "@/systems/roster-management";
import {
  updateLineupAndRotationCommand,
  updateLineupCommand,
} from "@/systems/team-management-commands";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";
import { createLegacyUndisclosedInjury } from "@/domain/entities/player";

function bootstrappedState() {
  const initial = createTestGameState();
  const rng = createTestRng(1);
  const generated = generateRosters(initial, rng);
  return generated.state;
}

describe("updateLineupAndRotationCommand", () => {
  it("persists lineup and rotation atomically", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const recommended = recommendRosterManagement(state, teamId, {
      configuredBy: "user",
    });
    const patchedRotation = recommended.rotation.map((entry, index) =>
      index === 0
        ? { ...entry, targetMinutes: Math.min(36, entry.targetMinutes + 2) }
        : entry,
    );

    const result = updateLineupAndRotationCommand(state, {
      teamId,
      startingLineup: recommended.startingLineup,
      bench: recommended.bench,
      inactive: recommended.inactive,
      rotation: patchedRotation,
      rotationPreset: "custom",
      closingLineupPolicy: recommended.closingLineupPolicy,
      closingLineupIds: recommended.closingLineupIds,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const saved = result.state.world.teams[teamId]!.rosterManagement;
    expect(saved.startingLineup).toHaveLength(5);
    expect(saved.startingLineup.map((s) => s.playerId)).toEqual(
      recommended.startingLineup.map((s) => s.playerId),
    );
    expect(saved.rotationPreset).toBe("custom");
    const firstId = patchedRotation[0]!.playerId;
    const savedEntry = saved.rotation.find((e) => e.playerId === firstId);
    expect(savedEntry?.targetMinutes).toBe(patchedRotation[0]!.targetMinutes);
  });

  it("rejects inactive players with positive minutes", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const recommended = recommendRosterManagement(state, teamId, {
      configuredBy: "user",
    });
    const inactiveId =
      recommended.inactive[0] ?? recommended.bench[recommended.bench.length - 1]!;
    const bench = recommended.bench.filter((id) => id !== inactiveId);
    const inactive = recommended.inactive.includes(inactiveId)
      ? recommended.inactive
      : [...recommended.inactive, inactiveId];
    const rotation = recommended.rotation
      .filter((e) => e.playerId !== inactiveId)
      .concat([
        {
          ...recommended.rotation[0]!,
          playerId: inactiveId,
          targetMinutes: 12,
        },
      ]);

    const result = updateLineupAndRotationCommand(state, {
      teamId,
      startingLineup: recommended.startingLineup,
      bench,
      inactive,
      rotation,
      rotationPreset: "custom",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/inactive|minutes/i);
    }
  });

  it("rejects unavailable starters", () => {
    let state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const recommended = recommendRosterManagement(state, teamId, {
      configuredBy: "user",
    });
    const starterId = recommended.startingLineup[0]!.playerId;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [starterId]: {
            ...state.world.players[starterId]!,
            availability: "out",
            injury: createLegacyUndisclosedInjury("2026-01-01"),
            activeInjuries: [createLegacyUndisclosedInjury("2026-01-01")],
            suspension: null,
          },
        },
      },
    };

    const result = updateLineupAndRotationCommand(state, {
      teamId,
      startingLineup: recommended.startingLineup,
      bench: recommended.bench,
      inactive: recommended.inactive,
      rotation: recommended.rotation,
      rotationPreset: "custom",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unavailable/i);
    }
  });

  it("rejects mutation for non-active owned franchise", () => {
    let state = bootstrappedState();
    const owned = [...state.user.ownedTeamIds];
    const teamA = owned[0]!;
    const otherTeamId = Object.keys(state.world.teams).find(
      (id) => id !== teamA,
    )!;
    if (!owned.includes(asTeamId(otherTeamId))) {
      state = {
        ...state,
        user: {
          ...state.user,
          ownedTeamIds: [...owned, asTeamId(otherTeamId)],
          ownedFranchises: {
            ...state.user.ownedFranchises,
            [otherTeamId]: state.user.ownedFranchises[teamA]!,
          },
          activeOwnerTeamId: teamA,
        },
      };
    }
    const inactiveOwned =
      state.user.ownedTeamIds.find(
        (id) => id !== state.user.activeOwnerTeamId,
      ) ?? asTeamId(otherTeamId);
    const mgmt = getTeamRosterManagement(state, inactiveOwned);

    const result = updateLineupAndRotationCommand(state, {
      teamId: inactiveOwned,
      startingLineup: mgmt.startingLineup,
      bench: mgmt.bench,
      inactive: mgmt.inactive,
      rotation: mgmt.rotation,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/non-active franchise/i);
    }
  });
});

describe("optimize preview vs persist", () => {
  it("preview changes draft without mutating loaded management; save persists optimize", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const before = getTeamRosterManagement(state, teamId);
    const beforeJson = JSON.stringify(before.rotation);

    const preview = previewOptimizeRotation(state, teamId, {
      rotationPreset: "balanced",
      configuredBy: "user",
    });
    expect(preview.management.rotation.length).toBeGreaterThan(0);
    // Persisted state object still matches original rotation blob
    expect(JSON.stringify(getTeamRosterManagement(state, teamId).rotation)).toBe(
      beforeJson,
    );

    const saveResult = updateLineupAndRotationCommand(state, {
      teamId,
      startingLineup: preview.management.startingLineup,
      bench: preview.management.bench,
      inactive: preview.management.inactive,
      rotation: preview.management.rotation,
      rotationPreset: preview.management.rotationPreset,
      rotationPhilosophy: preview.management.rotationPhilosophy,
      rotationDepth: preview.management.rotationDepth,
      closingLineupPolicy: preview.management.closingLineupPolicy,
      closingLineupIds: preview.management.closingLineupIds,
    });
    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) return;

    const after = saveResult.state.world.teams[teamId]!.rosterManagement;
    expect(after.rotation.map((e) => e.targetMinutes)).toEqual(
      preview.management.rotation.map((e) => e.targetMinutes),
    );
  });

  it("updateLineupCommand still works via merge helper", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const recommended = recommendRosterManagement(state, teamId, {
      configuredBy: "user",
    });
    const result = updateLineupCommand(state, {
      teamId,
      startingLineup: recommended.startingLineup,
      bench: recommended.bench,
      inactive: recommended.inactive,
    });
    expect(result.ok).toBe(true);
  });

  it("in-memory draft state can be optimized without touching original", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const original = getTeamRosterManagement(state, teamId);
    const recommended = recommendRosterManagement(state, teamId, {
      configuredBy: "user",
      rotationPreset: "star_heavy",
    });
    const draftState = withTeamRosterManagement(state, teamId, recommended);
    const preview = previewOptimizeRotation(draftState, teamId, {
      rotationPreset: "star_heavy",
      configuredBy: "user",
    });
    expect(preview.management.rotation.length).toBeGreaterThan(0);
    expect(getTeamRosterManagement(state, teamId).rotationPreset).toBe(
      original.rotationPreset,
    );
  });
});
