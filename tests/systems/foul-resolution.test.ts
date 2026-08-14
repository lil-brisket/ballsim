import { describe, expect, it } from "vitest";
import { createFoul, type Foul } from "@/domain/entities/foul";
import { asPlayerId } from "@/domain/ids";
import {
  FOUL_RESOLUTION_CONFIG,
  type FoulRules,
} from "@/systems/foul-resolution-config";
import {
  resolveFoul,
  validateFoulRules,
  type ResolveFoulInput,
} from "@/systems/foul-resolution";
import type { ShotType } from "@/systems/shot-resolution-config";

function shootingFoul(): Foul {
  return createFoul({
    foulingPlayerId: asPlayerId("defender_1"),
    fouledPlayerId: asPlayerId("shooter_1"),
    foulType: "shooting",
  });
}

function nonShootingFoul(): Foul {
  return createFoul({
    foulingPlayerId: asPlayerId("defender_1"),
    fouledPlayerId: asPlayerId("ballhandler_1"),
    foulType: "non-shooting",
  });
}

function shootingInput(
  overrides: Partial<ResolveFoulInput> & {
    shotType: ShotType;
    shotMade: boolean;
  },
): ResolveFoulInput {
  return {
    foul: shootingFoul(),
    teamFoulsBefore: 0,
    ...overrides,
  };
}

describe("FOUL_RESOLUTION_CONFIG", () => {
  it("uses positive bonus thresholds with double bonus above bonus", () => {
    expect(FOUL_RESOLUTION_CONFIG.bonusThreshold).toBeGreaterThan(0);
    expect(FOUL_RESOLUTION_CONFIG.doubleBonusThreshold).toBeGreaterThan(
      FOUL_RESOLUTION_CONFIG.bonusThreshold,
    );
    expect(FOUL_RESOLUTION_CONFIG.bonusFreeThrows).toBeGreaterThan(0);
    expect(FOUL_RESOLUTION_CONFIG.doubleBonusFreeThrows).toBeGreaterThan(0);
  });
});

describe("resolveFoul shooting fouls", () => {
  it("awards 2 free throws on a missed two-point shot", () => {
    const result = resolveFoul(
      shootingInput({ shotType: "two_point", shotMade: false }),
    );
    expect(result.basketCounts).toBe(false);
    expect(result.freeThrowsAwarded).toBe(2);
    expect(result.bonusFreeThrows).toBe(false);
    expect(result.foulType).toBe("shooting");
  });

  it("awards 3 free throws on a missed three-point shot", () => {
    const result = resolveFoul(
      shootingInput({ shotType: "three_point", shotMade: false }),
    );
    expect(result.basketCounts).toBe(false);
    expect(result.freeThrowsAwarded).toBe(3);
  });

  it("counts the basket and awards 1 free throw on a made two-point shot", () => {
    const result = resolveFoul(
      shootingInput({ shotType: "two_point", shotMade: true }),
    );
    expect(result.basketCounts).toBe(true);
    expect(result.freeThrowsAwarded).toBe(1);
  });

  it("counts the basket and awards 1 free throw on a made three-point shot", () => {
    const result = resolveFoul(
      shootingInput({ shotType: "three_point", shotMade: true }),
    );
    expect(result.basketCounts).toBe(true);
    expect(result.freeThrowsAwarded).toBe(1);
  });
});

describe("resolveFoul non-shooting fouls", () => {
  it("awards no free throws below the bonus threshold", () => {
    const result = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: FOUL_RESOLUTION_CONFIG.bonusThreshold - 2,
    });
    expect(result.teamFoulsAfter).toBe(
      FOUL_RESOLUTION_CONFIG.bonusThreshold - 1,
    );
    expect(result.freeThrowsAwarded).toBe(0);
    expect(result.bonusFreeThrows).toBe(false);
    expect(result.basketCounts).toBe(false);
  });

  it("awards configured bonus free throws at the bonus threshold", () => {
    const result = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: FOUL_RESOLUTION_CONFIG.bonusThreshold - 1,
    });
    expect(result.teamFoulsAfter).toBe(FOUL_RESOLUTION_CONFIG.bonusThreshold);
    expect(result.freeThrowsAwarded).toBe(
      FOUL_RESOLUTION_CONFIG.bonusFreeThrows,
    );
    expect(result.bonusFreeThrows).toBe(true);
  });

  it("awards configured double-bonus free throws at the double-bonus threshold", () => {
    const result = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: FOUL_RESOLUTION_CONFIG.doubleBonusThreshold - 1,
    });
    expect(result.teamFoulsAfter).toBe(
      FOUL_RESOLUTION_CONFIG.doubleBonusThreshold,
    );
    expect(result.freeThrowsAwarded).toBe(
      FOUL_RESOLUTION_CONFIG.doubleBonusFreeThrows,
    );
    expect(result.bonusFreeThrows).toBe(true);
  });

  it("respects custom FoulRules", () => {
    const rules: FoulRules = {
      bonusThreshold: 3,
      bonusFreeThrows: 1,
    };
    const below = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: 1,
      rules,
    });
    const atBonus = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: 2,
      rules,
    });
    expect(below.freeThrowsAwarded).toBe(0);
    expect(atBonus.freeThrowsAwarded).toBe(1);
  });
});

