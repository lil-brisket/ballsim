import { describe, expect, it } from "vitest";
import type { OffensiveRole } from "@/domain/entities/offensive-role";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";
import {
  assignOffensiveRoles,
  buildOffensiveUsageProfiles,
  calculateUsageScore,
  computeInvolvementWeight,
  computePassWeight,
  computeShotWeight,
  normalizeUsageProfiles,
  pickByWeight,
  pickWeightedPlayer,
  scoringAbility,
  creationAbility,
} from "@/systems/player-usage";
import { PLAYER_USAGE_CONFIG } from "@/systems/player-usage-config";

function attrs(level: number) {
  return {
    finishing: level,
    midRange: level,
    threePoint: level,
    passing: level,
    ballHandling: level,
    offensiveIq: level,
  };
}

describe("calculateUsageScore", () => {
  it("is not equal to a single rating and floors at USAGE_SCORE_FLOOR", () => {
    const player = createPlayer({
      id: "u1",
      attributes: {
        finishing: 90,
        midRange: 70,
        threePoint: 60,
        passing: 80,
        ballHandling: 50,
        offensiveIq: 40,
      },
    });
    const score = calculateUsageScore(player);
    expect(score).toBeGreaterThanOrEqual(PLAYER_USAGE_CONFIG.usageScoreFloor);
    expect(score).not.toBe(player.attributes.finishing);
    expect(score).not.toBe(player.attributes.passing);
    const scoring = (90 + 70 + 60) / 3;
    const creation = (80 + 50) / 2;
    expect(score).toBeCloseTo(
      0.4 * scoring + 0.3 * creation + 0.15 * 50 + 0.15 * 40,
      5,
    );
  });
});

describe("normalizeUsageProfiles", () => {
  it("produces positive shot and pass shares that each sum to 1", () => {
    const players = [
      createPlayer({ id: "a", attributes: attrs(90) }),
      createPlayer({ id: "b", attributes: attrs(70) }),
      createPlayer({ id: "c", attributes: attrs(50) }),
    ];
    const normalized = normalizeUsageProfiles(
      buildOffensiveUsageProfiles(players),
    );
    const shotSum = [...normalized.shotShares.values()].reduce(
      (sum, share) => sum + share,
      0,
    );
    const passSum = [...normalized.passShares.values()].reduce(
      (sum, share) => sum + share,
      0,
    );
    expect(shotSum).toBeCloseTo(1, 10);
    expect(passSum).toBeCloseTo(1, 10);
    for (const share of normalized.shotShares.values()) {
      expect(share).toBeGreaterThan(0);
    }
    for (const share of normalized.passShares.values()) {
      expect(share).toBeGreaterThan(0);
    }
  });
});

describe("role vs attributes", () => {
  it("same attributes: primary > secondary > scorer > role_player > low_usage weights", () => {
    const usageScore = 70;
    const scoring = 70;
    const creation = 70;
    const order: OffensiveRole[] = [
      "primary_creator",
      "secondary_creator",
      "scorer",
      "role_player",
      "low_usage",
    ];
    const shotWeights = order.map((role) =>
      computeShotWeight(usageScore, role, scoring),
    );
    const involvementWeights = order.map((role) =>
      computeInvolvementWeight(usageScore, role),
    );
    for (let index = 0; index < order.length - 1; index += 1) {
      expect(shotWeights[index]!).toBeGreaterThan(shotWeights[index + 1]!);
      expect(involvementWeights[index]!).toBeGreaterThan(
        involvementWeights[index + 1]!,
      );
    }
  });

  it("90-rated role_player out-weights 50-rated primary_creator", () => {
    const high = createPlayer({ id: "high", attributes: attrs(90) });
    const low = createPlayer({ id: "low", attributes: attrs(50) });
    const highScore = calculateUsageScore(high);
    const lowScore = calculateUsageScore(low);
    const highShot = computeShotWeight(
      highScore,
      "role_player",
      scoringAbility(high),
    );
    const lowShot = computeShotWeight(
      lowScore,
      "primary_creator",
      scoringAbility(low),
    );
    const highInvolvement = computeInvolvementWeight(highScore, "role_player");
    const lowInvolvement = computeInvolvementWeight(
      lowScore,
      "primary_creator",
    );
    expect(highShot).toBeGreaterThan(lowShot);
    expect(highInvolvement).toBeGreaterThan(lowInvolvement);
  });

  it("higher scoring attributes increase shot share at the same role", () => {
    const scorer = createPlayer({
      id: "scorer",
      attributes: {
        ...attrs(70),
        finishing: 90,
        midRange: 90,
        threePoint: 90,
        passing: 50,
        ballHandling: 50,
      },
    });
    const passer = createPlayer({
      id: "passer",
      attributes: {
        ...attrs(70),
        finishing: 50,
        midRange: 50,
        threePoint: 50,
        passing: 90,
        ballHandling: 90,
      },
    });
    // Force same role by computing weights directly.
    const scorerShot = computeShotWeight(
      calculateUsageScore(scorer),
      "role_player",
      scoringAbility(scorer),
    );
    const passerShot = computeShotWeight(
      calculateUsageScore(passer),
      "role_player",
      scoringAbility(passer),
    );
    const scorerPass = computePassWeight(
      calculateUsageScore(scorer),
      "role_player",
      creationAbility(scorer),
    );
    const passerPass = computePassWeight(
      calculateUsageScore(passer),
      "role_player",
      creationAbility(passer),
    );
    expect(scorerShot).toBeGreaterThan(passerShot);
    expect(passerPass).toBeGreaterThan(scorerPass);
  });
});

