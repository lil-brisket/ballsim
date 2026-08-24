/**
 * Strategic posture engine — organizational direction vs ownership expectations.
 * This is the heart of ownership strategic friction (weighted above individual decisions).
 */

import type {
  AlignmentEvidence,
  StrategicReversal,
} from "@/domain/entities/ownership-confidence";
import type {
  CompetitiveStance,
  ExpectationRealityGap,
  FinancialStance,
  MarketStance,
  OwnershipExpectations,
  RosterStance,
} from "@/domain/entities/ownership-expectations";
import {
  competitiveStanceLabel,
  rosterStanceLabel,
} from "@/domain/entities/ownership-expectations";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  meanRosterAge,
  meanRosterOverall,
  youngRosterSharePct,
} from "@/state/roster-strength";
import { buildFranchiseContext } from "@/systems/franchise-ai-context";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import { getTeamPayroll } from "@/systems/salary-cap";
import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";

export type StrategicPostureSnapshot = {
  averageAge: number;
  youngSharePct: number;
  rotationUnder25: number;
  establishedStars: number;
  rosterStrength: number;
  draftAssetCount: number;
  payroll: number;
  cash: number;
  awareness: number;
  fanSentiment: number;
  reputation: number;
  meanFacilityLevel: number;
  winsPace: number;
};

export type StrategicPostureDelta = {
  current: StrategicPostureSnapshot;
  prior: StrategicPostureSnapshot | null;
  ageDelta: number;
  youngShareDelta: number;
  draftAssetDelta: number;
  payrollDeltaPct: number;
  awarenessDelta: number;
  facilityDelta: number;
  narrativeSummary: string;
};

export type PostureEvaluation = {
  expectations: OwnershipExpectations;
  observedCompetitive: CompetitiveStance;
  observedRoster: RosterStance;
  observedFinancial: FinancialStance;
  observedMarket: MarketStance;
  gap: ExpectationRealityGap;
  posture: StrategicPostureDelta;
  evidence: AlignmentEvidence[];
  reversal: StrategicReversal | null;
};

function snapshotPosture(state: GameState, teamId: TeamId): StrategicPostureSnapshot {
  const ctx = buildFranchiseContext(state, teamId);
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  const seasonYear = state.competition.season.year;
  const payroll = getTeamPayroll(teamId, seasonYear, state);

  let rotationUnder25 = 0;
  let establishedStars = 0;
  if (team) {
    const ranked = team.roster
      .map((id) => state.world.players[id])
      .filter((p): p is NonNullable<typeof p> => p != null)
      .sort(
        (a, b) =>
          calculatePlayerOverall(b.position, b.attributes) -
          calculatePlayerOverall(a.position, a.attributes),
      );
    for (const player of ranked.slice(0, 8)) {
      if (player.age < 25) {
        rotationUnder25 += 1;
      }
      if (calculatePlayerOverall(player.position, player.attributes) >= 78) {
        establishedStars += 1;
      }
    }
  }

  let meanFacilityLevel = 1;
  if (ops) {
    const levels = FACILITY_CATEGORIES.map((c) => ops.facilities[c]?.level ?? 1);
    meanFacilityLevel =
      levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length);
  }

  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const winsPace =
    games >= 10
      ? Math.round((wins / games) * 82)
      : (state.business.franchiseHistory[teamId]?.seasons.at(-1)?.wins ?? 35);

  return {
    averageAge: meanRosterAge(state, teamId),
    youngSharePct: youngRosterSharePct(state, teamId),
    rotationUnder25,
    establishedStars,
    rosterStrength: meanRosterOverall(state, teamId),
    draftAssetCount: ctx?.draftAssetCount ?? 0,
    payroll,
    cash: ctx?.cash ?? 0,
    awareness: ops?.marketing.awareness ?? 40,
    fanSentiment: ops?.fanSentiment ?? 50,
    reputation: team?.reputation ?? 50,
    meanFacilityLevel,
    winsPace,
  };
}

