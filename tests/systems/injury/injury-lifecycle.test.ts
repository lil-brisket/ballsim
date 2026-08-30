import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { createPlayer } from "../../factories/player";
import {
  applyInjuryFromSeverity,
  applyInjuryToPlayer,
  applySuspension,
  clearInjury,
  clearSuspension,
  aggravateInjury,
} from "@/systems/injury/injury-lifecycle";
import { tickDailyRecovery } from "@/systems/injury/injury-service";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import type { PlayerInjury } from "@/domain/entities/player";
import { getEffectiveAttributes } from "@/systems/injury/injury-effects";
import { aggregateAvailabilityFromInjuries } from "@/systems/injury/injury-status";

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
          staff: [],
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
      calendar: { currentDate: "2026-01-15" },
      staff: {},
    },
    settings: { injuryFrequency: "medium" },
  } as unknown as GameState;
}

function sampleInjury(
  overrides: Partial<PlayerInjury> = {},
): PlayerInjury {
  return {
    injuryId: "inj_test_1",
    catalogKey: "knee_sprain",
    type: "Knee",
    bodyPart: "knee",
    severity: "major",
    injuredOn: "2026-01-01",
    expectedReturnWindow: {
      earliest: "2026-01-20",
      latest: "2026-02-01",
    },
    recoveryProgress: 0,
    practiceRestriction: "none",
    gameRestriction: "out",
    minutesRestriction: 0,
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: 0,
    reinjuryRisk: 0.2,
    temporaryEffects: [{ attribute: "speed", delta: -5 }],
    temporaryFrustration: 20,
    isReinjury: false,
    isAggravation: false,
    priorInjuryId: null,
    chronic: false,
    exposureSource: "game_acute",
    ...overrides,
  };
}

