import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { createPlayer } from "../../factories/player";
import {
  applyInjuryFromSeverity,
  applyInjuryToPlayer,
  applySuspension,
  clearInjury,
  clearSuspension,
} from "@/systems/injury/injury-lifecycle";
import { advanceInjuryRecovery } from "@/systems/injury/injury-recovery";
import type { GameState } from "@/state/game-state";

function minimalState(players: ReturnType<typeof createPlayer>[]): GameState {
  const playerMap: GameState["world"]["players"] = {};
  const roster = players.map((p) => p.id);
  for (const p of players) {
    playerMap[p.id] = p;
  }
  return {
    world: {
      players: playerMap,
      teams: {
        [asTeamId("team_1")]: {
          id: asTeamId("team_1"),
          roster,
          rosterManagement: {
            startingLineup: [],
            bench: [],
            inactive: [],
            rotation: [],
            rotationStyle: "balanced",
            rotationPhilosophy: "balanced",
            rotationDepth: 12,
            rotationPreset: "balanced",
            closingLineupPolicy: "auto",
            closingLineupIds: [],
            lastConfiguredBy: "default",
          },
        },
      },
    },
  } as unknown as GameState;
}

describe("injury lifecycle", () => {
  it("applies injury with separated availability and injury detail", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let state = minimalState([player]);
    state = applyInjuryFromSeverity(state, asPlayerId("p1"), {
      type: "Ankle Sprain",
      severity: "moderate",
    });
    const next = state.world.players[asPlayerId("p1")]!;
    expect(next.availability).toBe("limited");
    expect(next.injury?.type).toBe("Ankle Sprain");
    expect(next.injury?.recommendedWorkloadMpg).toBe(18);
    expect(next.injury?.maximumWorkloadMpg).toBe(24);
  });

  it("supports suspension without injury", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let state = minimalState([player]);
    state = applySuspension(state, asPlayerId("p1"), 3);
    const next = state.world.players[asPlayerId("p1")]!;
    expect(next.availability).toBe("suspended");
    expect(next.injury).toBeNull();
    expect(next.suspension?.gamesRemaining).toBe(3);
  });

  it("clears injury back to available", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "out",
      injury: {
        type: "Knee",
        severity: "major",
        gamesRemaining: { min: 10, max: 20 },
        recommendedWorkloadMpg: null,
        maximumWorkloadMpg: 0,
        recoveryProgress: 0,
      },
    });
    let state = minimalState([player]);
    state = clearInjury(state, asPlayerId("p1"));
    expect(state.world.players[asPlayerId("p1")]!.availability).toBe(
      "available",
    );
    expect(state.world.players[asPlayerId("p1")]!.injury).toBeNull();
  });

  it("advances recovery toward available", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "out",
      injury: {
        type: "Ankle Sprain",
        severity: "moderate",
        gamesRemaining: { min: 1, max: 2 },
        recommendedWorkloadMpg: 18,
        maximumWorkloadMpg: 22,
        recoveryProgress: 0.8,
      },
    });
    let state = minimalState([player]);
    for (let i = 0; i < 8; i++) {
      state = advanceInjuryRecovery(state, "team_1");
    }
    const next = state.world.players[asPlayerId("p1")]!;
    expect(
      next.availability === "available" ||
        next.availability === "limited" ||
        next.availability === "questionable",
    ).toBe(true);
    if (next.availability === "available") {
      expect(next.injury).toBeNull();
    }
  });

  it("does not invent return timeline for unknown severity", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let state = minimalState([player]);
    state = applyInjuryToPlayer(state, asPlayerId("p1"), {
      type: "Undisclosed",
      severity: "unknown",
      availability: "out",
      gamesRemaining: null,
      recommendedWorkloadMpg: null,
      maximumWorkloadMpg: null,
    });
    const injury = state.world.players[asPlayerId("p1")]!.injury!;
    expect(injury.gamesRemaining).toBeNull();
    expect(injury.severity).toBe("unknown");
  });

  it("clearSuspension restores based on remaining injury", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "suspended",
      injury: {
        type: "Ankle",
        severity: "minor",
        gamesRemaining: { min: 0, max: 1 },
        recommendedWorkloadMpg: 28,
        maximumWorkloadMpg: 34,
        recoveryProgress: 0.5,
      },
      suspension: { gamesRemaining: 1 },
    });
    let state = minimalState([player]);
    state = clearSuspension(state, asPlayerId("p1"));
    expect(state.world.players[asPlayerId("p1")]!.suspension).toBeNull();
    expect(state.world.players[asPlayerId("p1")]!.availability).not.toBe(
      "suspended",
    );
  });
});
