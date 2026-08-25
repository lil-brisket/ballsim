import { describe, expect, it } from "vitest";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { createDomainEvent } from "@/domain/events";
import { createSponsorship } from "@/domain/entities/sponsorship";
import {
  FACILITY_CATEGORIES,
  FACILITY_LEVEL_MAX,
} from "@/domain/entities/franchise-ops";
import {
  asSeasonId,
  asSponsorshipId,
  asTeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { appendEventLog, type GameState } from "@/state/game-state";
import {
  calculateFranchiseHealth,
  statusFromScore,
  type DimensionStatus,
  type FranchiseHealthDimensionKey,
} from "@/state/franchise-health";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";

function bootstrapped(saveId: string): GameState {
  const state = createTestGameState({ saveId });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function setStanding(
  state: GameState,
  wins: number,
  losses: number,
): GameState {
  const teamId = state.user.controlledTeamId;
  const base =
    state.competition.standings.byTeamId[teamId] ??
    createEmptyTeamStanding(asTeamId(teamId));
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        ...state.competition.standings,
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: {
            ...base,
            wins,
            losses,
            winPercentage: wins + losses === 0 ? 0 : wins / (wins + losses),
            streak:
              wins > losses
                ? { type: "W" as const, count: Math.min(wins, 6) }
                : losses > 0
                  ? { type: "L" as const, count: Math.min(losses, 6) }
                  : { type: null, count: 0 },
          },
        },
      },
    },
  };
}

function setCash(state: GameState, cash: number): GameState {
  const teamId = state.user.controlledTeamId;
  const finances = state.business.finances[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: { ...finances, cash },
      },
    },
  };
}

function setFanSentiment(state: GameState, fanSentiment: number): GameState {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, fanSentiment },
      },
    },
  };
}

function setTicketPrice(state: GameState, ticketPrice: number): GameState {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, ticketPrice },
      },
    },
  };
}

function withMaxFacilities(state: GameState): GameState {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId]!;
  const facilities = { ...ops.facilities };
  for (const category of FACILITY_CATEGORIES) {
    facilities[category] = {
      level: FACILITY_LEVEL_MAX,
      upgradeWeeksRemaining: 0,
    };
  }
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, facilities },
      },
    },
  };
}

function withMinFacilities(state: GameState): GameState {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId]!;
  const facilities = { ...ops.facilities };
  for (const category of FACILITY_CATEGORIES) {
    facilities[category] = { level: 1, upgradeWeeksRemaining: 0 };
  }
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, facilities },
      },
    },
  };
}

function withActiveSponsorship(state: GameState): GameState {
  const teamId = state.user.controlledTeamId;
  const id = asSponsorshipId(`sponsor_${teamId}_health`);
  const sponsorship = createSponsorship({
    id,
    teamId,
    sponsorName: "Health Test Bank",
    annualValue: 3_000_000,
    startYear: state.competition.season.year,
    endYear: state.competition.season.year + 2,
    reputationFloor: 40,
    playoffBonus: 100_000,
    status: "active",
  });
  return {
    ...state,
    business: {
      ...state.business,
      sponsorships: {
        ...state.business.sponsorships,
        [id]: sponsorship,
      },
    },
  };
}

function appendHomeGame(
  state: GameState,
  attendance: number,
  capacity: number,
  occurredOn: string,
): GameState {
  const teamId = state.user.controlledTeamId;
  const event = createDomainEvent({
    type: "HomeGameDaySettled",
    occurredOn,
    payload: {
      teamId,
      gameId: `game_${occurredOn}_${attendance}`,
      attendance,
      gaAttendance: attendance,
      premiumOccupancy: 0,
      capacity,
      premiumCapacity: 0,
      demandScore: Math.round((attendance / capacity) * 100),
      ticketPrice: state.business.franchiseOps[teamId]!.ticketPrice,
      premiumTicketPrice:
        state.business.franchiseOps[teamId]!.premiumTicketPrice,
      ticketRevenue: attendance * 45,
      premiumRevenue: 0,
      merchRevenue: 10_000,
      concessionsRevenue: 12_000,
    },
  });
  return appendEventLog(state, [event]);
}

