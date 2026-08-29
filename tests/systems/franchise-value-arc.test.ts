import { describe, expect, it } from "vitest";
import {
  createEmptyTeamFinanceBooks,
  type TeamFinanceBooks,
} from "@/domain/entities/finances";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type {
  FranchiseSeasonRecord,
  PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import { asSeasonId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  calculateFranchiseValue,
  explainFranchiseValue,
} from "@/state/franchise-value";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { OWNER_OBJECTIVE_VALUE_GROWTH_PCT } from "@/systems/owner-objectives-config";

function boot(saveId: string): GameState {
  const state = createTestGameState({ saveId });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function teamIdOf(state: GameState): TeamId {
  return state.user.activeOwnerTeamId;
}

function withOps(
  state: GameState,
  patch: Partial<GameState["business"]["franchiseOps"][string]>,
): GameState {
  const teamId = teamIdOf(state);
  const ops = state.business.franchiseOps[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, ...patch },
      },
    },
  };
}

function withReputation(state: GameState, reputation: number): GameState {
  const teamId = teamIdOf(state);
  return {
    ...state,
    world: {
      ...state.world,
      teams: {
        ...state.world.teams,
        [teamId]: { ...state.world.teams[teamId]!, reputation },
      },
    },
  };
}

function withCash(state: GameState, cash: number): GameState {
  const teamId = teamIdOf(state);
  const finances = state.business.finances[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: { ...finances, businessFunds: cash },
      },
    },
  };
}

function booksWithPnL(
  revenueTotal: number,
  expenseTotal: number,
): TeamFinanceBooks {
  const empty = createEmptyTeamFinanceBooks();
  return {
    revenue: { ...empty.revenue, tickets: revenueTotal },
    expenses: { ...empty.expenses, operations: expenseTotal },
  };
}

function withYearBooks(
  state: GameState,
  year: number,
  books: TeamFinanceBooks,
): GameState {
  const teamId = teamIdOf(state);
  const finances = state.business.finances[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...finances,
          booksByYear: {
            ...finances.booksByYear,
            [String(year)]: books,
          },
        },
      },
    },
  };
}

function withFacilityLevels(state: GameState, level: number): GameState {
  const teamId = teamIdOf(state);
  const ops = state.business.franchiseOps[teamId]!;
  const facilities = { ...ops.facilities };
  for (const category of FACILITY_CATEGORIES) {
    facilities[category] = { level, upgradeWeeksRemaining: 0 };
  }
  return withOps(state, { facilities });
}

function withLeague(
  state: GameState,
  patch: Partial<GameState["business"]["leagueEconomy"]>,
): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      leagueEconomy: { ...state.business.leagueEconomy, ...patch },
    },
  };
}

function withChampion(state: GameState, champion: boolean): GameState {
  const teamId = teamIdOf(state);
  return {
    ...state,
    competition: {
      ...state.competition,
      playoffs: {
        ...state.competition.playoffs,
        championTeamId: champion ? teamId : undefined,
      },
    },
  };
}

function seasonRecord(input: {
  year: number;
  wins?: number;
  losses?: number;
  playoffResult?: PlayoffResultSnapshot;
  championship?: boolean;
  revenue?: number;
  cash?: number;
  fanSentiment?: number;
  reputation?: number;
  franchiseValue?: number;
  facilityLevel?: number;
}): FranchiseSeasonRecord {
  const level = input.facilityLevel ?? 1;
  const facilityLevels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    facilityLevels[category] = level;
  }
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins ?? 30,
    losses: input.losses ?? 52,
    playoffResult: input.playoffResult ?? "missed",
    championship: input.championship ?? false,
    revenue: input.revenue ?? 80_000_000,
    expenses: 70_000_000,
    netIncome: (input.revenue ?? 80_000_000) - 70_000_000,
    payroll: 60_000_000,
    leagueRank: null,
    attendance: null,
    businessFunds: input.cash ?? 40_000_000,
    fanSentiment: input.fanSentiment ?? 50,
    reputation: input.reputation ?? 50,
    facilityLevels,
    relocated: false,
    city: "Test City",
    name: "Test Team",
    notableEventIds: [],
    franchiseValue: input.franchiseValue ?? 450_000_000,
  };
}

