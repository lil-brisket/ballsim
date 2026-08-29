/**
 * Forced vs tactical substitution engine tests.
 */

import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { createPlayer } from "../../factories/player";
import { ROLE_TEMPLATES } from "@/systems/rotation/rotation-role-templates";
import type { RotationEntry } from "@/domain/entities/team-roster-management";
import { buildRotationPlan } from "@/systems/rotation/rotation-planner";
import { evaluateSubstitutions } from "@/systems/rotation/substitution-engine";
import { buildRotationGameContext } from "@/systems/rotation/rotation-game-context";
import { emptyTeamRosterManagement } from "@/domain/entities/team-roster-management";

function makeEntry(
  playerId: string,
  role: keyof typeof ROLE_TEMPLATES,
  overrides: Partial<RotationEntry> = {},
): RotationEntry {
  const template = ROLE_TEMPLATES[role];
  return {
    playerId: asPlayerId(playerId),
    targetMinutes: template.target,
    minimumMinutes: template.min,
    normalMaximumMinutes: template.normalMax,
    absoluteMaximumMinutes: template.absoluteMax,
    rotationPriority: template.priority,
    rotationStatus: "active",
    role,
    preferredPositions: ["PG"],
    secondaryPositions: [],
    minutePriorityBias: 0,
    ...overrides,
  };
}

describe("substitution engine", () => {
  it("forces unlimited replacements for fouled-out players", () => {
    const teamId = asTeamId("t1");
    const onCourt = [1, 2, 3, 4, 5].map((n) =>
      createPlayer({
        id: asPlayerId(`c${n}`),
        teamId,
        position: (["PG", "SG", "SF", "PF", "C"] as const)[n - 1]!,
      }),
    );
    const bench = [6, 7, 8].map((n) =>
      createPlayer({
        id: asPlayerId(`b${n}`),
        teamId,
        position: (["PG", "SG", "SF"] as const)[(n - 6) % 3]!,
      }),
    );
    const roster = [...onCourt, ...bench];
    const rotation = roster.map((player, index) =>
      makeEntry(player.id, index < 5 ? "starter" : "bench", {
        preferredPositions: [player.position],
        targetMinutes: index < 5 ? 34 : 12,
      }),
    );
    const management = {
      ...emptyTeamRosterManagement(),
      startingLineup: onCourt.map((player, index) => ({
        playerId: player.id,
        slot: (["PG", "SG", "SF", "PF", "C"] as const)[index]!,
      })),
      bench: bench.map((p) => p.id),
      rotation,
      rotationDepth: 8,
    };
    const plan = buildRotationPlan({
      teamId,
      management,
      rosterPlayers: roster,
      availablePlayerIds: new Set(roster.map((p) => p.id as string)),
    });

    // Foul out three on-court players
    const fouledOut = new Set([onCourt[0]!.id, onCourt[1]!.id, onCourt[2]!.id]);
    const result = evaluateSubstitutions({
      teamId,
      onCourt,
      slots: onCourt.map((p) => p.position),
      benchPool: bench,
      plan,
      secondsOnCourt: new Map(),
      continuousSecondsOnCourt: new Map(),
      lastSubElapsedSeconds: new Map(),
      foulsByPlayerId: new Map(
        [...fouledOut].map((id) => [id, 6]),
      ),
      fouledOutIds: fouledOut,
      unavailableIds: new Set(),
      fatigueByPlayerId: new Map(),
      elapsedGameSeconds: 600,
      context: buildRotationGameContext({
        periodNumber: 2,
        secondsRemainingInPeriod: 400,
        elapsedGameSeconds: 600,
        teamScore: 40,
        opponentScore: 38,
        competitionType: "regular_season",
      }),
      checkpoint: "foul_out",
      remainingGameMinutes: 30,
    });

    expect(result.decisions.length).toBe(3);
    expect(result.decisions.every((d) => d.forced)).toBe(true);
    expect(result.onCourt).toHaveLength(5);
    for (const id of fouledOut) {
      expect(result.onCourt.some((p) => p.id === id)).toBe(false);
    }
  });

  it("caps tactical substitutions per checkpoint", () => {
    const teamId = asTeamId("t1");
    const onCourt = [1, 2, 3, 4, 5].map((n) =>
      createPlayer({
        id: asPlayerId(`tc${n}`),
        teamId,
        position: (["PG", "SG", "SF", "PF", "C"] as const)[n - 1]!,
      }),
    );
    const bench = [6, 7, 8].map((n) =>
      createPlayer({
        id: asPlayerId(`tb${n}`),
        teamId,
        position: (["PG", "SG", "SF"] as const)[(n - 6) % 3]!,
      }),
    );
    const roster = [...onCourt, ...bench];
    const rotation = roster.map((player, index) =>
      makeEntry(player.id, index < 5 ? "starter" : "sixth_man", {
        preferredPositions: [player.position],
        targetMinutes: index < 5 ? 34 : 24,
      }),
    );
    const management = {
      ...emptyTeamRosterManagement(),
      startingLineup: onCourt.map((player, index) => ({
        playerId: player.id,
        slot: (["PG", "SG", "SF", "PF", "C"] as const)[index]!,
      })),
      bench: bench.map((p) => p.id),
      rotation,
      rotationDepth: 8,
    };
    const plan = buildRotationPlan({
      teamId,
      management,
      rosterPlayers: roster,
      availablePlayerIds: new Set(roster.map((p) => p.id as string)),
    });

    const secondsOnCourt = new Map(
      onCourt.map((p) => [p.id as string, 20 * 60]),
    );
    const continuous = new Map(
      onCourt.map((p) => [p.id as string, 500]),
    );

    const result = evaluateSubstitutions({
      teamId,
      onCourt,
      slots: onCourt.map((p) => p.position),
      benchPool: bench,
      plan,
      secondsOnCourt,
      continuousSecondsOnCourt: continuous,
      lastSubElapsedSeconds: new Map(),
      foulsByPlayerId: new Map(),
      fouledOutIds: new Set(),
      unavailableIds: new Set(),
      fatigueByPlayerId: new Map(
        onCourt.map((p) => [p.id as string, 0.9]),
      ),
      elapsedGameSeconds: 1200,
      context: buildRotationGameContext({
        periodNumber: 2,
        secondsRemainingInPeriod: 360,
        elapsedGameSeconds: 1200,
        teamScore: 50,
        opponentScore: 48,
        competitionType: "regular_season",
      }),
      checkpoint: "rotation_window",
      remainingGameMinutes: 24,
    });

    expect(result.decisions.length).toBeLessThanOrEqual(2);
    expect(result.decisions.every((d) => !d.forced)).toBe(true);
  });
});
