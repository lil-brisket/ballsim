import { getActiveOwnedFranchise } from "@/state/owner-context";
/**
 * Generate immutable annual franchise reports from authoritative season data.
 * Does not import league-sanity.
 */

import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type {
  AnnualFranchiseReport,
  FranchiseTrajectorySection,
  TrajectoryArrow,
  YoYMetric,
} from "@/domain/entities/annual-franchise-report";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { explainFranchiseValue } from "@/state/franchise-value";
import { meanRosterOverall } from "@/state/roster-strength";
import { getFinancialStatement } from "@/systems/team-finances";
import { queryHistoricalMilestones } from "@/systems/historical-milestones";
import { detectFranchiseEras } from "@/systems/franchise-eras";
import { buildFranchiseTrajectoryContext } from "@/systems/franchise-trajectory-context";
import { buildFranchiseNarrative } from "@/systems/franchise-report/narrative";

function yoy(value: number, prior: number | null): YoYMetric {
  if (prior === null) {
    return { value, prior: null, delta: null, deltaPct: null };
  }
  const delta = value - prior;
  const deltaPct = prior === 0 ? null : delta / Math.abs(prior);
  return { value, prior, delta, deltaPct };
}

function arrow(delta: number | null, threshold = 0.02): TrajectoryArrow {
  if (delta === null) return "flat";
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
}

function meanFacility(levels: Record<FacilityCategory, number>): number {
  let sum = 0;
  for (const category of FACILITY_CATEGORIES) {
    sum += levels[category] ?? 1;
  }
  return sum / FACILITY_CATEGORIES.length;
}

function buildTrajectory(
  state: GameState,
  teamId: TeamId,
  winPctDelta: number | null,
  attendanceDeltaPct: number | null,
  facilityDelta: number | null,
  reputationDelta: number | null,
): FranchiseTrajectorySection {
  const traj = buildFranchiseTrajectoryContext(state, teamId);
  const competitive = arrow(
    winPctDelta ??
      (traj && traj.winsVsOwnBaseline !== 0
        ? traj.winsVsOwnBaseline * 0.1
        : null),
  );
  const financial = arrow(
    traj
      ? traj.financialStress > 0.6
        ? -0.1
        : traj.financialStress < 0.3
          ? 0.05
          : 0
      : null,
  );
  const commercial = arrow(
    attendanceDeltaPct ??
      (traj && traj.attendanceVsOwnBaseline !== 0
        ? traj.attendanceVsOwnBaseline * 0.1
        : null),
  );
  const organizational = arrow(facilityDelta);
  const brand = arrow(
    reputationDelta ??
      (traj && traj.sentimentVsOwnBaseline !== 0
        ? traj.sentimentVsOwnBaseline * 0.1
        : null),
  );

  const score =
    (competitive === "up" ? 1 : competitive === "down" ? -1 : 0) +
    (financial === "up" ? 1 : financial === "down" ? -1 : 0) +
    (commercial === "up" ? 1 : commercial === "down" ? -1 : 0) +
    (organizational === "up" ? 1 : organizational === "down" ? -1 : 0) +
    (brand === "up" ? 1 : brand === "down" ? -1 : 0);

  return {
    competitive,
    financial,
    commercial,
    organizational,
    brand,
    overall: score >= 2 ? "positive" : score <= -2 ? "negative" : "neutral",
  };
}

/**
 * Generate an immutable annual report for one team at season end.
 * Requires the current season already appended to franchise history.
 */
