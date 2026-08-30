import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { createPlayer, uniformPlayerAttributes } from "../factories/player";
import { buildRotationFromRoster } from "@/systems/roster-management";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import { redistributeRotationForInjuries } from "@/systems/rotation/rotation-injury-response";
import { emptyTeamRosterManagement } from "@/domain/entities/team-roster-management";
import type { GameState } from "@/state/game-state";
import { deriveRotationConstraints } from "@/systems/rotation/derive-rotation-constraints";

describe("buildRotationFromRoster 12-player preference", () => {
  it("produces ~12 meaningful players on a deep healthy roster", () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      playerId: asPlayerId(`p${i}`),
      isStarter: i < 5,
      overall: 90 - i,
      preferredPositions: (["PG", "SG", "SF", "PF", "C"] as const)[i % 5]!,
      availability: "available" as const,
    })).map((e) => ({
      ...e,
      preferredPositions: [e.preferredPositions],
    }));

    const rotation = buildRotationFromRoster(entries, "balanced", 12);
    const meaningful = rotation.filter(
      (e) => e.targetMinutes >= ROTATION_CONFIG.meaningfulRotationMinutes,
    );
    expect(meaningful.length).toBeGreaterThanOrEqual(11);
    expect(meaningful.length).toBeLessThanOrEqual(12);

    // No token 1–2 minute appearances among active
    for (const entry of meaningful) {
      expect(entry.targetMinutes).toBeGreaterThanOrEqual(
        ROTATION_CONFIG.meaningfulRotationMinutes,
      );
    }

    const sum = rotation
      .filter((e) => e.rotationStatus === "active")
      .reduce((s, e) => s + e.targetMinutes, 0);
    expect(sum).toBe(240);
  });

  it("scales desired size to playable roster when fewer than 12", () => {
    const positions = ["PG", "SG", "SF", "PF", "C"] as const;
    const entries = Array.from({ length: 10 }, (_, i) => ({
      playerId: asPlayerId(`p${i}`),
      isStarter: i < 5,
      overall: 85 - i,
      preferredPositions: [positions[i % 5]!],
      availability: "available" as const,
    }));

    const rotation = buildRotationFromRoster(entries, "balanced", 12);
    const meaningful = rotation.filter(
      (e) => e.targetMinutes >= ROTATION_CONFIG.meaningfulRotationMinutes,
    );
    expect(meaningful.length).toBeLessThanOrEqual(10);
    expect(meaningful.length).toBeGreaterThanOrEqual(8);
  });

  it("respects recommended workload for limited stars", () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      playerId: asPlayerId(`p${i}`),
      isStarter: i < 5,
      overall: i === 0 ? 92 : 80 - i,
      preferredPositions: [
        (["PG", "SG", "SF", "PF", "C"] as const)[i % 5]!,
      ],
      availability: (i === 0 ? "limited" : "available") as
        | "limited"
        | "available",
      recommendedWorkloadMpg: i === 0 ? 28 : null,
      maximumWorkloadMpg: i === 0 ? 32 : null,
      injurySeverity: (i === 0 ? "minor" : null) as "minor" | null,
    }));

    const rotation = buildRotationFromRoster(entries, "balanced", 12);
    const star = rotation.find((e) => e.playerId === "p0")!;
    expect(star.targetMinutes).toBeLessThanOrEqual(30);
    expect(star.targetMinutes).toBeGreaterThanOrEqual(24);
  });
});

describe("redistributeRotationForInjuries", () => {
  it("zeros out injured player and boosts positional backup", () => {
    const starter = createPlayer({
      id: "pg1",
      teamId: "team_1",
      position: "PG",
      attributes: uniformPlayerAttributes(88),
    });
    const backup = createPlayer({
      id: "pg2",
      teamId: "team_1",
      position: "PG",
      attributes: uniformPlayerAttributes(75),
    });
    const others = Array.from({ length: 10 }, (_, i) =>
      createPlayer({
        id: `o${i}`,
        teamId: "team_1",
        position: (["SG", "SF", "PF", "C"] as const)[i % 4],
        attributes: uniformPlayerAttributes(70),
      }),
    );

    const injuredStarter = {
      ...starter,
      availability: "out" as const,
      injury: {
        type: "Hamstring",
        severity: "moderate" as const,
        gamesRemaining: { min: 2, max: 4 },
        recommendedWorkloadMpg: null,
        maximumWorkloadMpg: 0,
        recoveryProgress: 0,
      },
    };

    const roster = [injuredStarter, backup, ...others];
    const rotation = [
      deriveRotationConstraints({
        playerId: injuredStarter.id,
        targetMinutes: 32,
        role: "starter",
        preferredPositions: ["PG"],
      }),
      deriveRotationConstraints({
        playerId: backup.id,
        targetMinutes: 6,
        role: "bench",
        preferredPositions: ["PG"],
      }),
      ...others.map((p, i) =>
        deriveRotationConstraints({
          playerId: p.id,
          targetMinutes: i < 4 ? 28 : 12,
          role: i < 4 ? "starter" : "rotation",
          preferredPositions: [p.position],
        }),
      ),
    ];

    const management = {
      ...emptyTeamRosterManagement(),
      startingLineup: [
        { playerId: injuredStarter.id, slot: "PG" as const },
        { playerId: others[0]!.id, slot: "SG" as const },
        { playerId: others[1]!.id, slot: "SF" as const },
        { playerId: others[2]!.id, slot: "PF" as const },
        { playerId: others[3]!.id, slot: "C" as const },
      ],
      bench: [backup.id, ...others.slice(4).map((p) => p.id)],
      rotation,
      rotationDepth: 12,
    };

    const players: GameState["world"]["players"] = {};
    for (const p of roster) players[p.id] = p;

    const state = {
      world: {
        players,
        teams: {
          [asTeamId("team_1")]: {
            id: asTeamId("team_1"),
            roster: roster.map((p) => p.id),
            rosterManagement: management,
          },
        },
      },
    } as unknown as GameState;

    const result = redistributeRotationForInjuries(
      state,
      asTeamId("team_1"),
      management,
    );

    const injuredEntry = result.management.rotation.find(
      (e) => e.playerId === injuredStarter.id,
    )!;
    expect(injuredEntry.targetMinutes).toBe(0);

    const backupEntry = result.management.rotation.find(
      (e) => e.playerId === backup.id,
    )!;
    expect(backupEntry.targetMinutes).toBeGreaterThan(6);
    expect(result.changelog.length).toBeGreaterThan(0);
  });
});