function withHistory(
  state: GameState,
  seasons: FranchiseSeasonRecord[],
): GameState {
  const teamId = teamIdOf(state);
  return {
    ...state,
    business: {
      ...state.business,
      franchiseHistory: {
        ...state.business.franchiseHistory,
        [teamId]: { teamId, seasons },
      },
    },
  };
}

describe("franchise value arcs", () => {
  it("A — small-market rebuild rises gradually without exploding", () => {
    const year = 2026;
    let early = boot("arc_rebuild_early");
    early = withOps(early, { marketSize: 32, fanSentiment: 35 });
    early = withReputation(early, 35);
    early = withFacilityLevels(early, 1);
    early = withCash(early, 25_000_000);
    early = withYearBooks(early, year, booksWithPnL(55_000_000, 70_000_000));
    early = withHistory(early, [
      seasonRecord({
        year: year - 2,
        wins: 22,
        losses: 60,
        fanSentiment: 30,
        reputation: 30,
        revenue: 50_000_000,
        franchiseValue: 280_000_000,
      }),
      seasonRecord({
        year: year - 1,
        wins: 28,
        losses: 54,
        fanSentiment: 32,
        reputation: 33,
        revenue: 52_000_000,
        franchiseValue: 295_000_000,
      }),
    ]);

    let late = boot("arc_rebuild_late");
    late = withOps(late, { marketSize: 32, fanSentiment: 62 });
    late = withReputation(late, 60);
    late = withFacilityLevels(late, 3);
    late = withCash(late, 45_000_000);
    late = withYearBooks(late, year, booksWithPnL(95_000_000, 85_000_000));
    late = withHistory(late, [
      seasonRecord({
        year: year - 3,
        wins: 28,
        losses: 54,
        franchiseValue: 295_000_000,
      }),
      seasonRecord({
        year: year - 2,
        wins: 38,
        losses: 44,
        playoffResult: "first_round",
        fanSentiment: 48,
        reputation: 48,
        revenue: 72_000_000,
        franchiseValue: 340_000_000,
        facilityLevel: 2,
      }),
      seasonRecord({
        year: year - 1,
        wins: 44,
        losses: 38,
        playoffResult: "second_round",
        fanSentiment: 58,
        reputation: 55,
        revenue: 88_000_000,
        franchiseValue: 390_000_000,
        facilityLevel: 3,
      }),
    ]);

    const earlyV = calculateFranchiseValue(early, teamIdOf(early));
    const lateV = calculateFranchiseValue(late, teamIdOf(late));
    expect(lateV).toBeGreaterThan(earlyV);
    // Gradual — not an immediate explosion past elite territory from small market alone
    expect(lateV / earlyV).toBeLessThan(2.2);
  });

  it("B — championship creates persistent lift next seasons", () => {
    const year = 2026;
    let before = boot("arc_chip_before");
    before = withHistory(before, [
      seasonRecord({
        year: year - 1,
        wins: 50,
        losses: 32,
        playoffResult: "finals",
        championship: false,
        franchiseValue: 520_000_000,
      }),
    ]);

    let after = boot("arc_chip_after");
    after = withHistory(after, [
      seasonRecord({
        year: year - 2,
        wins: 50,
        losses: 32,
        playoffResult: "finals",
        franchiseValue: 520_000_000,
      }),
      seasonRecord({
        year: year - 1,
        wins: 55,
        losses: 27,
        playoffResult: "champion",
        championship: true,
        franchiseValue: 580_000_000,
      }),
    ]);
    after = withChampion(after, false);

    expect(calculateFranchiseValue(after, teamIdOf(after))).toBeGreaterThan(
      calculateFranchiseValue(before, teamIdOf(before)),
    );
    expect(
      explainFranchiseValue(after, teamIdOf(after)).components.championships,
    ).toBeGreaterThan(0);
  });

  it("C — one-year fluke has limited lasting lift", () => {
    const year = 2026;
    let fluke = boot("arc_fluke");
    fluke = withOps(fluke, { marketSize: 40, fanSentiment: 40 });
    fluke = withReputation(fluke, 40);
    fluke = withHistory(fluke, [
      seasonRecord({
        year: year - 3,
        wins: 28,
        losses: 54,
        franchiseValue: 320_000_000,
      }),
      seasonRecord({
        year: year - 2,
        wins: 58,
        losses: 24,
        playoffResult: "finals",
        fanSentiment: 80,
        reputation: 75,
        revenue: 140_000_000,
        franchiseValue: 480_000_000,
      }),
      seasonRecord({
        year: year - 1,
        wins: 30,
        losses: 52,
        playoffResult: "missed",
        fanSentiment: 42,
        reputation: 42,
        revenue: 70_000_000,
        franchiseValue: 400_000_000,
      }),
    ]);

    let steadyWeak = boot("arc_fluke_base");
    steadyWeak = withOps(steadyWeak, { marketSize: 40, fanSentiment: 40 });
    steadyWeak = withReputation(steadyWeak, 40);
    steadyWeak = withHistory(steadyWeak, [
      seasonRecord({
        year: year - 3,
        wins: 28,
        losses: 54,
        franchiseValue: 320_000_000,
      }),
      seasonRecord({
        year: year - 2,
        wins: 30,
        losses: 52,
        franchiseValue: 325_000_000,
      }),
      seasonRecord({
        year: year - 1,
        wins: 30,
        losses: 52,
        franchiseValue: 330_000_000,
      }),
    ]);

    const flukeV = calculateFranchiseValue(fluke, teamIdOf(fluke));
    const baseV = calculateFranchiseValue(steadyWeak, teamIdOf(steadyWeak));
    expect(flukeV).toBeGreaterThan(baseV);
    // Limited lasting lift — not permanently transformed
    expect(flukeV / baseV).toBeLessThan(1.35);
  });

  it("D — dynasty climbs into upper standing with bounded growth", () => {
    const year = 2026;
    let dynasty = boot("arc_dynasty");
    dynasty = withOps(dynasty, { marketSize: 70, fanSentiment: 85 });
    dynasty = withReputation(dynasty, 88);
    dynasty = withFacilityLevels(dynasty, 5);
    dynasty = withCash(dynasty, 80_000_000);
    dynasty = withYearBooks(
      dynasty,
      year,
      booksWithPnL(160_000_000, 120_000_000),
    );
    dynasty = withHistory(dynasty, [
      seasonRecord({
        year: year - 4,
        wins: 52,
        losses: 30,
        playoffResult: "champion",
        championship: true,
        franchiseValue: 650_000_000,
        facilityLevel: 4,
        fanSentiment: 80,
        reputation: 82,
        revenue: 140_000_000,
      }),
      seasonRecord({
        year: year - 3,
        wins: 55,
        losses: 27,
        playoffResult: "champion",
        championship: true,
        franchiseValue: 720_000_000,
        facilityLevel: 5,
        fanSentiment: 84,
        reputation: 85,
        revenue: 150_000_000,
      }),
      seasonRecord({
        year: year - 2,
        wins: 54,
        losses: 28,
        playoffResult: "finals",
        franchiseValue: 760_000_000,
        facilityLevel: 5,
        fanSentiment: 85,
        reputation: 86,
        revenue: 155_000_000,
      }),
      seasonRecord({
        year: year - 1,
        wins: 58,
        losses: 24,
        playoffResult: "champion",
        championship: true,
        franchiseValue: 820_000_000,
        facilityLevel: 5,
        fanSentiment: 88,
        reputation: 90,
        revenue: 165_000_000,
      }),
    ]);
    dynasty = withChampion(dynasty, true);

    const explained = explainFranchiseValue(dynasty, teamIdOf(dynasty));
    expect(["elite", "legacy", "major"]).toContain(explained.standing);
    expect(explained.total).toBeLessThan(2_000_000_000);
  });

  it("E — championship history is persistence not a floor under collapse", () => {
    const year = 2026;
    let peak = boot("arc_collapse_peak");
    peak = withOps(peak, { marketSize: 65, fanSentiment: 85 });
    peak = withReputation(peak, 85);
    peak = withFacilityLevels(peak, 4);
    peak = withCash(peak, 70_000_000);
    peak = withYearBooks(peak, year, booksWithPnL(140_000_000, 110_000_000));
    peak = withHistory(peak, [
      seasonRecord({
        year: year - 1,
        championship: true,
        playoffResult: "champion",
        wins: 55,
        losses: 27,
        franchiseValue: 700_000_000,
        fanSentiment: 85,
        reputation: 85,
        revenue: 140_000_000,
        facilityLevel: 4,
      }),
    ]);
    peak = withChampion(peak, true);

    let collapse = boot("arc_collapse_now");
    collapse = withOps(collapse, { marketSize: 65, fanSentiment: 25 });
    collapse = withReputation(collapse, 28);
    collapse = withFacilityLevels(collapse, 2);
    collapse = withCash(collapse, -30_000_000);
    collapse = withYearBooks(
      collapse,
      year,
      booksWithPnL(40_000_000, 130_000_000),
    );
    collapse = withHistory(collapse, [
      seasonRecord({
        year: year - 5,
        championship: true,
        playoffResult: "champion",
        franchiseValue: 700_000_000,
        fanSentiment: 85,
        reputation: 85,
        revenue: 140_000_000,
      }),
      seasonRecord({
        year: year - 4,
        championship: true,
        playoffResult: "champion",
        franchiseValue: 720_000_000,
      }),
      seasonRecord({
        year: year - 3,
        wins: 35,
        losses: 47,
        franchiseValue: 600_000_000,
        fanSentiment: 50,
        reputation: 55,
        revenue: 90_000_000,
      }),
      seasonRecord({
        year: year - 2,
        wins: 28,
        losses: 54,
        franchiseValue: 480_000_000,
        fanSentiment: 35,
        reputation: 40,
        revenue: 60_000_000,
        facilityLevel: 3,
      }),
      seasonRecord({
        year: year - 1,
        wins: 22,
        losses: 60,
        franchiseValue: 400_000_000,
        fanSentiment: 28,
        reputation: 30,
        revenue: 45_000_000,
        facilityLevel: 2,
      }),
    ]);

    const peakV = calculateFranchiseValue(peak, teamIdOf(peak));
    const collapseV = calculateFranchiseValue(collapse, teamIdOf(collapse));
    expect(
      explainFranchiseValue(collapse, teamIdOf(collapse)).components
        .championships,
    ).toBeGreaterThan(0);
    expect(collapseV).toBeLessThan(peakV * 0.75);
  });

  it("F — relocation raises market potential without instant premier status", () => {
    const year = 2026;
    let before = boot("arc_reloc_before");
    before = withOps(before, { marketSize: 28, fanSentiment: 45 });
    before = withReputation(before, 45);
    before = withHistory(before, [
      seasonRecord({
        year: year - 1,
        franchiseValue: 300_000_000,
        fanSentiment: 45,
        reputation: 45,
      }),
    ]);

    let after = boot("arc_reloc_after");
    after = withOps(after, { marketSize: 88, fanSentiment: 45 });
    after = withReputation(after, 45);
    after = withHistory(after, [
      seasonRecord({
        year: year - 1,
        franchiseValue: 300_000_000,
        fanSentiment: 45,
        reputation: 45,
      }),
    ]);

    const beforeExplain = explainFranchiseValue(before, teamIdOf(before));
    const afterExplain = explainFranchiseValue(after, teamIdOf(after));
    expect(afterExplain.components.marketPotential).toBeGreaterThan(
      beforeExplain.components.marketPotential,
    );
    expect(afterExplain.total).toBeGreaterThan(beforeExplain.total);
    expect(afterExplain.standing).not.toBe("legacy");
    expect(afterExplain.standing).not.toBe("elite");
  });

  it("G — recession pressures both franchises while preserving rank order", () => {
    function makeStrong(saveId: string, cycle: "growth" | "recession") {
      let state = boot(saveId);
      state = withOps(state, { marketSize: 80, fanSentiment: 75 });
      state = withReputation(state, 75);
      state = withFacilityLevels(state, 4);
      state = withYearBooks(
        state,
        state.competition.season.year,
        booksWithPnL(130_000_000, 100_000_000),
      );
      state = withLeague(state, {
        popularity: cycle === "growth" ? 80 : 25,
        broadcastValue: cycle === "growth" ? 75 : 30,
        sponsorshipClimate: cycle === "growth" ? 75 : 25,
        cycle,
      });
      return state;
    }
    function makeWeak(saveId: string, cycle: "growth" | "recession") {
      let state = boot(saveId);
      state = withOps(state, { marketSize: 35, fanSentiment: 30 });
      state = withReputation(state, 30);
      state = withFacilityLevels(state, 1);
      state = withYearBooks(
        state,
        state.competition.season.year,
        booksWithPnL(50_000_000, 80_000_000),
      );
      state = withLeague(state, {
        popularity: cycle === "growth" ? 80 : 25,
        broadcastValue: cycle === "growth" ? 75 : 30,
        sponsorshipClimate: cycle === "growth" ? 75 : 25,
        cycle,
      });
      return state;
    }

    const strongGrowth = makeStrong("arc_rec_sg", "growth");
    const weakGrowth = makeWeak("arc_rec_wg", "growth");
    const strongRec = makeStrong("arc_rec_sr", "recession");
    const weakRec = makeWeak("arc_rec_wr", "recession");

    const sg = calculateFranchiseValue(strongGrowth, teamIdOf(strongGrowth));
    const wg = calculateFranchiseValue(weakGrowth, teamIdOf(weakGrowth));
    const sr = calculateFranchiseValue(strongRec, teamIdOf(strongRec));
    const wr = calculateFranchiseValue(weakRec, teamIdOf(weakRec));

    expect(sr).toBeLessThan(sg);
    expect(wr).toBeLessThan(wg);
    expect(sr).toBeGreaterThan(wr);
    expect(sg).toBeGreaterThan(wg);
  });

  it("small-market dynasty can overcome large-market loser", () => {
    const year = 2026;
    let largeLoser = boot("arc_large_loser");
    largeLoser = withOps(largeLoser, { marketSize: 92, fanSentiment: 38 });
    largeLoser = withReputation(largeLoser, 38);
    largeLoser = withFacilityLevels(largeLoser, 2);
    largeLoser = withCash(largeLoser, 30_000_000);
    largeLoser = withYearBooks(
      largeLoser,
      year,
      booksWithPnL(90_000_000, 110_000_000),
    );
    largeLoser = withHistory(largeLoser, [
      seasonRecord({
        year: year - 1,
        wins: 28,
        losses: 54,
        playoffResult: "missed",
        fanSentiment: 38,
        reputation: 38,
        revenue: 90_000_000,
        franchiseValue: 480_000_000,
        facilityLevel: 2,
      }),
      seasonRecord({
        year: year - 2,
        wins: 30,
        losses: 52,
        playoffResult: "missed",
        fanSentiment: 40,
        reputation: 40,
        revenue: 88_000_000,
        franchiseValue: 470_000_000,
        facilityLevel: 2,
      }),
    ]);

    let smallDynasty = boot("arc_small_dynasty");
    smallDynasty = withOps(smallDynasty, { marketSize: 35, fanSentiment: 88 });
    smallDynasty = withReputation(smallDynasty, 90);
    smallDynasty = withFacilityLevels(smallDynasty, 5);
    smallDynasty = withCash(smallDynasty, 60_000_000);
    smallDynasty = withYearBooks(
      smallDynasty,
      year,
      booksWithPnL(120_000_000, 95_000_000),
    );
    smallDynasty = withHistory(smallDynasty, [
      seasonRecord({
        year: year - 3,
        wins: 52,
        losses: 30,
        playoffResult: "champion",
        championship: true,
        fanSentiment: 85,
        reputation: 86,
        revenue: 110_000_000,
        franchiseValue: 520_000_000,
        facilityLevel: 4,
      }),
      seasonRecord({
        year: year - 2,
        wins: 55,
        losses: 27,
        playoffResult: "finals",
        fanSentiment: 87,
        reputation: 88,
        revenue: 115_000_000,
        franchiseValue: 560_000_000,
        facilityLevel: 5,
      }),
      seasonRecord({
        year: year - 1,
        wins: 58,
        losses: 24,
        playoffResult: "champion",
        championship: true,
        fanSentiment: 90,
        reputation: 90,
        revenue: 125_000_000,
        franchiseValue: 600_000_000,
        facilityLevel: 5,
      }),
    ]);
    smallDynasty = withChampion(smallDynasty, true);

    const largeV = calculateFranchiseValue(largeLoser, teamIdOf(largeLoser));
    const smallV = calculateFranchiseValue(
      smallDynasty,
      teamIdOf(smallDynasty),
    );
    // Large market retains structural advantage in market component
    expect(
      explainFranchiseValue(largeLoser, teamIdOf(largeLoser)).components
        .marketPotential,
    ).toBeGreaterThan(
      explainFranchiseValue(smallDynasty, teamIdOf(smallDynasty)).components
        .marketPotential,
    );
    // Sustained excellence can overcome it overall
    expect(smallV).toBeGreaterThan(largeV);
  });

  it("new franchise with thin history remains stable", () => {
    let fresh = boot("arc_new");
    fresh = withOps(fresh, { marketSize: 50, fanSentiment: 50 });
    fresh = withReputation(fresh, 50);
    const freshV = calculateFranchiseValue(fresh, teamIdOf(fresh));
    expect(freshV).toBeGreaterThan(200_000_000);
    expect(freshV).toBeLessThan(800_000_000);
    expect(explainFranchiseValue(fresh, teamIdOf(fresh)).lastSeasonSnapshot)
      .toBeNull();

    let oneSeason = boot("arc_one_season");
    oneSeason = withOps(oneSeason, { marketSize: 50, fanSentiment: 50 });
    oneSeason = withReputation(oneSeason, 50);
    oneSeason = withHistory(oneSeason, [
      seasonRecord({
        year: oneSeason.competition.season.year - 1,
        franchiseValue: freshV,
      }),
    ]);
    const oneV = calculateFranchiseValue(oneSeason, teamIdOf(oneSeason));
    expect(Math.abs(oneV - freshV) / freshV).toBeLessThan(0.25);
  });
});