function withSnapshots(
  state: GameState,
  snapshots: GameState["user"]["narrative"]["snapshots"],
): GameState {
  return {
    ...state,
    user: {
      ...state.user,
      narrative: {
        ...state.user.narrative,
        snapshots: [...snapshots],
      },
    },
  };
}

function assertBounds(view: ReturnType<typeof calculateFranchiseHealth>): void {
  const keys: FranchiseHealthDimensionKey[] = [
    "competitive",
    "financial",
    "commercial",
    "fan",
    "organizational",
    "strategic",
  ];
  for (const key of keys) {
    const dim = view.dimensions[key];
    expect(dim.score).toBeGreaterThanOrEqual(0);
    expect(dim.score).toBeLessThanOrEqual(100);
    // Financial status follows liquidity SSOT bands, not score thresholds alone.
    if (key !== "financial") {
      expect(dim.status).toBe(statusFromScore(dim.score));
    }
  }
}

describe("calculateFranchiseHealth", () => {
  it("is pure, deterministic, and does not mutate state", () => {
    const state = bootstrapped("health_pure");
    const before = deepClone(state);
    const a = calculateFranchiseHealth(state);
    const b = calculateFranchiseHealth(state);
    expect(a).toEqual(b);
    expect(state).toEqual(before);
    assertBounds(a);
  });

  it("returns provisional competitive score with no games", () => {
    const state = bootstrapped("health_new");
    const view = calculateFranchiseHealth(state);
    expect(view.dimensions.competitive.confidence).not.toBe("high");
    expect(view.dimensions.competitive.trend).toBeNull();
    expect(
      view.dimensions.competitive.drivers.some((d) => d.key === "no_games"),
    ).toBe(true);
  });

  it("scores a strong competitive record higher than a weak one", () => {
    const base = bootstrapped("health_comp");
    const strong = calculateFranchiseHealth(setStanding(base, 28, 8));
    const weak = calculateFranchiseHealth(setStanding(base, 8, 28));
    expect(strong.dimensions.competitive.score).toBeGreaterThan(
      weak.dimensions.competitive.score,
    );
    expect(strong.dimensions.competitive.score).toBeGreaterThanOrEqual(65);
    expect(weak.dimensions.competitive.score).toBeLessThan(45);
  });

  it("keeps financial status aligned with liquidity SSOT bands", () => {
    let state = bootstrapped("health_fin");
    state = setCash(state, 80_000_000);
    const healthy = calculateFranchiseHealth(state);
    expect(["excellent", "strong"]).toContain(
      healthy.dimensions.financial.status,
    );

    state = setCash(bootstrapped("health_fin_broke"), 0);
    const insolvent = calculateFranchiseHealth(state);
    expect(insolvent.dimensions.financial.status).toBe("critical");
    expect(insolvent.dimensions.financial.score).toBeLessThan(30);
    expect(
      insolvent.dimensions.financial.drivers.some(
        (d) => d.key === "liquidity_band",
      ),
    ).toBe(true);
  });

  it("raises commercial score with fill and sponsorship; lowers without", () => {
    let strong = bootstrapped("health_comm_s");
    strong = withActiveSponsorship(strong);
    strong = appendHomeGame(strong, 18_000, 20_000, "2026-11-05");
    strong = appendHomeGame(strong, 19_000, 20_000, "2026-11-12");

    let weak = bootstrapped("health_comm_w");
    weak = appendHomeGame(weak, 6_000, 20_000, "2026-11-05");

    const strongView = calculateFranchiseHealth(strong);
    const weakView = calculateFranchiseHealth(weak);
    expect(strongView.dimensions.commercial.score).toBeGreaterThan(
      weakView.dimensions.commercial.score,
    );
    expect(
      weakView.dimensions.commercial.drivers.some(
        (d) => d.key === "no_sponsorship",
      ),
    ).toBe(true);
  });

  it("uses fan sentiment primarily and flags elevated ticket prices", () => {
    let happy = setFanSentiment(bootstrapped("health_fan_h"), 82);
    let unhappy = setFanSentiment(bootstrapped("health_fan_u"), 28);
    // Raise only controlled team price far above league mean.
    unhappy = setTicketPrice(unhappy, 120);

    const happyView = calculateFranchiseHealth(happy);
    const unhappyView = calculateFranchiseHealth(unhappy);
    expect(happyView.dimensions.fan.score).toBeGreaterThan(
      unhappyView.dimensions.fan.score,
    );
    expect(
      unhappyView.dimensions.fan.drivers.some(
        (d) => d.key === "ticket_affordability",
      ),
    ).toBe(true);
  });

  it("scores organizational health from facilities and staff coverage", () => {
    const strong = withMaxFacilities(bootstrapped("health_org_s"));
    const weak = withMinFacilities(bootstrapped("health_org_w"));
    // Strip starter staff from weak org.
    const teamId = weak.user.controlledTeamId;
    const stripped: GameState = {
      ...weak,
      world: {
        ...weak.world,
        staff: Object.fromEntries(
          Object.entries(weak.world.staff).map(([id, member]) => [
            id,
            member.teamId === teamId ? { ...member, teamId: null } : member,
          ]),
        ),
      },
    };

    const strongView = calculateFranchiseHealth(strong);
    const weakView = calculateFranchiseHealth(stripped);
    expect(strongView.dimensions.organizational.score).toBeGreaterThan(
      weakView.dimensions.organizational.score,
    );
    expect(
      weakView.dimensions.organizational.drivers.some(
        (d) => d.key === "role_coverage",
      ),
    ).toBe(true);
  });

  it("does not penalize strategic score solely for relocation context", () => {
    let state = bootstrapped("health_reloc");
    const teamId = state.user.controlledTeamId;
    const existing = state.business.relocationByTeamId[teamId];
    if (existing) {
      state = {
        ...state,
        business: {
          ...state.business,
          relocationByTeamId: {
            ...state.business.relocationByTeamId,
            [teamId]: { ...existing, stage: "evaluate" },
          },
        },
      };
    }
    const withReloc = calculateFranchiseHealth(state);
    const without = calculateFranchiseHealth(bootstrapped("health_reloc_ctrl"));
    // Scores should be close; relocation may add a contextual driver only.
    expect(
      Math.abs(
        withReloc.dimensions.strategic.score -
          without.dimensions.strategic.score,
      ),
    ).toBeLessThanOrEqual(5);
    if (existing) {
      expect(
        withReloc.dimensions.strategic.drivers.some(
          (d) => d.key === "relocation_context",
        ),
      ).toBe(true);
    }
  });

  it("returns null trends without history and derives trends from snapshots", () => {
    const bare = calculateFranchiseHealth(bootstrapped("health_trend_bare"));
    expect(bare.dimensions.fan.trend).toBeNull();
    expect(bare.dimensions.commercial.trend).toBeNull();

    let state = bootstrapped("health_trend");
    state = withSnapshots(state, [
      {
        monthId: "2026-10",
        attendanceAvg: 12000,
        fillRatePct: 60,
        ticketMerchRevenue: 500_000,
        fanSentiment: 40,
        reputation: 50,
        mediaAttention: 30,
        cash: 40_000_000,
        healthBand: "stable",
        wins: 4,
        losses: 8,
        franchiseValue: 200_000_000,
      },
      {
        monthId: "2026-11",
        attendanceAvg: 15000,
        fillRatePct: 78,
        ticketMerchRevenue: 700_000,
        fanSentiment: 58,
        reputation: 52,
        mediaAttention: 40,
        cash: 42_000_000,
        healthBand: "healthy",
        wins: 12,
        losses: 10,
        franchiseValue: 220_000_000,
      },
    ]);
    const view = calculateFranchiseHealth(state);
    expect(view.dimensions.fan.trend).toMatch(/improving/);
    expect(view.dimensions.commercial.trend).toMatch(/improving/);
    expect(view.dimensions.financial.trend).toMatch(/improving/);
  });

  it("exposes biggest strength/risk, summary, and primary driver without overall score", () => {
    let state = setStanding(bootstrapped("health_summary"), 30, 5);
    state = setFanSentiment(state, 80);
    state = setCash(state, 500_000);
    const view = calculateFranchiseHealth(state);
    expect(view.condition).toBeTruthy();
    expect(view.summary.length).toBeGreaterThan(20);
    expect(view.biggestStrength).not.toBeNull();
    expect(view.biggestRisk).not.toBeNull();
    expect(view).not.toHaveProperty("overall");
    expect(
      Object.keys(view.dimensions).sort(),
    ).toEqual(
      [
        "commercial",
        "competitive",
        "fan",
        "financial",
        "organizational",
        "strategic",
      ].sort(),
    );
  });

  it("includes negative drivers when a dimension is concerning or critical", () => {
    const state = setFanSentiment(bootstrapped("health_drivers"), 22);
    const view = calculateFranchiseHealth(state);
    const fan = view.dimensions.fan;
    if (fan.status === "concerning" || fan.status === "critical") {
      expect(fan.drivers.some((d) => d.direction === "negative")).toBe(true);
    }
  });

  it("handles winning team with poor cash and losing team with strong cash", () => {
    let winningBroke = setStanding(bootstrapped("win_broke"), 25, 10);
    winningBroke = setCash(winningBroke, 0);
    let losingRich = setStanding(bootstrapped("lose_rich"), 8, 25);
    losingRich = setCash(losingRich, 100_000_000);

    const a = calculateFranchiseHealth(winningBroke);
    const b = calculateFranchiseHealth(losingRich);
    expect(a.dimensions.competitive.score).toBeGreaterThan(
      b.dimensions.competitive.score,
    );
    expect(a.dimensions.financial.score).toBeLessThan(
      b.dimensions.financial.score,
    );
  });

  it("wires into owner dashboard health", () => {
    const state = bootstrapped("health_dash");
    const dash = toOwnerDashboardView(state);
    expect(dash.health.franchiseHealth).toBeDefined();
    expect(dash.health.franchiseHealth.dimensions.financial.score).toBeGreaterThanOrEqual(
      0,
    );
    expect(typeof dash.health.cash).toBe("number");
    expect(typeof dash.health.fanSentiment).toBe("number");
    expect(dash.health.financialHealth).toBeTruthy();
  });

  it("statusFromScore bands are consistent", () => {
    const cases: Array<[number, DimensionStatus]> = [
      [95, "excellent"],
      [70, "strong"],
      [50, "adequate"],
      [35, "concerning"],
      [10, "critical"],
    ];
    for (const [score, status] of cases) {
      expect(statusFromScore(score)).toBe(status);
    }
  });

  it("documents season history gap with low strategic confidence when no seasons", () => {
    const state = bootstrapped("health_hist_gap");
    const view = calculateFranchiseHealth(state);
    expect(view.dimensions.strategic.confidence).toBe("low");
    expect(
      view.dimensions.strategic.drivers.some((d) => d.key === "no_season_history"),
    ).toBe(true);
  });

  it("uses prior season franchise value for strategic trajectory when history exists", () => {
    let state = bootstrapped("health_hist");
    const teamId = state.user.controlledTeamId;
    const seasonId = asSeasonId("season_2025");
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseHistory: {
          ...state.business.franchiseHistory,
          [teamId]: {
            teamId: asTeamId(teamId),
            seasons: [
              {
                seasonId,
                seasonYear: 2025,
                wins: 40,
                losses: 42,
                playoffResult: "missed",
                championship: false,
                revenue: 50_000_000,
                expenses: 45_000_000,
                netIncome: 5_000_000,
                payroll: 40_000_000,
                leagueRank: 15,
                attendance: 400_000,
                cash: 30_000_000,
                fanSentiment: 50,
                reputation: 50,
                facilityLevels: Object.fromEntries(
                  FACILITY_CATEGORIES.map((c) => [c, 2]),
                ) as Record<(typeof FACILITY_CATEGORIES)[number], number>,
                relocated: false,
                city: "Test",
                name: "Team",
                notableEventIds: [],
                franchiseValue: 150_000_000,
              },
            ],
          },
        },
      },
    };
    const view = calculateFranchiseHealth(state);
    expect(view.dimensions.strategic.confidence).not.toBe("low");
    expect(
      view.dimensions.strategic.drivers.some(
        (d) => d.key === "franchise_value_yoy",
      ),
    ).toBe(true);
  });
});
