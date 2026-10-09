import { describe, expect, it } from "vitest";
import { createDraftPick } from "@/domain/entities/draft-pick";
import { asDraftPickId, asTeamId } from "@/domain/ids";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import { pickValueFromProjection } from "@/systems/trades/asset-valuation/pick-projection";
import { calculateDraftPickValue } from "@/systems/trades/draft-pick-value";
import {
  DRAFT_PICK_VALUE_ROUND_1,
  DRAFT_PICK_VALUE_ROUND_2,
  PICK_VALUE_CURVE,
  PICK_YEAR_DISCOUNT_PER_YEAR,
  STAR_TRADE_VALUE_PREMIUM,
  DL_TRADE_VALUE_PENALTY,
} from "@/systems/trades-config";
import { uniformPlayerAttributes } from "../../../factories/player";
import { createTestInjury } from "../../../factories/player";
import {
  createTradeFixture,
  pickForTeam,
  playerOnTeam,
  teamIds,
} from "../fixture";

function curveValue(overallPick: number): number {
  const hit = PICK_VALUE_CURVE.find((row) => row.overallPick === overallPick);
  if (!hit) {
    throw new Error(`No PICK_VALUE_CURVE anchor at ${overallPick}`);
  }
  return hit.value;
}

function patchPlayer(
  state: ReturnType<typeof createTradeFixture>,
  playerId: ReturnType<typeof playerOnTeam>,
  patch: {
    age?: number;
    overall: number;
    potential: number;
    stage?: "developing" | "prime" | "declining";
    salary?: number;
    injuredOut?: boolean;
  },
) {
  const player = state.world.players[playerId]!;
  const year = state.competition.season.year;
  state.world.players[playerId] = {
    ...player,
    age: patch.age ?? player.age,
    attributes: uniformPlayerAttributes(patch.overall),
    potential: { overall: patch.potential },
    development: { stage: patch.stage ?? "prime" },
    activeInjuries: patch.injuredOut ? [createTestInjury()] : [],
  };
  if (patch.salary !== undefined && player.contractId) {
    const contract = state.business.contracts[player.contractId];
    if (contract) {
      state.business.contracts[player.contractId] = {
        ...contract,
        salaryByYear: {
          [String(year)]: patch.salary,
          [String(year + 1)]: patch.salary,
        },
      };
    }
  }
}

describe("pick value curve", () => {
  it("anchors a zero-width projection to PICK_VALUE_CURVE", () => {
    const year = 2026;
    const nextDraft = year + 1;
    const pick = createDraftPick({
      id: asDraftPickId("pick_curve_r1"),
      originalTeamId: asTeamId("t1"),
      ownerTeamId: asTeamId("t1"),
      seasonYear: nextDraft,
      round: 1,
    });
    for (const { overallPick, value } of PICK_VALUE_CURVE.filter(
      (row) => row.overallPick <= 30,
    )) {
      const priced = pickValueFromProjection(
        {
          projectedOverallPick: overallPick,
          rangeLow: overallPick,
          rangeHigh: overallPick,
          confidence: "high",
          tier: "strong_lottery",
          seasonProgress: 1,
        },
        pick,
        year,
      );
      expect(priced).toBe(value);
    }
  });

  it("discounts one extra year at PICK_YEAR_DISCOUNT_PER_YEAR", () => {
    const year = 2026;
    const pick = createDraftPick({
      id: asDraftPickId("pick_curve_future"),
      originalTeamId: asTeamId("t1"),
      ownerTeamId: asTeamId("t1"),
      seasonYear: year + 2,
      round: 1,
    });
    const priced = pickValueFromProjection(
      {
        projectedOverallPick: 1,
        rangeLow: 1,
        rangeHigh: 1,
        confidence: "high",
        tier: "strong_lottery",
        seasonProgress: 1,
      },
      pick,
      year,
    );
    expect(priced).toBe(
      Math.round(curveValue(1) * (1 - PICK_YEAR_DISCOUNT_PER_YEAR) * 10) / 10,
    );
  });

  it("applies the round-2 haircut on the slot curve", () => {
    const year = 2026;
    const pick = createDraftPick({
      id: asDraftPickId("pick_curve_r2"),
      originalTeamId: asTeamId("t1"),
      ownerTeamId: asTeamId("t1"),
      seasonYear: year + 1,
      round: 2,
    });
    const priced = pickValueFromProjection(
      {
        projectedOverallPick: 45,
        rangeLow: 45,
        rangeHigh: 45,
        confidence: "high",
        tier: "play_in_range",
        seasonProgress: 1,
      },
      pick,
      year,
    );
    expect(priced).toBe(Math.round(curveValue(45) * 0.95 * 10) / 10);
  });

  it("keeps calculateDraftPickValue as the round-only 80/50 helper", () => {
    const r1 = createDraftPick({
      id: asDraftPickId("legacy_r1"),
      originalTeamId: asTeamId("t1"),
      ownerTeamId: asTeamId("t1"),
      seasonYear: 2027,
      round: 1,
    });
    const r2 = createDraftPick({
      id: asDraftPickId("legacy_r2"),
      originalTeamId: asTeamId("t1"),
      ownerTeamId: asTeamId("t1"),
      seasonYear: 2027,
      round: 2,
    });
    expect(calculateDraftPickValue(r1)).toBe(DRAFT_PICK_VALUE_ROUND_1);
    expect(calculateDraftPickValue(r2)).toBe(DRAFT_PICK_VALUE_ROUND_2);
  });
});