describe("franchise_value objectives regression", () => {
  it("baseline × growth target stays meaningful across archetypes", () => {
    const archetypes = [
      { id: "obj_small", marketSize: 30, reputation: 35, sentiment: 35 },
      { id: "obj_large", marketSize: 90, reputation: 55, sentiment: 55 },
      { id: "obj_elite", marketSize: 75, reputation: 85, sentiment: 85 },
    ] as const;

    for (const archetype of archetypes) {
      let state = boot(archetype.id);
      state = withOps(state, {
        marketSize: archetype.marketSize,
        fanSentiment: archetype.sentiment,
      });
      state = withReputation(state, archetype.reputation);
      if (archetype.id === "obj_elite") {
        state = withFacilityLevels(state, 5);
        state = withHistory(state, [
          seasonRecord({
            year: state.competition.season.year - 1,
            championship: true,
            playoffResult: "champion",
            franchiseValue: 750_000_000,
            fanSentiment: 85,
            reputation: 85,
            facilityLevel: 5,
          }),
        ]);
      }
      const baseline = calculateFranchiseValue(state, teamIdOf(state));
      const target = Math.round(
        baseline * (1 + OWNER_OBJECTIVE_VALUE_GROWTH_PCT / 100),
      );
      expect(baseline).toBeGreaterThan(100_000_000);
      expect(target).toBeGreaterThan(baseline);
      expect(target - baseline).toBeGreaterThan(10_000_000);
      expect(target / baseline).toBeCloseTo(
        1 + OWNER_OBJECTIVE_VALUE_GROWTH_PCT / 100,
        5,
      );
    }
  });
});
