/**
 * Deterministic unit tests for rotation feasibility and planner.
 */

import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import {
  emptyTeamRosterManagement,
  type RotationEntry,
  type TeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import { ROLE_TEMPLATES } from "@/systems/rotation/rotation-role-templates";
import {
  hasHardFeasibilityIssues,
  validateRotationFeasibility,
} from "@/systems/rotation/rotation-feasibility";
import { buildRotationPlan } from "@/systems/rotation/rotation-planner";
import { expectedTeamPlayerSeconds } from "@/systems/rotation/rotation-invariants";
import { createPlayer } from "../../factories/player";

function entry(
  partial: Partial<RotationEntry> & { playerId: string },
): RotationEntry {
  const role = partial.role ?? "bench";
  const template = ROLE_TEMPLATES[role];
  return {
    playerId: asPlayerId(partial.playerId),
    targetMinutes: partial.targetMinutes ?? template.target,
    minimumMinutes: partial.minimumMinutes ?? template.min,
    normalMaximumMinutes: partial.normalMaximumMinutes ?? template.normalMax,
    absoluteMaximumMinutes:
      partial.absoluteMaximumMinutes ?? template.absoluteMax,
    rotationPriority: partial.rotationPriority ?? template.priority,
    rotationStatus: partial.rotationStatus ?? "active",
    role,
    preferredPositions: partial.preferredPositions ?? ["SF"],
    secondaryPositions: partial.secondaryPositions ?? [],
    minutePriorityBias: partial.minutePriorityBias ?? 0,
  };
}

function managementWith(
  rotation: RotationEntry[],
): TeamRosterManagement {
  return {
    ...emptyTeamRosterManagement(),
    rotation,
    rotationDepth: Math.max(5, rotation.filter((r) => r.rotationStatus === "active").length),
    rotationPhilosophy: "balanced",
    rotationStyle: "balanced",
    rotationPreset: "custom",
  };
}

describe("rotation feasibility", () => {
  it("flags maximums below available player-minutes", () => {
    const rotation = Array.from({ length: 8 }, (_, index) =>
      entry({
        playerId: `p${index}`,
        absoluteMaximumMinutes: 20,
        targetMinutes: 20,
        minimumMinutes: 0,
        role: index < 5 ? "starter" : "bench",
      }),
    );
    const result = validateRotationFeasibility(managementWith(rotation));
    expect(hasHardFeasibilityIssues(result)).toBe(true);
    expect(
      result.issues.some((issue) => issue.code === "maximums_below_available"),
    ).toBe(true);
  });

  it("flags minimums exceeding available player-minutes", () => {
    const rotation = Array.from({ length: 8 }, (_, index) =>
      entry({
        playerId: `p${index}`,
        minimumMinutes: 40,
        targetMinutes: 40,
        absoluteMaximumMinutes: 48,
        role: index < 5 ? "starter" : "bench",
      }),
    );
    const result = validateRotationFeasibility(managementWith(rotation));
    expect(
      result.issues.some((issue) => issue.code === "minimums_exceed_available"),
    ).toBe(true);
  });

  it("flags all-zero targets", () => {
    const rotation = Array.from({ length: 8 }, (_, index) =>
      entry({
        playerId: `p${index}`,
        targetMinutes: 0,
        minimumMinutes: 0,
        absoluteMaximumMinutes: 38,
        role: "bench",
      }),
    );
    const result = validateRotationFeasibility(managementWith(rotation));
    expect(
      result.issues.some((issue) => issue.code === "all_targets_zero"),
    ).toBe(true);
  });
});

describe("rotation planner", () => {
  it("builds active pool by depth and priority", () => {
    const players = Array.from({ length: 10 }, (_, index) =>
      createPlayer({
        id: asPlayerId(`pl_${index}`),
        teamId: asTeamId("team_a"),
        position: (["PG", "SG", "SF", "PF", "C"] as const)[index % 5]!,
      }),
    );
    const rotation = players.map((player, index) =>
      entry({
        playerId: player.id,
        targetMinutes: index < 8 ? 30 - index : 0,
        rotationStatus: index < 8 ? "active" : "inactive",
        rotationPriority: (Math.min(5, index + 1) as 1 | 2 | 3 | 4 | 5),
        role: index < 5 ? "starter" : "bench",
        preferredPositions: [player.position],
      }),
    );
    const management = managementWith(rotation);
    management.rotationDepth = 8;
    management.startingLineup = players.slice(0, 5).map((player, index) => ({
      playerId: player.id,
      slot: (["PG", "SG", "SF", "PF", "C"] as const)[index]!,
    }));

    const plan = buildRotationPlan({
      teamId: "team_a",
      management,
      rosterPlayers: players,
      availablePlayerIds: new Set(players.map((p) => p.id as string)),
    });

    expect(plan.activePlayerIds.length).toBe(8);
    expect(plan.closingLineupIds.length).toBe(5);
    expect(plan.staggerWindows.length).toBeGreaterThan(0);
  });
});

describe("rotation invariants", () => {
  it("computes expected team player-seconds for regulation and OT", () => {
    expect(expectedTeamPlayerSeconds(0)).toBe(14_400);
    expect(expectedTeamPlayerSeconds(1)).toBe(14_400 + 1_500);
  });
});
