import { describe, expect, it } from "vitest";
import { createNarrativeSituation } from "@/domain/entities/narrative-situation";
import { asNarrativeSituationId, asTeamId } from "@/domain/ids";
import { addCalendarDays } from "@/domain/calendar-date";
import type { NarrativeContext } from "@/systems/narrative/types";
import {
  ATTENDANCE_TO_SPONSOR_DAYS,
  detectMediaOwnershipPressure,
  detectSponsorVisibilityConcern,
  enrichAttendanceDeclineActions,
  SPONSOR_TO_MEDIA_DAYS,
} from "@/systems/narrative/attendance-crisis-chain";
import { applyNarrativeAction } from "@/application/narrative-action-adapter";
import { createTestGameState } from "../../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import { processNarrativeLayer } from "@/systems/narrative/evaluate-narrative";

function baseNarrativeContext(
  overrides: Partial<NarrativeContext> = {},
): NarrativeContext {
  return {
    date: "2026-03-01",
    monthId: "2026-03",
    teamId: asTeamId("team_1"),
    cadence: "monthly",
    dayEvents: [],
    snapshots: [],
    consecutiveAttendanceDeclineMonths: 3,
    consecutiveAttendanceRiseMonths: 0,
    attendanceDownPctVsPriorMonth: 8,
    sentimentChangeVsPriorMonth: -6,
    ticketMerchChangeVsPriorMonth: -5,
    franchiseValueChangePctVsPriorMonth: -2,
    currentFillPctEstimate: 72,
    currentFanSentiment: 35,
    currentMediaAttention: 28,
    currentReputation: 45,
    currentTicketPrice: 62,
    currentMarketingBudget: 1_500_000,
    currentCash: 40_000_000,
    healthBand: "stable",
    runwayWeeks: 18,
    streakKind: "L",
    streakLength: 6,
    wins: 18,
    losses: 32,
    winPct: 0.36,
    playoffQualified: false,
    facilityMean: 2,
    leagueRelative: {
      attendanceFillPct: 72,
      leagueMeanFillPct: 80,
      vsLeagueFillPct: -8,
      ticketPrice: 62,
      leagueMeanTicketPrice: 48,
      vsLeagueTicketPricePct: 29,
      payroll: 100_000_000,
      leagueMeanPayroll: 110_000_000,
      vsLeaguePayrollPct: -9,
      facilityMean: 2,
      leagueMedianFacility: 2.5,
      vsLeagueFacility: -0.5,
      franchiseValue: 800_000_000,
      leagueMeanFranchiseValue: 900_000_000,
      vsLeagueFranchiseValuePct: -11,
      winPct: 0.36,
      conferenceMeanWinPct: 0.5,
      vsConferenceWinPct: -0.14,
      mediaAttention: 28,
      leagueMeanMedia: 40,
      vsLeagueMedia: -12,
    },
    objectives: [],
    priorSeasonWins: 35,
    priorSeasonLosses: 47,
    priorSeasonPlayoff: "missed",
    leaguePopularity: 50,
    leagueBroadcast: 50,
    sponsorshipClimate: 45,
    priorLeaguePopularity: 50,
    openDetectorKeys: new Set(),
    openSituationStages: new Map(),
    cooldowns: {},
    notificationDedupeKeys: new Set(),
    ...overrides,
  };
}

function openSituation(
  detectorKey: string,
  createdOn: string,
  stage = 1,
) {
  return createNarrativeSituation({
    id: asNarrativeSituationId(`nar_${detectorKey}_test`),
    detectorKey,
    category: detectorKey.includes("sponsor")
      ? "sponsors"
      : detectorKey.includes("media")
        ? "media"
        : "fans",
    severity: "notable",
    status: "active",
    stage,
    title: "Test",
    summary: "Test summary",
    body: "Test body",
    createdOn,
    updatedOn: createdOn,
    evidence: {},
    updates: [],
  });
}

