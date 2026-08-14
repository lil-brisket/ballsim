import { describe, expect, it } from "vitest";
import {
  RATING_MAX,
  RATING_MIN,
  type PlayerAttributes,
} from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";

function attrs(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  return {
    speed: 70,
    strength: 70,
    athleticism: 70,
    stamina: 70,
    finishing: 70,
    midRange: 70,
    threePoint: 70,
    freeThrow: 70,
    ballHandling: 70,
    passing: 70,
    perimeterDefense: 70,
    interiorDefense: 70,
    steal: 70,
    block: 70,
    rebounding: 70,
    basketballIq: 70,
    offensiveIq: 70,
    defensiveIq: 70,
    consistency: 70,
    ...overrides,
  };
}

function uniform(value: number): PlayerAttributes {
  return attrs({
    speed: value,
    strength: value,
    athleticism: value,
    stamina: value,
    finishing: value,
    midRange: value,
    threePoint: value,
    freeThrow: value,
    ballHandling: value,
    passing: value,
    perimeterDefense: value,
    interiorDefense: value,
    steal: value,
    block: value,
    rebounding: value,
    basketballIq: value,
    offensiveIq: value,
    defensiveIq: value,
    consistency: value,
  });
}

/** Guard-oriented profile: high perimeter creation/shooting, low interior. */
const GUARD_SHAPED: PlayerAttributes = attrs({
  speed: 90,
  strength: 45,
  athleticism: 85,
  stamina: 80,
  finishing: 75,
  midRange: 85,
  threePoint: 88,
  freeThrow: 86,
  ballHandling: 92,
  passing: 90,
  perimeterDefense: 82,
  interiorDefense: 35,
  steal: 80,
  block: 30,
  rebounding: 40,
  basketballIq: 85,
  offensiveIq: 88,
  defensiveIq: 70,
  consistency: 78,
});

/** Center-oriented profile: high interior, low perimeter creation. */
const CENTER_SHAPED: PlayerAttributes = attrs({
  speed: 40,
  strength: 92,
  athleticism: 75,
  stamina: 70,
  finishing: 88,
  midRange: 45,
  threePoint: 30,
  freeThrow: 55,
  ballHandling: 35,
  passing: 40,
  perimeterDefense: 40,
  interiorDefense: 90,
  steal: 35,
  block: 92,
  rebounding: 94,
  basketballIq: 72,
  offensiveIq: 65,
  defensiveIq: 85,
  consistency: 75,
});