describe("resolveFoul team foul counts", () => {
  it("increments teamFoulsBefore to teamFoulsAfter", () => {
    const first = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: 0,
    });
    expect(first.teamFoulsAfter).toBe(1);

    const fifth = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: 4,
    });
    expect(fifth.teamFoulsAfter).toBe(5);
  });

  it("is stateless across independent calls", () => {
    const home = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: 2,
    });
    const away = resolveFoul({
      foul: nonShootingFoul(),
      teamFoulsBefore: 7,
    });
    expect(home.teamFoulsAfter).toBe(3);
    expect(away.teamFoulsAfter).toBe(8);
  });

  it("does not mutate the input foul", () => {
    const foul = nonShootingFoul();
    const snapshot = structuredClone(foul);
    resolveFoul({ foul, teamFoulsBefore: 0 });
    expect(foul).toEqual(snapshot);
  });
});

describe("resolveFoul validation", () => {
  it("rejects a missing foul", () => {
    expect(() =>
      resolveFoul({
        foul: null as unknown as Foul,
        teamFoulsBefore: 0,
      }),
    ).toThrow(/foul/);
  });

  it("rejects negative teamFoulsBefore", () => {
    expect(() =>
      resolveFoul({ foul: nonShootingFoul(), teamFoulsBefore: -1 }),
    ).toThrow(/teamFoulsBefore/);
  });

  it("rejects non-integer teamFoulsBefore", () => {
    expect(() =>
      resolveFoul({ foul: nonShootingFoul(), teamFoulsBefore: 1.5 }),
    ).toThrow(/teamFoulsBefore/);
    expect(() =>
      resolveFoul({ foul: nonShootingFoul(), teamFoulsBefore: Number.NaN }),
    ).toThrow(/teamFoulsBefore/);
  });

  it("rejects shooting fouls without shot context", () => {
    expect(() =>
      resolveFoul({ foul: shootingFoul(), teamFoulsBefore: 0 }),
    ).toThrow(/shotType and shotMade/);
  });

  it("rejects non-shooting fouls with shot context", () => {
    expect(() =>
      resolveFoul({
        foul: nonShootingFoul(),
        teamFoulsBefore: 0,
        shotType: "two_point",
        shotMade: false,
      }),
    ).toThrow(/must not include shotType or shotMade/);
  });

  it("rejects an invalid shot type", () => {
    expect(() =>
      resolveFoul(
        shootingInput({
          shotType: "free_throw" as ShotType,
          shotMade: false,
        }),
      ),
    ).toThrow(/shotType/);
  });

  it("rejects invalid foul player IDs on the foul object", () => {
    expect(() =>
      resolveFoul({
        foul: {
          foulingPlayerId: asPlayerId("same"),
          fouledPlayerId: asPlayerId("same"),
          foulType: "non-shooting",
        },
        teamFoulsBefore: 0,
      }),
    ).toThrow(/must be different/);
  });
});

describe("validateFoulRules", () => {
  it("accepts the default config", () => {
    expect(() => validateFoulRules(FOUL_RESOLUTION_CONFIG)).not.toThrow();
  });

  it("rejects bonusThreshold below 1", () => {
    expect(() =>
      validateFoulRules({ bonusThreshold: 0, bonusFreeThrows: 2 }),
    ).toThrow(/bonusThreshold/);
  });

  it("rejects doubleBonusThreshold not greater than bonusThreshold", () => {
    expect(() =>
      validateFoulRules({
        bonusThreshold: 5,
        doubleBonusThreshold: 5,
        bonusFreeThrows: 2,
        doubleBonusFreeThrows: 2,
      }),
    ).toThrow(/doubleBonusThreshold/);
  });

  it("rejects doubleBonusThreshold without doubleBonusFreeThrows", () => {
    expect(() =>
      validateFoulRules({
        bonusThreshold: 5,
        doubleBonusThreshold: 10,
        bonusFreeThrows: 2,
      }),
    ).toThrow(/doubleBonusFreeThrows/);
  });

  it("rejects doubleBonusFreeThrows without doubleBonusThreshold", () => {
    expect(() =>
      validateFoulRules({
        bonusThreshold: 5,
        bonusFreeThrows: 2,
        doubleBonusFreeThrows: 2,
      }),
    ).toThrow(/doubleBonusFreeThrows requires doubleBonusThreshold/);
  });
});
