import { describe, expect, it } from "vitest";
import {
  audienceFit,
  evaluatePromotionEffectiveness,
  promotionReachMultiplier,
} from "@/systems/game-day-promotions/evaluate-promotion-effectiveness";
import { getGameDayPromotionDefinition } from "@/systems/game-day-promotions/game-day-promotion-catalog";
import {
  PROMOTION_REACH_MAX,
  PROMOTION_REACH_MIN,
} from "@/systems/game-day-promotions/game-day-promotion-config";

describe("game-day promotion effects", () => {
  it("keeps awareness as a compressed reach multiplier", () => {
    expect(promotionReachMultiplier(0)).toBeCloseTo(PROMOTION_REACH_MIN);
    expect(promotionReachMultiplier(100)).toBeCloseTo(PROMOTION_REACH_MAX);
    expect(promotionReachMultiplier(50)).toBeGreaterThan(PROMOTION_REACH_MIN);
    expect(promotionReachMultiplier(50)).toBeLessThan(PROMOTION_REACH_MAX);
  });

  it("calibrates demandBoost so major events stay below sellout-button range", () => {
    const bobble = getGameDayPromotionDefinition("bobblehead_giveaway")!;
    const guest = getGameDayPromotionDefinition("special_guest_appearance")!;
    expect(bobble.effects.demandBoost).toBeLessThanOrEqual(10);
    expect(guest.effects.demandBoost).toBeLessThanOrEqual(12);
    const evaluated = evaluatePromotionEffectiveness(bobble, {
      marketSize: 55,
      fanSentiment: 55,
      awareness: 50,
      winPct: 0.5,
      opponentWinPct: 0.5,
      sameDivision: false,
      gameDate: "2026-11-15",
      priorUsesThisSeason: 0,
      cooldownExpired: true,
    });
    // Effective boost after effectiveness/reach should remain modest.
    expect(evaluated.effectiveDemandBoost).toBeLessThan(10);
    expect(evaluated.effectiveDemandBoost).toBeGreaterThan(1);
  });

  it("applies fatigue on repeated uses", () => {
    const def = getGameDayPromotionDefinition("kids_night")!;
    const fresh = evaluatePromotionEffectiveness(def, {
      marketSize: 50,
      fanSentiment: 50,
      awareness: 50,
      winPct: 0.5,
      opponentWinPct: 0.5,
      sameDivision: false,
      gameDate: "2026-11-15",
      priorUsesThisSeason: 0,
      cooldownExpired: true,
    });
    const tired = evaluatePromotionEffectiveness(def, {
      marketSize: 50,
      fanSentiment: 50,
      awareness: 50,
      winPct: 0.5,
      opponentWinPct: 0.5,
      sameDivision: false,
      gameDate: "2026-11-15",
      priorUsesThisSeason: 3,
      cooldownExpired: true,
    });
    expect(tired.effectiveDemandBoost).toBeLessThan(fresh.effectiveDemandBoost);
  });

  it("treats division matchup affinity separately from opponent appeal", () => {
    const def = getGameDayPromotionDefinition("rivalry_night")!;
    const divisionStrongOpp = evaluatePromotionEffectiveness(def, {
      marketSize: 50,
      fanSentiment: 50,
      awareness: 50,
      winPct: 0.5,
      opponentWinPct: 0.7,
      sameDivision: true,
      gameDate: "2026-11-15",
      priorUsesThisSeason: 0,
      cooldownExpired: true,
    });
    const divisionWeakOpp = evaluatePromotionEffectiveness(def, {
      marketSize: 50,
      fanSentiment: 50,
      awareness: 50,
      winPct: 0.5,
      opponentWinPct: 0.3,
      sameDivision: true,
      gameDate: "2026-11-15",
      priorUsesThisSeason: 0,
      cooldownExpired: true,
    });
    const nonDivisionStrong = evaluatePromotionEffectiveness(def, {
      marketSize: 50,
      fanSentiment: 50,
      awareness: 50,
      winPct: 0.5,
      opponentWinPct: 0.7,
      sameDivision: false,
      gameDate: "2026-11-15",
      priorUsesThisSeason: 0,
      cooldownExpired: true,
    });
    expect(divisionStrongOpp.effectiveness).toBeGreaterThan(
      divisionWeakOpp.effectiveness,
    );
    expect(divisionStrongOpp.effectiveness).toBeGreaterThan(
      nonDivisionStrong.effectiveness,
    );
  });

  it("computes audience fit in a bounded range", () => {
    expect(audienceFit(40, 60, "families")).toBeGreaterThan(0.4);
    expect(audienceFit(40, 60, "families")).toBeLessThanOrEqual(1);
    expect(audienceFit(80, 40, "community")).toBeGreaterThan(0.3);
  });
});