describe("attendance crisis chain", () => {
  it("does not escalate to sponsor before the inaction window", () => {
    const createdOn = "2026-02-20";
    const context = baseNarrativeContext({ date: "2026-03-01" });
    const situations = [openSituation("attendance_decline", createdOn)];
    const daysOpen =
      (Date.parse(context.date) - Date.parse(createdOn)) / 86_400_000;
    expect(daysOpen).toBeLessThan(ATTENDANCE_TO_SPONSOR_DAYS);
    expect(detectSponsorVisibilityConcern(context, situations)).toBeNull();
  });

  it("escalates to sponsor concern after ignored attendance decline", () => {
    const createdOn = addCalendarDays("2026-03-01", -ATTENDANCE_TO_SPONSOR_DAYS);
    const context = baseNarrativeContext({ date: "2026-03-01" });
    const situations = [openSituation("attendance_decline", createdOn)];
    const candidate = detectSponsorVisibilityConcern(context, situations);
    expect(candidate).not.toBeNull();
    expect(candidate!.detectorKey).toBe("sponsor_visibility_concern");
    expect(candidate!.actions?.some((a) => a.id === "increase_marketing")).toBe(
      true,
    );
    expect(
      candidate!.actions?.every((a) => a.effectSummary !== undefined),
    ).toBe(true);
  });

  it("escalates to media pressure after ignored sponsor concern", () => {
    const sponsorCreated = addCalendarDays(
      "2026-03-01",
      -SPONSOR_TO_MEDIA_DAYS,
    );
    const attendanceCreated = addCalendarDays(
      sponsorCreated,
      -ATTENDANCE_TO_SPONSOR_DAYS,
    );
    const context = baseNarrativeContext({ date: "2026-03-01" });
    const situations = [
      openSituation("attendance_decline", attendanceCreated),
      openSituation("sponsor_visibility_concern", sponsorCreated),
    ];
    const candidate = detectMediaOwnershipPressure(context, situations);
    expect(candidate).not.toBeNull();
    expect(candidate!.detectorKey).toBe("media_ownership_pressure");
    expect(candidate!.severity).toBe("critical");
  });

  it("resolves sponsor concern when attendance recovers", () => {
    const context = baseNarrativeContext({
      consecutiveAttendanceDeclineMonths: 0,
      consecutiveAttendanceRiseMonths: 2,
      attendanceDownPctVsPriorMonth: -4,
      sentimentChangeVsPriorMonth: 4,
    });
    const situations = [
      openSituation("sponsor_visibility_concern", "2026-01-01"),
    ];
    const candidate = detectSponsorVisibilityConcern(context, situations);
    expect(candidate?.resolve).toBe(true);
  });

  it("enriches attendance actions with effect summaries and expiry", () => {
    const enriched = enrichAttendanceDeclineActions({
      detectorKey: "attendance_decline",
      kind: "situation",
      category: "fans",
      stage: 1,
      severity: "notable",
      priorityHint: 50,
      evidence: {},
      templateContext: {},
      actions: [{ id: "reduce_ticket_price", label: "Lower" }],
    });
    expect(enriched.expiresAfterDays).toBeGreaterThan(0);
    expect(enriched.actions?.[0]?.effectSummary).toBeTruthy();
  });

  it("reduce_ticket_price mutates real ticket pricing", () => {
    let state = createTestGameState({ saveId: "chain_action" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    const before =
      state.business.franchiseOps[teamId]?.ticketPrice ?? 45;
    const situation = openSituation(
      "attendance_decline",
      state.world.calendar.currentDate,
    );
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
      result.state.business.franchiseOps[teamId]?.ticketPrice ?? before;
    expect(after).toBeLessThan(before);
  });

  it("does not spam duplicate sponsor situations in one evaluation", () => {
    let state = createTestGameState({ saveId: "chain_spam" });
    let rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    rng = createSeededRng(state.meta.rngState);
    const createdOn = addCalendarDays(
      state.world.calendar.currentDate,
      -ATTENDANCE_TO_SPONSOR_DAYS,
    );
    const attendance = openSituation("attendance_decline", createdOn, 2);
    state = {
      ...state,
      user: {
        ...state.user,
        narrative: {
          ...state.user.narrative,
          situations: [attendance],
          snapshots: [
            {
              monthId: "2026-01",
              attendanceAvg: 18000,
              fillRatePct: 88,
              ticketMerchRevenue: 5_000_000,
              fanSentiment: 50,
              reputation: 50,
              mediaAttention: 40,
              cash: 50_000_000,
              healthBand: "stable",
              wins: 10,
              losses: 10,
              franchiseValue: 800_000_000,
            },
            {
              monthId: "2026-02",
              attendanceAvg: 16000,
              fillRatePct: 78,
              ticketMerchRevenue: 4_200_000,
              fanSentiment: 42,
              reputation: 48,
              mediaAttention: 32,
              cash: 48_000_000,
              healthBand: "stable",
              wins: 14,
              losses: 20,
              franchiseValue: 790_000_000,
            },
            {
              monthId: "2026-03",
              attendanceAvg: 14500,
              fillRatePct: 70,
              ticketMerchRevenue: 3_800_000,
              fanSentiment: 35,
              reputation: 45,
              mediaAttention: 28,
              cash: 45_000_000,
              healthBand: "stable",
              wins: 18,
              losses: 32,
              franchiseValue: 770_000_000,
            },
          ],
        },
      },
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [state.user.controlledTeamId]: {
            ...state.business.franchiseOps[state.user.controlledTeamId]!,
            ticketPrice: 65,
            fanSentiment: 35,
            mediaAttention: 28,
          },
        },
      },
    };

    const once = processNarrativeLayer(state, rng, {
      cadences: ["monthly"],
    });
    const sponsorCount = once.state.user.narrative.situations.filter(
      (s) =>
        s.detectorKey === "sponsor_visibility_concern" &&
        (s.status === "active" ||
          s.status === "acknowledged" ||
          s.status === "escalated"),
    ).length;
    expect(sponsorCount).toBeLessThanOrEqual(1);

    const twice = processNarrativeLayer(once.state, rng, {
      cadences: ["monthly"],
    });
    const sponsorCount2 = twice.state.user.narrative.situations.filter(
      (s) =>
        s.detectorKey === "sponsor_visibility_concern" &&
        (s.status === "active" ||
          s.status === "acknowledged" ||
          s.status === "escalated"),
    ).length;
    expect(sponsorCount2).toBeLessThanOrEqual(1);
  });
});