function priorSnapshotFromHistory(
  state: GameState,
  teamId: TeamId,
  current: StrategicPostureSnapshot,
): StrategicPostureSnapshot | null {
  const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
  if (seasons.length === 0) {
    return null;
  }
  const last = seasons[seasons.length - 1]!;
  const levels = FACILITY_CATEGORIES.map((c) => last.facilityLevels[c] ?? 1);
  const meanFacilityLevel =
    levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length);
  return {
    averageAge: current.averageAge, // history lacks age — delta treated as 0 until seasons accumulate
    youngSharePct: current.youngSharePct,
    rotationUnder25: current.rotationUnder25,
    establishedStars: current.establishedStars,
    rosterStrength: current.rosterStrength,
    draftAssetCount: current.draftAssetCount,
    payroll: current.payroll,
    cash: last.cash,
    awareness: current.awareness,
    fanSentiment: last.fanSentiment,
    reputation: last.reputation,
    meanFacilityLevel,
    winsPace: last.wins,
  };
}

function observeCompetitive(winsPace: number): CompetitiveStance {
  if (winsPace < 30) {
    return "rebuild";
  }
  if (winsPace < 40) {
    return "develop";
  }
  if (winsPace < 50) {
    return "compete";
  }
  return "contend";
}

function observeRoster(current: StrategicPostureSnapshot): RosterStance {
  if (current.youngSharePct >= 48 || current.rotationUnder25 >= 4) {
    return "youth_focus";
  }
  if (current.establishedStars >= 2 && current.averageAge >= 27.5) {
    return "win_now_roster";
  }
  return "balanced";
}

function observeFinancial(
  current: StrategicPostureSnapshot,
  prior: StrategicPostureSnapshot | null,
): FinancialStance {
  const payrollDeltaPct =
    prior && prior.payroll > 0
      ? (current.payroll - prior.payroll) / prior.payroll
      : 0;
  if (current.cash < 8_000_000 || payrollDeltaPct > 0.18) {
    return "preserve_cash";
  }
  if (payrollDeltaPct > 0.06) {
    return "invest";
  }
  return "sustainable";
}

function observeMarket(current: StrategicPostureSnapshot, facilityDelta: number): MarketStance {
  if (current.awareness < 40 || current.fanSentiment < 40) {
    return facilityDelta > 0.2 || current.awareness < 35
      ? "aggressive_growth"
      : "grow";
  }
  if (facilityDelta > 0.15 || current.awareness >= 55) {
    return "grow";
  }
  return "maintain";
}

function stanceAligned<T extends string>(expected: T, observed: T): boolean {
  return expected === observed;
}

function competitiveNear(expected: CompetitiveStance, observed: CompetitiveStance): boolean {
  const order: CompetitiveStance[] = ["rebuild", "develop", "compete", "contend"];
  return Math.abs(order.indexOf(expected) - order.indexOf(observed)) <= 1;
}

function buildGapSummary(
  expectations: OwnershipExpectations,
  observedCompetitive: CompetitiveStance,
  observedRoster: RosterStance,
): string {
  if (
    (expectations.competitiveExpectation === "compete" ||
      expectations.competitiveExpectation === "contend") &&
    (observedCompetitive === "rebuild" || observedRoster === "youth_focus")
  ) {
    return `Ownership expects ${competitiveStanceLabel(expectations.competitiveExpectation)}, but recent moves suggest a rebuild.`;
  }
  if (
    expectations.competitiveExpectation === "rebuild" &&
    (observedCompetitive === "contend" || observedRoster === "win_now_roster")
  ) {
    return "Ownership expected a development window, but the franchise is pushing toward immediate contention.";
  }
  if (
    expectations.rosterBuildingExpectation === "youth_focus" &&
    observedRoster === "win_now_roster"
  ) {
    return "Ownership wants youth development, but roster construction has skewed toward veterans.";
  }
  return `Ownership expects ${competitiveStanceLabel(expectations.competitiveExpectation)}; the franchise is operating toward ${competitiveStanceLabel(observedCompetitive)}.`;
}

