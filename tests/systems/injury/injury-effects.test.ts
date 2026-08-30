import { describe, expect, it } from "vitest";
import { createPlayer } from "../../factories/player";
import type { PlayerInjury } from "@/domain/entities/player";
import {
  getEffectiveAttributes,
  getWorkloadRestrictions,
  developmentOpportunityFactor,
} from "@/systems/injury/injury-effects";
import { computeInjuryProbability } from "@/systems/injury/injury-occurrence";
import { createGameAcuteExposure } from "@/systems/injury/injury-exposure";
import { asPlayerId, asTeamId } from "@/domain/ids";

function injury(overrides: Partial<PlayerInjury> = {}): PlayerInjury {
  return {
    injuryId: "inj_1",
    catalogKey: "ankle_sprain",
    type: "Ankle Sprain",
    bodyPart: "ankle",
    severity: "moderate",
    injuredOn: "2026-01-01",
    expectedReturnWindow: {
      earliest: "2026-01-10",
      latest: "2026-01-18",
    },
    recoveryProgress: 0,
    practiceRestriction: "rehab",
    gameRestriction: "limited",
    minutesRestriction: 24,
    recommendedWorkloadMpg: 18,
    maximumWorkloadMpg: 24,
    reinjuryRisk: 0.15,
    temporaryEffects: [
      { attribute: "speed", delta: -6 },
      { attribute: "athleticism", delta: -4 },
    ],
    temporaryFrustration: 12,
    isReinjury: false,
    isAggravation: false,
    priorInjuryId: null,
    chronic: false,
    exposureSource: "game_acute",
    ...overrides,
  };
}

describe("injury effects", () => {
  it("applies temporary attribute modifiers without mutating base", () => {
    const player = createPlayer({
      injury: injury(),
      attributes: { speed: 80, athleticism: 75 },
    });
    const before = player.attributes.speed;
    const effective = getEffectiveAttributes(player);
    expect(player.attributes.speed).toBe(before);
    expect(effective.speed).toBe(74);
    expect(effective.athleticism).toBe(71);
  });

  it("fades modifiers as recovery progresses", () => {
    const early = createPlayer({
      injury: injury({ recoveryProgress: 0 }),
      attributes: { speed: 80 },
    });
    const late = createPlayer({
      injury: injury({ recoveryProgress: 0.5 }),
      attributes: { speed: 80 },
    });
    expect(getEffectiveAttributes(early).speed).toBeLessThan(
      getEffectiveAttributes(late).speed,
    );
  });

  it("aggregates most restrictive workload across multiple injuries", () => {
    const player = createPlayer({
      activeInjuries: [
        injury({
          injuryId: "a",
          recommendedWorkloadMpg: 28,
          maximumWorkloadMpg: 34,
          minutesRestriction: 34,
        }),
        injury({
          injuryId: "b",
          recommendedWorkloadMpg: 12,
          maximumWorkloadMpg: 16,
          minutesRestriction: 16,
          gameRestriction: "limited",
        }),
      ],
    });
    const workload = getWorkloadRestrictions(player);
    expect(workload.recommendedWorkloadMpg).toBe(12);
    expect(workload.maximumWorkloadMpg).toBe(16);
  });

  it("short minor injury has near-full development opportunity", () => {
    const player = createPlayer({
      injury: injury({
        severity: "minor",
        gameRestriction: "monitor",
        recoveryProgress: 0.5,
      }),
    });
    expect(developmentOpportunityFactor(player)).toBeGreaterThan(0.9);
  });
});

describe("injury risk / exposure", () => {
  it("requires exposure — probability is positive for game acute", () => {
    const player = createPlayer({ durability: 60, age: 28 });
    const event = createGameAcuteExposure({
      playerId: asPlayerId(player.id),
      teamId: asTeamId("team_1"),
      date: "2026-01-15",
      minutesPlayed: 36,
      fatigue: 0.7,
      isBackToBack: true,
    });
    const p = computeInjuryProbability(player, event, "medium", 1);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.35);
  });

  it("skips overuse when already injured this game", () => {
    const player = createPlayer();
    const event = createGameAcuteExposure({
      playerId: asPlayerId(player.id),
      teamId: asTeamId("team_1"),
      date: "2026-01-15",
      minutesPlayed: 36,
      fatigue: 0.8,
    });
    // mutate to overuse with alreadyInjured flag via cast
    const overuse = {
      ...event,
      source: "game_overuse" as const,
      alreadyInjuredThisGame: true,
    };
    expect(computeInjuryProbability(player, overuse, "high", 1)).toBe(0);
  });

  it("higher durability lowers probability", () => {
    const fragile = createPlayer({ durability: 30, age: 34 });
    const durable = createPlayer({ durability: 90, age: 24 });
    const event = createGameAcuteExposure({
      playerId: asPlayerId("p"),
      teamId: asTeamId("team_1"),
      date: "2026-01-15",
      minutesPlayed: 38,
      fatigue: 0.8,
      isBackToBack: true,
    });
    expect(
      computeInjuryProbability(fragile, event, "medium", 1),
    ).toBeGreaterThan(computeInjuryProbability(durable, event, "medium", 1));
  });
});
