import { describe, expect, it } from "vitest";
import { asPlayerId } from "@/domain/ids";
import {
  deriveRotationConstraints,
  rederiveRotationEntry,
} from "@/systems/rotation/derive-rotation-constraints";
import { analyzeRotationHealth } from "@/systems/rotation/rotation-health";
import { projectRotationByQuarter } from "@/systems/rotation/rotation-quarter-projection";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import { createPlayer } from "../../factories/player";
import type { GameState } from "@/state/game-state";
import type { TeamRosterManagement } from "@/domain/entities/team-roster-management";
import { emptyTeamRosterManagement } from "@/domain/entities/team-roster-management";

describe("deriveRotationConstraints", () => {
  it("derives min/max from target and role", () => {
    const entry = deriveRotationConstraints({
      playerId: asPlayerId("p1"),
      targetMinutes: 32,
      role: "starter",
      preferredPositions: ["PG"],
    });
    expect(entry.targetMinutes).toBe(32);
    expect(entry.minimumMinutes).toBeGreaterThan(0);
    expect(entry.normalMaximumMinutes).toBeGreaterThanOrEqual(32);
    expect(entry.absoluteMaximumMinutes).toBeGreaterThanOrEqual(
      entry.normalMaximumMinutes,
    );
    expect(entry.rotationPriority).toBe(1);
  });

  it("clamps to medical maximum unless overridden", () => {
    const capped = deriveRotationConstraints({
      playerId: asPlayerId("p1"),
      targetMinutes: 30,
      role: "starter",
      preferredPositions: ["PG"],
      maximumWorkloadMpg: 18,
    });
    expect(capped.targetMinutes).toBe(18);

    const overridden = deriveRotationConstraints({
      playerId: asPlayerId("p1"),
      targetMinutes: 30,
      role: "starter",
      preferredPositions: ["PG"],
      maximumWorkloadMpg: 18,
      overrideMedicalRecommendation: true,
    });
    expect(overridden.targetMinutes).toBe(30);
  });

  it("zeros out unavailable players", () => {
    const entry = deriveRotationConstraints({
      playerId: asPlayerId("p1"),
      targetMinutes: 28,
      role: "starter",
      preferredPositions: ["PG"],
      canPlay: false,
    });
    expect(entry.targetMinutes).toBe(0);
    expect(entry.rotationStatus).toBe("inactive");
  });

  it("rederives after role change", () => {
    const starter = deriveRotationConstraints({
      playerId: asPlayerId("p1"),
      targetMinutes: 24,
      role: "starter",
      preferredPositions: ["SG"],
    });
    const sixth = rederiveRotationEntry(starter, { role: "sixth_man" });
    expect(sixth.role).toBe("sixth_man");
    expect(sixth.rotationPriority).toBe(2);
  });
});

describe("rotation-quarter-projection", () => {
  it("projects four quarters from targets", () => {
    const entries = [
      deriveRotationConstraints({
        playerId: asPlayerId("p1"),
        targetMinutes: 32,
        role: "starter",
        preferredPositions: ["PG"],
      }),
      deriveRotationConstraints({
        playerId: asPlayerId("p2"),
        targetMinutes: 20,
        role: "sixth_man",
        preferredPositions: ["SG"],
      }),
    ];
    const quarters = projectRotationByQuarter(entries);
    expect(quarters).toHaveLength(4);
    expect(quarters[0]!.players.length).toBeGreaterThan(0);
  });
});

describe("rotation-health meaningful threshold", () => {
  it("exposes meaningfulRotationMinutes config", () => {
    expect(ROTATION_CONFIG.meaningfulRotationMinutes).toBe(5);
    expect(ROTATION_CONFIG.targetRotationPlayerCount).toBe(12);
  });
});

describe("analyzeRotationHealth availability summary", () => {
  it("reports healthy roster context", () => {
    const players = Array.from({ length: 12 }, (_, i) =>
      createPlayer({
        id: `p${i}`,
        teamId: "team_a",
        position: (["PG", "SG", "SF", "PF", "C"] as const)[i % 5],
      }),
    );
    const rotation = players.map((p, i) =>
      deriveRotationConstraints({
        playerId: p.id,
        targetMinutes: i < 5 ? 30 : i < 9 ? 16 : 8,
        role: i < 5 ? "starter" : i === 5 ? "sixth_man" : i < 9 ? "rotation" : "bench",
        preferredPositions: [p.position],
      }),
    );
    // Normalize to 240
    const sum = rotation.reduce((s, e) => s + e.targetMinutes, 0);
    rotation[0]!.targetMinutes += 240 - sum;

    const management: TeamRosterManagement = {
      ...emptyTeamRosterManagement(),
      startingLineup: players.slice(0, 5).map((p) => ({
        playerId: p.id,
        slot: p.position,
      })),
      bench: players.slice(5).map((p) => p.id),
      rotation,
      rotationDepth: 12,
    };

    const playerMap: GameState["world"]["players"] = {};
    for (const p of players) playerMap[p.id] = p;

    const state = {
      world: {
        players: playerMap,
        teams: {
          team_a: {
            id: "team_a",
            roster: players.map((p) => p.id),
            rosterManagement: management,
          },
        },
      },
    } as unknown as GameState;

    const health = analyzeRotationHealth(state, "team_a" as never, management);
    expect(health.rosterSize).toBe(12);
    expect(health.availableCount).toBe(12);
    expect(health.meaningfulPlayerCount).toBeGreaterThanOrEqual(10);
    expect(health.availabilitySummary).toContain("available");
  });
});