function buildPostureNarrative(delta: Omit<StrategicPostureDelta, "narrativeSummary">): string {
  const parts: string[] = [];
  if (Math.abs(delta.ageDelta) >= 0.8) {
    parts.push(
      `average roster age ${delta.ageDelta < 0 ? "fell" : "rose"} ${Math.abs(delta.ageDelta).toFixed(1)} years`,
    );
  }
  if (Math.abs(delta.draftAssetDelta) >= 2) {
    parts.push(
      delta.draftAssetDelta > 0
        ? `added ${delta.draftAssetDelta} future draft assets`
        : `moved ${Math.abs(delta.draftAssetDelta)} draft assets`,
    );
  }
  if (Math.abs(delta.payrollDeltaPct) >= 0.08) {
    parts.push(
      `payroll ${delta.payrollDeltaPct > 0 ? "increased" : "decreased"} ${Math.round(Math.abs(delta.payrollDeltaPct) * 100)}%`,
    );
  }
  if (Math.abs(delta.awarenessDelta) >= 4) {
    parts.push(
      `brand awareness ${delta.awarenessDelta > 0 ? "improved" : "slipped"}`,
    );
  }
  if (parts.length === 0) {
    return "Franchise posture has remained relatively stable.";
  }
  return `Over the recent period, ${parts.join(" while ")}.`;
}

function detectReversal(
  state: GameState,
  expectations: OwnershipExpectations,
  observedRoster: RosterStance,
  observedCompetitive: CompetitiveStance,
): StrategicReversal | null {
  const prior = state.user.ownershipConfidence.lastReversal;
  const priorNote = state.user.ownershipConfidence.seasonNotes.at(-1);
  const priorDirection =
    priorNote?.mandateSummary.includes("youth") ||
    priorNote?.mandateSummary.includes("development") ||
    priorNote?.mandateSummary.includes("rebuild")
      ? "youth_focus"
      : prior?.priorDirection;

  // Detect shift from youth/rebuild toward contention roster.
  if (
    (expectations.philosophy === "build_for_the_future" ||
      expectations.competitiveExpectation === "develop" ||
      expectations.competitiveExpectation === "compete") &&
    observedRoster === "win_now_roster" &&
    (observedCompetitive === "compete" || observedCompetitive === "contend")
  ) {
    const summary =
      "We've shifted decisively from development toward immediate contention. Ownership supports the change, but expects the roster to produce results.";
    if (prior?.summary === summary && prior.acknowledged) {
      return null;
    }
    return {
      priorDirection: priorDirection ?? "youth_focus",
      newDirection: "win_now_roster",
      acknowledged: false,
      summary,
      occurredOn: state.world.calendar.currentDate,
    };
  }

  // Detect shift from contention toward rebuild.
  if (
    (expectations.competitiveExpectation === "compete" ||
      expectations.competitiveExpectation === "contend") &&
    (observedCompetitive === "rebuild" || observedRoster === "youth_focus")
  ) {
    const summary =
      "We entered the season expecting contention, but recent moves suggest the organization is moving toward a rebuild.";
    if (prior?.summary === summary && prior.acknowledged) {
      return null;
    }
    return {
      priorDirection: "win_now_roster",
      newDirection: "youth_focus",
      acknowledged: false,
      summary,
      occurredOn: state.world.calendar.currentDate,
    };
  }

  return null;
}

/**
 * Evaluate strategic posture against living ownership expectations.
 */
