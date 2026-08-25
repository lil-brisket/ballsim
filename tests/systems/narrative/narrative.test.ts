import { describe, expect, it } from "vitest";
import { createCblInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import type { NarrativeMonthSnapshot } from "@/domain/entities/narrative-situation";
import { createSeededRng } from "@/domain/rng";
import { createTestRng, TEST_RNG_SEED } from "../../helpers/determinism";
import { detectAttendanceDecline } from "@/systems/narrative/detectors";
import { buildNarrativeContext } from "@/systems/narrative/build-narrative-context";
import { aggregateCandidates } from "@/systems/narrative/aggregation";
import { applySpamFilters, selectDailyStories } from "@/systems/narrative/spam";
import { processNarrativeLayer } from "@/systems/narrative/evaluate-narrative";
import { renderNarrative } from "@/systems/narrative/templates";
import { compareCandidatesForPriority } from "@/systems/narrative/priority";
import type { DetectorCandidate, NarrativeContext } from "@/systems/narrative/types";
import {
  applyNarrativeAction,
  getNarrativeActionDefinition,
} from "@/application/narrative-action-adapter";
import { asNarrativeSituationId } from "@/domain/ids";
import { createNarrativeSituation } from "@/domain/entities/narrative-situation";
import { acknowledgeSituation } from "@/systems/narrative/lifecycle";

function snapshot(
  monthId: string,
  fillRatePct: number,
  extras: Partial<NarrativeMonthSnapshot> = {},
): NarrativeMonthSnapshot {
  return {
    monthId,
    attendanceAvg: Math.round((fillRatePct / 100) * 18_000),
    fillRatePct,
    ticketMerchRevenue: 1_000_000,
    fanSentiment: 50,
    reputation: 50,
    mediaAttention: 30,
    cash: 50_000_000,
    healthBand: "stable",
    wins: 10,
    losses: 10,
    franchiseValue: 400_000_000,
    ...extras,
  };
}

function withSnapshots(
  state: GameState,
  snapshots: NarrativeMonthSnapshot[],
): GameState {
  return {
    ...state,
    user: {
      ...state.user,
      narrative: {
        ...state.user.narrative,
        snapshots,
      },
    },
  };
}

function baseContext(
  state: GameState,
  overrides: Partial<NarrativeContext> = {},
): NarrativeContext {
  const built = buildNarrativeContext(state, { cadence: "monthly" });
  return { ...built, ...overrides };
}

describe("narrative attendance_decline detector", () => {
  it("stays silent with a single-month dip", () => {
    const rng = createTestRng();
    let state = createCblInitialGameState(rng);
    state = withSnapshots(state, [
      snapshot("2026-01", 80),
      snapshot("2026-02", 78),
    ]);
    const context = baseContext(state, {
      consecutiveAttendanceDeclineMonths: 1,
      attendanceDownPctVsPriorMonth: 2.5,
      leagueRelative: {
        ...buildNarrativeContext(state, { cadence: "monthly" }).leagueRelative,
        vsLeagueFillPct: 0,
      },
    });
    expect(detectAttendanceDecline(context)).toBeNull();
  });

  it("triggers after two consecutive declining months when unusual vs league", () => {
    const rng = createTestRng();
    let state = createCblInitialGameState(rng);
    state = withSnapshots(state, [
      snapshot("2026-01", 82),
      snapshot("2026-02", 74),
      snapshot("2026-03", 66),
    ]);
    const context = buildNarrativeContext(state, { cadence: "monthly" });
    expect(context.consecutiveAttendanceDeclineMonths).toBeGreaterThanOrEqual(2);
    const candidate = detectAttendanceDecline({
      ...context,
      leagueRelative: {
        ...context.leagueRelative,
        vsLeagueFillPct: -6,
      },
    });
    expect(candidate).not.toBeNull();
    expect(candidate!.detectorKey).toBe("attendance_decline");
    expect(candidate!.evidence.consecutiveDecliningMonths).toBe(
      context.consecutiveAttendanceDeclineMonths,
    );
  });

  it("does not invent staff belief in facility copy", () => {
    const rendered = renderNarrative({
      detectorKey: "facility_staff_concern",
      kind: "situation",
      category: "facilities",
      stage: 1,
      severity: "notable",
      priorityHint: 60,
      evidence: { vsLeagueFacility: -1 },
      templateContext: {
        vsLeagueFacility: -1,
        facilityMean: 1.5,
        leagueMedianFacility: 2.5,
        losing: true,
        developmentWeak: false,
      },
    });
    expect(rendered.body.toLowerCase()).not.toContain("coaching staff believes");
    expect(rendered.body.toLowerCase()).not.toContain("staff believes");
  });
});

describe("narrative aggregation and priority", () => {
  it("aggregates fan_demand members into one candidate", () => {
    const candidates: DetectorCandidate[] = [
      {
        detectorKey: "attendance_decline",
        kind: "situation",
        category: "fans",
        stage: 2,
        severity: "notable",
        priorityHint: 50,
        evidence: { consecutiveDecliningMonths: 3 },
        templateContext: { consecutiveDecliningMonths: 3 },
        aggregateGroup: "fan_demand",
      },
      {
        detectorKey: "fan_price_friction",
        kind: "situation",
        category: "fans",
        stage: 1,
        severity: "notable",
        priorityHint: 50,
        evidence: { vsLeagueTicketPricePct: 12 },
        templateContext: { vsLeagueTicketPricePct: 12 },
        aggregateGroup: "fan_demand",
      },
      {
        detectorKey: "losing_slide",
        kind: "situation",
        category: "team",
        stage: 1,
        severity: "important",
        priorityHint: 50,
        evidence: { streakLength: 5, attendanceWeak: true },
        templateContext: { streakLength: 5 },
        aggregateGroup: "fan_demand",
      },
    ];
    const aggregated = aggregateCandidates(candidates);
    expect(aggregated.some((c) => c.detectorKey === "fan_demand")).toBe(true);
    expect(aggregated.filter((c) => FAN_KEYS.has(c.detectorKey)).length).toBe(0);
  });

  it("selects at most two stories by deterministic priority", () => {
    const candidates: DetectorCandidate[] = [
      {
        detectorKey: "league_economy_shift",
        kind: "story",
        category: "league",
        stage: 0,
        severity: "informational",
        priorityHint: 80,
        evidence: {},
        templateContext: {},
      },
      {
        detectorKey: "financial_pressure",
        kind: "situation",
        category: "financial",
        stage: 3,
        severity: "critical",
        priorityHint: 5,
        evidence: { healthBand: "critical" },
        templateContext: { healthBand: "critical" },
      },
      {
        detectorKey: "playoff_momentum",
        kind: "situation",
        category: "team",
        stage: 1,
        severity: "notable",
        priorityHint: 45,
        evidence: {},
        templateContext: {},
      },
    ];
    const sorted = [...candidates].sort(compareCandidatesForPriority);
    expect(sorted[0]!.detectorKey).toBe("financial_pressure");
    const selected = selectDailyStories(candidates);
    expect(selected).toHaveLength(2);
    expect(selected[0]!.detectorKey).toBe("financial_pressure");
  });
});

const FAN_KEYS = new Set([
  "attendance_decline",
  "fan_price_friction",
  "losing_slide",
]);

describe("narrative lifecycle and actions", () => {
  it("acknowledge does not resolve", () => {
    const situation = createNarrativeSituation({
      id: asNarrativeSituationId("nar_test_1"),
      detectorKey: "facility_staff_concern",
      category: "facilities",
      severity: "notable",
      status: "active",
      stage: 1,
      title: "Facilities lagging",
      summary: "Behind league",
      body: "Facility investment lags comparable teams.",
      createdOn: "2026-01-01",
      updatedOn: "2026-01-01",
      evidence: { vsLeagueFacility: -1 },
      updates: [],
    });
    const acknowledged = acknowledgeSituation(situation, "2026-01-02");
    expect(acknowledged.status).toBe("acknowledged");
  });

  it("reduce_ticket_price runs setTicketPrice via adapter", () => {
    const rng = createTestRng();
    let state = createCblInitialGameState(rng);
    const teamId = state.user.controlledTeamId;
    const before = state.business.franchiseOps[teamId]!.ticketPrice;
    const situation = createNarrativeSituation({
      id: asNarrativeSituationId("nar_price_1"),
      detectorKey: "fan_price_friction",
      category: "fans",
      severity: "notable",
      status: "active",
      stage: 1,
      title: "Price friction",
      summary: "Fans frustrated",
      body: "Prices elevated.",
      createdOn: "2026-01-01",
      updatedOn: "2026-01-01",
      evidence: { ticketPrice: before },
      updates: [],
      actions: [{ id: "reduce_ticket_price", label: "Lower prices" }],
    });
    state = {
      ...state,
      user: {
        ...state.user,
        narrative: {
          ...state.user.narrative,
          situations: [situation],
        },
      },
    };
    const result = applyNarrativeAction(
      state,
      situation.id,
      "reduce_ticket_price",
    );
    const after =
      result.state.business.franchiseOps[teamId]!.ticketPrice;
    expect(after).toBeLessThan(before);
    const updated = result.state.user.narrative.situations[0]!;
    expect(updated.status).not.toBe("resolved");
  });

  it("unknown actionId throws", () => {
    expect(() => getNarrativeActionDefinition("explode_cash")).toThrow(
      /Unknown narrative actionId/,
    );
  });
});

describe("narrative processNarrativeLayer", () => {
  it("facility_completed emits a story notification without an active situation", () => {
    const rng = createTestRng();
    let state = createCblInitialGameState(rng);
    const teamId = state.user.controlledTeamId;
    const dayEvents = [
      {
        id: "evt_test_facility" as never,
        type: "FacilityUpgradeCompleted" as const,
        occurredOn: state.world.calendar.currentDate,
        payload: { teamId, category: "training", level: 2 },
      },
    ];
    const result = processNarrativeLayer(state, rng, {
      cadences: ["daily", "weekly"],
      dayEvents,
    });
    const narrativeNotifs = result.state.user.notifications.filter(
      (n) => n.type === "narrative",
    );
    expect(
      result.state.user.narrative.situations.some(
        (s) => s.detectorKey === "facility_completed",
      ),
    ).toBe(false);
    // May or may not win the 2/day cap depending on other detectors; if present, it's story-only.
    for (const n of narrativeNotifs) {
      expect(n.dedupeKey).toContain("facility_completed");
    }
  });

  it("is deterministic for the same state and seed", () => {
    const rngA = createSeededRng(TEST_RNG_SEED);
    const rngB = createSeededRng(TEST_RNG_SEED);
    let state = createCblInitialGameState(createTestRng());
    state = withSnapshots(state, [
      snapshot("2026-01", 85, { fanSentiment: 55 }),
      snapshot("2026-02", 72, { fanSentiment: 48 }),
      snapshot("2026-03", 60, { fanSentiment: 40 }),
    ]);
    const a = processNarrativeLayer(state, rngA, {
      cadences: ["monthly"],
      completedMonthId: "2026-03",
    });
    const b = processNarrativeLayer(state, rngB, {
      cadences: ["monthly"],
      completedMonthId: "2026-03",
    });
    expect(a.state.user.narrative.situations.map((s) => s.id)).toEqual(
      b.state.user.narrative.situations.map((s) => s.id),
    );
    expect(
      a.state.user.notifications
        .filter((n) => n.type === "narrative")
        .map((n) => n.dedupeKey),
    ).toEqual(
      b.state.user.notifications
        .filter((n) => n.type === "narrative")
        .map((n) => n.dedupeKey),
    );
  });

  it("spam filter suppresses same-stage reopen", () => {
    const rng = createTestRng();
    let state = createCblInitialGameState(rng);
    const context = buildNarrativeContext(state, { cadence: "monthly" });
    const candidate: DetectorCandidate = {
      detectorKey: "attendance_decline",
      kind: "situation",
      category: "fans",
      stage: 1,
      severity: "notable",
      priorityHint: 50,
      evidence: { consecutiveDecliningMonths: 2 },
      templateContext: {},
    };
    const filtered = applySpamFilters([candidate], {
      ...context,
      openSituationStages: new Map([["attendance_decline", 1]]),
      openDetectorKeys: new Set(["attendance_decline"]),
    });
    expect(filtered).toHaveLength(0);
  });
});

describe("narrative migration", () => {
  it("createInitialGameState includes empty narrative", () => {
    const state = createCblInitialGameState(createTestRng());
    expect(state.user.narrative).toEqual({
      situations: [],
      snapshots: [],
      cooldowns: {},
    });
    expect(state.meta.schemaVersion).toBe(37);
  });
});