export function generateAnnualFranchiseReport(
  state: GameState,
  teamId: TeamId,
  options: { generatedAt?: string } = {},
): AnnualFranchiseReport {
  const history = state.business.franchiseHistory[teamId]?.seasons ?? [];
  const ordered = [...history].sort((a, b) => a.seasonYear - b.seasonYear);
  if (ordered.length === 0) {
    throw new Error(
      `generateAnnualFranchiseReport: no history for "${teamId}".`,
    );
  }
  const current = ordered[ordered.length - 1]!;
  const prior = ordered.length >= 2 ? ordered[ordered.length - 2]! : null;
  const year = current.seasonYear;
  const ops = state.business.franchiseOps[teamId];
  const team = state.world.teams[teamId];
  if (!ops || !team) {
    throw new Error(`generateAnnualFranchiseReport: team "${teamId}" missing.`);
  }

  const statement = getFinancialStatement(state, teamId, year);
  const valueExplain = explainFranchiseValue(state, teamId);
  const games = current.wins + current.losses;
  const winPctValue = games === 0 ? 0 : current.wins / games;
  const priorGames = prior ? prior.wins + prior.losses : 0;
  const priorWinPct =
    prior && priorGames > 0 ? prior.wins / priorGames : null;

  const rosterStrength = meanRosterOverall(state, teamId);
  const facilityMean = meanFacility(current.facilityLevels);
  const priorFacility = prior ? meanFacility(prior.facilityLevels) : null;

  const milestones = queryHistoricalMilestones(ordered);

  const { eras, transitions } = detectFranchiseEras(ordered, {
    foundedSeasonYear: ops.foundedSeasonYear,
  });
  const era = eras.length === 0 ? null : eras[eras.length - 1]!;
  const transitionThisYear = transitions.find((t) => t.seasonYear === year);

  const winPctMetric = yoy(winPctValue, priorWinPct);
  const valueEnding = current.franchiseValue;
  const valueStarting = prior?.franchiseValue ?? null;
  const valueDeltaPct =
    valueStarting !== null && valueStarting !== 0
      ? (valueEnding - valueStarting) / Math.abs(valueStarting)
      : null;

  const attendanceMetric = yoy(
    current.attendance ?? 0,
    prior?.attendance ?? null,
  );
  const facilityMetric = yoy(facilityMean, priorFacility);
  const reputationDelta =
    prior !== null ? current.reputation - prior.reputation : null;

  const draft: Omit<AnnualFranchiseReport, "narrative"> = {
    teamId,
    seasonYear: year,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    competitive: {
      wins: current.wins,
      losses: current.losses,
      winPct: winPctMetric,
      leagueRank: current.leagueRank,
      playoffResult: current.playoffResult,
      championship: current.championship,
      rosterStrength: yoy(rosterStrength, null),
    },
    financial: {
      startingCash: prior?.businessFunds ?? current.businessFunds,
      endingCash: yoy(current.businessFunds, prior?.businessFunds ?? null),
      revenue: yoy(current.revenue, prior?.revenue ?? null),
      expenses: yoy(current.expenses, prior?.expenses ?? null),
      netIncome: yoy(current.netIncome, prior?.netIncome ?? null),
      payroll: yoy(current.payroll, prior?.payroll ?? null),
    },
    commercial: {
      attendance: attendanceMetric,
      ticketPrice: yoy(ops.ticketPrice, null),
      sponsorshipRevenue: yoy(statement.revenue.sponsorships, null),
    },
    organizational: {
      meanFacilityLevel: facilityMetric,
    },
    ownership: {
      patience: getActiveOwnedFranchise(state).ownerPatience,
      completedObjectives: getActiveOwnedFranchise(state).objectives.filter(
        (o) => o.status === "completed" && o.seasonYear === year,
      ).length,
      failedObjectives: getActiveOwnedFranchise(state).objectives.filter(
        (o) => o.status === "failed" && o.seasonYear === year,
      ).length,
      alignmentScore: getActiveOwnedFranchise(state).ownershipConfidence?.alignmentScore ?? null,
    },
    franchiseValue: {
      starting: valueStarting,
      ending: valueEnding,
      deltaPct: valueDeltaPct,
      drivers: { ...valueExplain.components },
      topPositiveDriver: valueExplain.topPositiveDriver,
      topNegativeDriver: valueExplain.topNegativeDriver,
    },
    facilityLevels: { ...current.facilityLevels },
    franchiseTrajectory: buildTrajectory(
      state,
      teamId,
      winPctMetric.delta,
      attendanceMetric.deltaPct,
      facilityMetric.delta,
      reputationDelta,
    ),
    historicalSignificance: milestones.filter(
      (m) => m.status === "achieved" && m.seasonYear === year,
    ),
    era: era
      ? {
          classification: era.classification,
          label: era.label,
          confidence: era.confidence,
          strength: era.strength,
          seasonIndex: year - era.startSeasonYear + 1,
          totalSeasonsInEra:
            (era.endSeasonYear ?? year) - era.startSeasonYear + 1,
          drivers: era.drivers,
          explanation: era.explanation,
        }
      : null,
    eraTransition: {
      occurred: Boolean(transitionThisYear),
      from: transitionThisYear?.from ?? null,
      to: transitionThisYear?.to ?? null,
      message: transitionThisYear?.message ?? null,
    },
  };

  return {
    ...draft,
    narrative: buildFranchiseNarrative(draft),
  };
}

/**
 * Generate and cache annual reports for all teams after history append.
 */
export function generateAndCacheAnnualReports(state: GameState): SystemResult {
  const cache = { ...(state.business.franchiseReportCache ?? {}) };
  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    const history = state.business.franchiseHistory[teamId];
    if (!history || history.seasons.length === 0) {
      continue;
    }
    const year = history.seasons[history.seasons.length - 1]!.seasonYear;
    try {
      const report = generateAnnualFranchiseReport(state, teamId);
      cache[teamId] = {
        ...(cache[teamId] ?? {}),
        [String(year)]: report,
      };
    } catch {
      // Skip teams that cannot generate a report
    }
  }
  return systemResult({
    ...state,
    business: {
      ...state.business,
      franchiseReportCache: cache,
    },
  });
}

export function getCachedAnnualReport(
  state: GameState,
  teamId: TeamId,
  seasonYear?: number,
): AnnualFranchiseReport | null {
  const byTeam = state.business.franchiseReportCache?.[teamId];
  if (!byTeam) {
    return null;
  }
  if (seasonYear !== undefined) {
    return byTeam[String(seasonYear)] ?? null;
  }
  const years = Object.keys(byTeam)
    .map(Number)
    .sort((a, b) => b - a);
  if (years.length === 0) {
    return null;
  }
  return byTeam[String(years[0]!)] ?? null;
}