describe("calculatePlayerOverall", () => {
  describe("basic calculation", () => {
    it("returns an integer between RATING_MIN and RATING_MAX", () => {
      const overall = calculatePlayerOverall("PG", attrs());
      expect(Number.isInteger(overall)).toBe(true);
      expect(overall).toBeGreaterThanOrEqual(RATING_MIN);
      expect(overall).toBeLessThanOrEqual(RATING_MAX);
    });

    it("is deterministic for the same inputs", () => {
      const a = calculatePlayerOverall("SF", GUARD_SHAPED);
      const b = calculatePlayerOverall("SF", GUARD_SHAPED);
      expect(a).toBe(b);
    });
  });

  describe("position impact", () => {
    it("produces different ratings for position-sensitive attribute profiles", () => {
      const atPg = calculatePlayerOverall("PG", GUARD_SHAPED);
      const atC = calculatePlayerOverall("C", GUARD_SHAPED);
      expect(atPg).not.toBe(atC);
    });

    it("rates guard-shaped attributes higher at PG/SG than at C", () => {
      const atPg = calculatePlayerOverall("PG", GUARD_SHAPED);
      const atSg = calculatePlayerOverall("SG", GUARD_SHAPED);
      const atC = calculatePlayerOverall("C", GUARD_SHAPED);
      expect(atPg).toBeGreaterThan(atC);
      expect(atSg).toBeGreaterThan(atC);
    });

    it("rates center-shaped attributes higher at C/PF than at PG", () => {
      const atC = calculatePlayerOverall("C", CENTER_SHAPED);
      const atPf = calculatePlayerOverall("PF", CENTER_SHAPED);
      const atPg = calculatePlayerOverall("PG", CENTER_SHAPED);
      expect(atC).toBeGreaterThan(atPg);
      expect(atPf).toBeGreaterThan(atPg);
    });
  });

  describe("relevant attribute sensitivity", () => {
    it("increases PG overall when passing increases", () => {
      const base = attrs({ passing: 60 });
      const raised = attrs({ passing: 80 });
      expect(calculatePlayerOverall("PG", raised)).toBeGreaterThanOrEqual(
        calculatePlayerOverall("PG", base),
      );
      expect(calculatePlayerOverall("PG", raised)).toBeGreaterThan(
        calculatePlayerOverall("PG", base),
      );
    });

    it("increases PG overall when ballHandling increases", () => {
      const base = attrs({ ballHandling: 55 });
      const raised = attrs({ ballHandling: 85 });
      expect(calculatePlayerOverall("PG", raised)).toBeGreaterThan(
        calculatePlayerOverall("PG", base),
      );
    });

    it("increases C overall when rebounding increases", () => {
      const base = attrs({ rebounding: 55 });
      const raised = attrs({ rebounding: 85 });
      expect(calculatePlayerOverall("C", raised)).toBeGreaterThan(
        calculatePlayerOverall("C", base),
      );
    });

    it("increases C overall when interiorDefense increases", () => {
      const base = attrs({ interiorDefense: 50 });
      const raised = attrs({ interiorDefense: 90 });
      expect(calculatePlayerOverall("C", raised)).toBeGreaterThan(
        calculatePlayerOverall("C", base),
      );
    });

    it("increases SG overall when threePoint increases", () => {
      const base = attrs({ threePoint: 55 });
      const raised = attrs({ threePoint: 85 });
      expect(calculatePlayerOverall("SG", raised)).toBeGreaterThan(
        calculatePlayerOverall("SG", base),
      );
    });
  });

  describe("less-relevant attribute sensitivity", () => {
    it("gives PG passing a larger overall impact than PG rebounding", () => {
      const base = attrs({ passing: 60, rebounding: 60 });
      const passingBoost = attrs({ passing: 70, rebounding: 60 });
      const reboundingBoost = attrs({ passing: 60, rebounding: 70 });
      const passingDelta =
        calculatePlayerOverall("PG", passingBoost) -
        calculatePlayerOverall("PG", base);
      const reboundingDelta =
        calculatePlayerOverall("PG", reboundingBoost) -
        calculatePlayerOverall("PG", base);
      expect(passingDelta).toBeGreaterThan(reboundingDelta);
    });

    it("gives C rebounding a larger overall impact than C ballHandling", () => {
      const base = attrs({ rebounding: 60, ballHandling: 60 });
      const reboundingBoost = attrs({ rebounding: 70, ballHandling: 60 });
      const ballHandlingBoost = attrs({ rebounding: 60, ballHandling: 70 });
      const reboundingDelta =
        calculatePlayerOverall("C", reboundingBoost) -
        calculatePlayerOverall("C", base);
      const ballHandlingDelta =
        calculatePlayerOverall("C", ballHandlingBoost) -
        calculatePlayerOverall("C", base);
      expect(reboundingDelta).toBeGreaterThan(ballHandlingDelta);
    });
  });

  describe("physical and mental contribution", () => {
    it("changes PG overall when speed changes", () => {
      const base = attrs({ speed: 50 });
      const raised = attrs({ speed: 90 });
      expect(calculatePlayerOverall("PG", raised)).not.toBe(
        calculatePlayerOverall("PG", base),
      );
      expect(calculatePlayerOverall("PG", raised)).toBeGreaterThan(
        calculatePlayerOverall("PG", base),
      );
    });

    it("changes C overall when strength changes", () => {
      const base = attrs({ strength: 50 });
      const raised = attrs({ strength: 90 });
      expect(calculatePlayerOverall("C", raised)).toBeGreaterThan(
        calculatePlayerOverall("C", base),
      );
    });

    it("changes PG overall when offensiveIq changes", () => {
      const base = attrs({ offensiveIq: 50 });
      const raised = attrs({ offensiveIq: 90 });
      expect(calculatePlayerOverall("PG", raised)).toBeGreaterThan(
        calculatePlayerOverall("PG", base),
      );
    });

    it("changes C overall when defensiveIq changes", () => {
      const base = attrs({ defensiveIq: 50 });
      const raised = attrs({ defensiveIq: 90 });
      expect(calculatePlayerOverall("C", raised)).toBeGreaterThan(
        calculatePlayerOverall("C", base),
      );
    });
  });

  describe("extreme ratings", () => {
    it("returns RATING_MIN when all attributes are 1", () => {
      expect(calculatePlayerOverall("PG", uniform(1))).toBe(RATING_MIN);
      expect(calculatePlayerOverall("C", uniform(1))).toBe(RATING_MIN);
    });

    it("returns RATING_MAX when all attributes are 99", () => {
      expect(calculatePlayerOverall("PG", uniform(99))).toBe(RATING_MAX);
      expect(calculatePlayerOverall("C", uniform(99))).toBe(RATING_MAX);
    });

    it("keeps mixed high/low attributes within bounds", () => {
      const mixed = attrs({
        speed: 99,
        strength: 1,
        athleticism: 95,
        stamina: 10,
        finishing: 90,
        midRange: 5,
        threePoint: 88,
        freeThrow: 12,
        ballHandling: 99,
        passing: 2,
        perimeterDefense: 80,
        interiorDefense: 1,
        steal: 70,
        block: 1,
        rebounding: 5,
        basketballIq: 99,
        offensiveIq: 1,
        defensiveIq: 50,
        consistency: 99,
      });
      for (const position of ["PG", "SG", "SF", "PF", "C"] as const) {
        const overall = calculatePlayerOverall(position, mixed);
        expect(Number.isInteger(overall)).toBe(true);
        expect(overall).toBeGreaterThanOrEqual(RATING_MIN);
        expect(overall).toBeLessThanOrEqual(RATING_MAX);
      }
    });
  });
});