describe("player value formula", () => {
  it("applies star premiums 1.25 / 1.65 / 2.2 at 80 / 85 / 90", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const id80 = playerOnTeam(state, teamA, 0);
    const id85 = playerOnTeam(state, teamA, 1);
    const id90 = playerOnTeam(state, teamA, 2);
    patchPlayer(state, id80, {
      age: 27,
      overall: 80,
      potential: 80,
      stage: "prime",
      salary: 80 * 180_000,
    });
    patchPlayer(state, id85, {
      age: 27,
      overall: 85,
      potential: 85,
      stage: "prime",
      salary: 85 * 180_000,
    });
    patchPlayer(state, id90, {
      age: 27,
      overall: 90,
      potential: 90,
      stage: "prime",
      salary: 90 * 180_000,
    });
    const v80 = getBaseAssetValue(state, { kind: "player", playerId: id80 })
      .value;
    const v85 = getBaseAssetValue(state, { kind: "player", playerId: id85 })
      .value;
    const v90 = getBaseAssetValue(state, { kind: "player", playerId: id90 })
      .value;
    expect(v80).toBeGreaterThan(90);
    expect(v85).toBeGreaterThan(v80);
    expect(v90).toBeGreaterThan(v85);
    expect(v85).toBeGreaterThan(120);
    expect(v90).toBeGreaterThan(v80 * STAR_TRADE_VALUE_PREMIUM.overall80);
  });

  it("prices a 21-year-old 72/88 well above a 28-year-old 72/72", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const youngId = playerOnTeam(state, teamA, 0);
    const primeId = playerOnTeam(state, teamA, 1);
    patchPlayer(state, youngId, {
      age: 21,
      overall: 72,
      potential: 88,
      stage: "developing",
      salary: 72 * 180_000,
    });
    patchPlayer(state, primeId, {
      age: 28,
      overall: 72,
      potential: 72,
      stage: "prime",
      salary: 72 * 180_000,
    });
    const young = getBaseAssetValue(state, {
      kind: "player",
      playerId: youngId,
    }).value;
    const prime = getBaseAssetValue(state, {
      kind: "player",
      playerId: primeId,
    }).value;
    expect(young - prime).toBeGreaterThanOrEqual(15);
  });

  it("keeps an established 85 above a projected #1 pick", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const starId = playerOnTeam(state, teamA, 0);
    patchPlayer(state, starId, {
      age: 27,
      overall: 85,
      potential: 85,
      stage: "prime",
      salary: 85 * 180_000,
    });
    const pickId = pickForTeam(state, teamA, 1, 1);
    const starValue = getBaseAssetValue(state, {
      kind: "player",
      playerId: starId,
    }).value;
    const pickValue = getBaseAssetValue(state, {
      kind: "draftPick",
      draftPickId: pickId,
    }).value;
    expect(starValue).toBeGreaterThan(pickValue);
  });

  it("discounts a large overpay on the full contract surplus", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const fairId = playerOnTeam(state, teamA, 0);
    const overId = playerOnTeam(state, teamA, 1);
    const fairSalary = 80 * 180_000;
    patchPlayer(state, fairId, {
      age: 27,
      overall: 80,
      potential: 80,
      stage: "prime",
      salary: fairSalary,
    });
    patchPlayer(state, overId, {
      age: 27,
      overall: 80,
      potential: 80,
      stage: "prime",
      salary: fairSalary + 10_000_000,
    });
    const fair = getBaseAssetValue(state, { kind: "player", playerId: fairId })
      .value;
    const over = getBaseAssetValue(state, { kind: "player", playerId: overId })
      .value;
    expect(fair - over).toBeGreaterThanOrEqual(15);
    const reasons = getBaseAssetValue(state, {
      kind: "player",
      playerId: overId,
    }).reasons;
    expect(reasons.some((reason) => reason.includes("Overpaid"))).toBe(true);
  });

  it("applies the full out injury penalty", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const healthyId = playerOnTeam(state, teamA, 0);
    const hurtId = playerOnTeam(state, teamA, 1);
    patchPlayer(state, healthyId, {
      age: 27,
      overall: 75,
      potential: 75,
      stage: "prime",
      salary: 75 * 180_000,
    });
    patchPlayer(state, hurtId, {
      age: 27,
      overall: 75,
      potential: 75,
      stage: "prime",
      salary: 75 * 180_000,
      injuredOut: true,
    });
    const healthy = getBaseAssetValue(state, {
      kind: "player",
      playerId: healthyId,
    }).value;
    const hurt = getBaseAssetValue(state, { kind: "player", playerId: hurtId })
      .value;
    expect(healthy - hurt).toBeGreaterThanOrEqual(10);
  });

  it("applies a numeric hit for development-league assignment", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    patchPlayer(state, playerId, {
      age: 21,
      overall: 72,
      potential: 80,
      stage: "developing",
      salary: 72 * 180_000,
    });
    const before = getBaseAssetValue(state, { kind: "player", playerId }).value;
    const player = state.world.players[playerId]!;
    state.world.players[playerId] = {
      ...player,
      developmentLeague: {
        ...player.developmentLeague,
        status: "assigned",
      },
    };
    const after = getBaseAssetValue(state, { kind: "player", playerId });
    expect(before - after.value).toBe(DL_TRADE_VALUE_PENALTY);
    expect(after.reasons).toContain("Development-league assignment");
  });
});