describe("team-depth normalization", () => {
  it("adding another high-usage player reduces the original star share", () => {
    const superstar = createPlayer({ id: "star", attributes: attrs(95) });
    const rolePlayer = createPlayer({ id: "role", attributes: attrs(55) });
    const secondStar = createPlayer({ id: "star2", attributes: attrs(93) });

    const poolA = normalizeUsageProfiles(
      buildOffensiveUsageProfiles([superstar, rolePlayer]),
    );
    const poolB = normalizeUsageProfiles(
      buildOffensiveUsageProfiles([superstar, secondStar, rolePlayer]),
    );

    expect(poolB.shotShares.get("star")!).toBeLessThan(
      poolA.shotShares.get("star")!,
    );
    expect(poolB.passShares.get("star")!).toBeLessThan(
      poolA.passShares.get("star")!,
    );
    expect(poolB.involvementShares.get("star")!).toBeLessThan(
      poolA.involvementShares.get("star")!,
    );
  });
});

describe("assignOffensiveRoles", () => {
  it("ranks eligible pool and does not assign bench inside the pool", () => {
    const players = [
      createPlayer({ id: "p1", attributes: attrs(95) }),
      createPlayer({ id: "p2", attributes: attrs(85) }),
      createPlayer({ id: "p3", attributes: attrs(75) }),
      createPlayer({ id: "p4", attributes: attrs(65) }),
      createPlayer({ id: "p5", attributes: attrs(45) }),
    ];
    const roles = assignOffensiveRoles(players);
    expect(roles.get("p1")).toBe("primary_creator");
    expect(roles.get("p5")).toBe("low_usage");
    for (const role of roles.values()) {
      expect(role).not.toBe("bench");
    }
  });
});

describe("weighted selection", () => {
  it("higher usage players are selected more often over a large sample", () => {
    const high = createPlayer({ id: "high", attributes: attrs(95) });
    const low = createPlayer({ id: "low", attributes: attrs(40) });
    const profiles = buildOffensiveUsageProfiles([high, low]);
    const counts = new Map<string, number>([
      ["high", 0],
      ["low", 0],
    ]);
    const rng = createTestRng(42);
    const samples = 5000;
    for (let index = 0; index < samples; index += 1) {
      const picked = pickWeightedPlayer(profiles, "shotWeight", rng);
      counts.set(picked.id, (counts.get(picked.id) ?? 0) + 1);
    }
    expect(counts.get("high")!).toBeGreaterThan(counts.get("low")!);
    expect(counts.get("low")!).toBeGreaterThan(0);
  });

  it("different seeds produce different pick sequences", () => {
    const players = [
      createPlayer({ id: "a", attributes: attrs(80) }),
      createPlayer({ id: "b", attributes: attrs(70) }),
      createPlayer({ id: "c", attributes: attrs(60) }),
    ];
    const profiles = buildOffensiveUsageProfiles(players);
    const sequence = (seed: number) => {
      const rng = createTestRng(seed);
      return Array.from({ length: 40 }, () =>
        pickWeightedPlayer(profiles, "involvementWeight", rng).id,
      ).join(",");
    };
    expect(sequence(1)).not.toEqual(sequence(2));
  });

  it("pickByWeight uses the same last-item fallback semantics", () => {
    const rng = {
      next: () => 0.999999,
      nextInt: () => 0,
      pick: <T>(items: readonly T[]) => items[0]!,
      chance: () => false,
      getState: () => 0,
    };
    const picked = pickByWeight(
      [
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
      ],
      rng,
    );
    expect(picked.id).toBe("b");
  });
});