describe("injury lifecycle", () => {
  it("applies injury with separated availability and injury detail", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let state = minimalState([player]);
    state = applyInjuryFromSeverity(state, asPlayerId("p1"), {
      type: "Ankle Sprain",
      severity: "moderate",
      catalogKey: "ankle_sprain",
    });
    const next = state.world.players[asPlayerId("p1")]!;
    expect(next.availability).toBe("limited");
    expect(next.activeInjuries).toHaveLength(1);
    expect(next.injury?.type).toBe("Ankle Sprain");
    expect(next.injury?.recommendedWorkloadMpg).toBe(18);
    expect(next.injury?.maximumWorkloadMpg).toBe(24);
  });

  it("supports multiple simultaneous active injuries with aggregate status", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let state = minimalState([player]);
    state = applyInjuryFromSeverity(state, asPlayerId("p1"), {
      type: "Ankle Sprain",
      severity: "moderate",
      catalogKey: "ankle_sprain",
    });
    state = applyInjuryFromSeverity(state, asPlayerId("p1"), {
      type: "Shoulder Strain",
      severity: "minor",
      catalogKey: "shoulder_strain",
    });
    const next = state.world.players[asPlayerId("p1")]!;
    expect(next.activeInjuries.length).toBe(2);
    expect(
      aggregateAvailabilityFromInjuries(next.activeInjuries),
    ).toBe("limited");
  });

  it("supports suspension without injury", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let state = minimalState([player]);
    state = applySuspension(state, asPlayerId("p1"), 3);
    const next = state.world.players[asPlayerId("p1")]!;
    expect(next.availability).toBe("suspended");
    expect(next.injury).toBeNull();
    expect(next.activeInjuries).toEqual([]);
    expect(next.suspension?.gamesRemaining).toBe(3);
  });

  it("clears injury back to available", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "out",
      injury: sampleInjury(),
    });
    let state = minimalState([player]);
    state = clearInjury(state, asPlayerId("p1"));
    expect(state.world.players[asPlayerId("p1")]!.availability).toBe(
      "available",
    );
    expect(state.world.players[asPlayerId("p1")]!.injury).toBeNull();
    expect(state.world.players[asPlayerId("p1")]!.activeInjuries).toEqual([]);
  });

  it("advances recovery via daily tick toward clearance", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "out",
      injury: sampleInjury({
        severity: "moderate",
        type: "Ankle Sprain",
        catalogKey: "ankle_sprain",
        bodyPart: "ankle",
        gameRestriction: "limited",
        practiceRestriction: "rehab",
        recommendedWorkloadMpg: 18,
        maximumWorkloadMpg: 22,
        minutesRestriction: 22,
        recoveryProgress: 0.8,
        reinjuryRisk: 0.05,
      }),
    });
    let state = minimalState([player]);
    const rng = createSeededRng(42);
    for (let i = 0; i < 12; i++) {
      const result = tickDailyRecovery(state, rng);
      state = result.state;
    }
    const next = state.world.players[asPlayerId("p1")]!;
    expect(
      next.availability === "available" ||
        next.availability === "limited" ||
        next.availability === "questionable" ||
        next.availability === "recovery" ||
        next.availability === "minor",
    ).toBe(true);
  });

  it("does not invent fabricated severity for explicit undisclosed moderate", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let state = minimalState([player]);
    state = applyInjuryToPlayer(state, asPlayerId("p1"), {
      type: "Undisclosed",
      severity: "moderate",
      availability: "out",
      catalogKey: "undisclosed",
      recommendedWorkloadMpg: null,
      maximumWorkloadMpg: null,
    });
    const injury = state.world.players[asPlayerId("p1")]!.injury!;
    expect(injury.severity).toBe("moderate");
    expect(injury.type).toBe("Undisclosed");
  });

  it("clearSuspension restores based on remaining injury", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "suspended",
      injury: sampleInjury({
        severity: "minor",
        type: "Ankle",
        catalogKey: "ankle_sprain",
        bodyPart: "ankle",
        gameRestriction: "monitor",
        practiceRestriction: "modified",
        recommendedWorkloadMpg: 28,
        maximumWorkloadMpg: 34,
        minutesRestriction: 34,
        recoveryProgress: 0.5,
        reinjuryRisk: 0.08,
        temporaryEffects: [],
        temporaryFrustration: 5,
      }),
      suspension: { gamesRemaining: 1 },
    });
    let state = minimalState([player]);
    state = clearSuspension(state, asPlayerId("p1"));
    expect(state.world.players[asPlayerId("p1")]!.suspension).toBeNull();
    expect(state.world.players[asPlayerId("p1")]!.availability).not.toBe(
      "suspended",
    );
  });

  it("aggravation upgrades severity on the same injury id", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "limited",
      injury: sampleInjury({
        injuryId: "inj_ankle",
        severity: "moderate",
        type: "Ankle Sprain",
        catalogKey: "ankle_sprain",
        bodyPart: "ankle",
        gameRestriction: "limited",
        practiceRestriction: "rehab",
        recommendedWorkloadMpg: 18,
        maximumWorkloadMpg: 24,
        minutesRestriction: 24,
      }),
    });
    let state = minimalState([player]);
    state = aggravateInjury(state, asPlayerId("p1"), "inj_ankle");
    const injury = state.world.players[asPlayerId("p1")]!.activeInjuries[0]!;
    expect(injury.injuryId).toBe("inj_ankle");
    expect(injury.isAggravation).toBe(true);
    expect(injury.severity).toBe("major");
    expect(injury.gameRestriction).toBe("out");
  });

  it("never mutates base attributes — only effective attributes change", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "limited",
      injury: sampleInjury({
        severity: "moderate",
        gameRestriction: "limited",
        practiceRestriction: "rehab",
        maximumWorkloadMpg: 24,
        recommendedWorkloadMpg: 18,
        minutesRestriction: 24,
        temporaryEffects: [{ attribute: "speed", delta: -8 }],
        recoveryProgress: 0,
      }),
      attributes: { speed: 80 },
    });
    const baseSpeed = player.attributes.speed;
    const effective = getEffectiveAttributes(player);
    expect(player.attributes.speed).toBe(baseSpeed);
    expect(effective.speed).toBeLessThan(baseSpeed);
  });
});