export function evaluateStrategicPosture(
  state: GameState,
  teamId: TeamId = state.user.controlledTeamId,
): PostureEvaluation {
  const expectations = buildOwnershipExpectations(state, teamId);
  const current = snapshotPosture(state, teamId);
  const prior = priorSnapshotFromHistory(state, teamId, current);

  const ageDelta = prior ? current.averageAge - prior.averageAge : 0;
  const youngShareDelta = prior ? current.youngSharePct - prior.youngSharePct : 0;
  const draftAssetDelta = prior
    ? current.draftAssetCount - prior.draftAssetCount
    : 0;
  const payrollDeltaPct =
    prior && prior.payroll > 0
      ? (current.payroll - prior.payroll) / prior.payroll
      : 0;
  const awarenessDelta = prior ? current.awareness - prior.awareness : 0;
  const facilityDelta = prior
    ? current.meanFacilityLevel - prior.meanFacilityLevel
    : 0;

  const postureBase = {
    current,
    prior,
    ageDelta,
    youngShareDelta,
    draftAssetDelta,
    payrollDeltaPct,
    awarenessDelta,
    facilityDelta,
  };
  const posture: StrategicPostureDelta = {
    ...postureBase,
    narrativeSummary: buildPostureNarrative(postureBase),
  };

  const observedCompetitive = observeCompetitive(current.winsPace);
  const observedRoster = observeRoster(current);
  const observedFinancial = observeFinancial(current, prior);
  const observedMarket = observeMarket(current, facilityDelta);

  const competitiveAligned = competitiveNear(
    expectations.competitiveExpectation,
    observedCompetitive,
  );
  const rosterAligned = stanceAligned(
    expectations.rosterBuildingExpectation,
    observedRoster,
  );
  // Soften exact roster match: balanced tolerates either neighbor.
  const rosterSoft =
    rosterAligned ||
    expectations.rosterBuildingExpectation === "balanced" ||
    observedRoster === "balanced";

  const financialAligned =
    expectations.financialExpectation === observedFinancial ||
    (expectations.financialExpectation === "sustainable" &&
      observedFinancial !== "preserve_cash") ||
    (expectations.financialExpectation === "invest" &&
      observedFinancial !== "preserve_cash");

  const marketAligned =
    expectations.marketExpectation === observedMarket ||
    (expectations.marketExpectation === "maintain" &&
      observedMarket !== "aggressive_growth") ||
    (expectations.marketExpectation === "grow" &&
      observedMarket !== "maintain");

  const overallAligned =
    competitiveAligned && rosterSoft && financialAligned && marketAligned;

  const gap: ExpectationRealityGap = {
    competitive: {
      expected: expectations.competitiveExpectation,
      observed: observedCompetitive,
      aligned: competitiveAligned,
    },
    rosterBuilding: {
      expected: expectations.rosterBuildingExpectation,
      observed: observedRoster,
      aligned: rosterSoft,
    },
    financial: {
      expected: expectations.financialExpectation,
      observed: observedFinancial,
      aligned: financialAligned,
    },
    market: {
      expected: expectations.marketExpectation,
      observed: observedMarket,
      aligned: marketAligned,
    },
    overallAligned,
    summary: buildGapSummary(expectations, observedCompetitive, observedRoster),
  };

  const date = state.world.calendar.currentDate;
  const evidence: AlignmentEvidence[] = [];

  evidence.push({
    id: `posture_${date}`,
    occurredOn: date,
    kind: "posture",
    significance: overallAligned ? "meaningful" : "major",
    direction: overallAligned ? "aligned" : "conflicting",
    summary: posture.narrativeSummary,
    detail: gap.summary,
    dimension: "overall",
  });

  if (!competitiveAligned) {
    evidence.push({
      id: `posture_comp_${date}`,
      occurredOn: date,
      kind: "posture",
      significance: "meaningful",
      direction: "conflicting",
      summary: `Competitive posture (${competitiveStanceLabel(observedCompetitive)}) diverges from ownership expectation (${competitiveStanceLabel(expectations.competitiveExpectation)})`,
      dimension: "competitive",
    });
  } else {
    evidence.push({
      id: `posture_comp_ok_${date}`,
      occurredOn: date,
      kind: "posture",
      significance: "meaningful",
      direction: "aligned",
      summary: `Competitive trajectory supports ${competitiveStanceLabel(expectations.competitiveExpectation)}`,
      dimension: "competitive",
    });
  }

  if (!rosterSoft) {
    evidence.push({
      id: `posture_roster_${date}`,
      occurredOn: date,
      kind: "posture",
      significance: "meaningful",
      direction: "conflicting",
      summary: `Roster construction (${rosterStanceLabel(observedRoster)}) conflicts with ${rosterStanceLabel(expectations.rosterBuildingExpectation)}`,
      dimension: "roster",
    });
  }

  const reversal = detectReversal(
    state,
    expectations,
    observedRoster,
    observedCompetitive,
  );
  if (reversal) {
    evidence.push({
      id: `reversal_${date}`,
      occurredOn: date,
      kind: "reversal",
      significance: "major",
      direction: "neutral",
      summary: reversal.summary,
      dimension: "overall",
    });
  }

  return {
    expectations,
    observedCompetitive,
    observedRoster,
    observedFinancial,
    observedMarket,
    gap,
    posture,
    evidence,
    reversal,
  };
}
