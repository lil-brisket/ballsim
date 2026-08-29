import { getActiveOwnedFranchise } from "@/state/owner-context";
/**
 * Franchise Health — derived analytical lens over GameState.
 *
 * Read-only. Does not persist scores, mutate simulation, or feed back into
 * attendance / sentiment / finances / franchise value.
 *
 * Scoring methodology (evidence-driven, not blind weighted averages):
 *
 * Competitive — Band primarily on win% once enough games exist; adjust within
 *   band for roster quality vs league and injury load. Playoff race is a small
 *   late-season modifier only. Do not stack win% + standings + race (correlated).
 *
 * Financial — Map authoritative FinancialHealthState to a score band, then apply
 *   small trajectory nudges (profitability, burn) that stay inside that band so
 *   we never contradict the liquidity SSOT.
 *
 * Commercial — Market monetization: fill/realization, sponsorship income signal,
 *   forecast gate yield. Attendance = utilization, not fan affection.
 *
 * Fan — Relationship: fanSentiment is primary (already blends wins/media/etc.).
 *   Ticket affordability and attendance *trend* are secondary behavioral signals.
 *   Do not re-score wins (would double-count sentiment inputs).
 *
 * Organizational — Staff quality, starter role coverage, facility investment.
 *   Turnover is not treated as instability.
 *
 * Strategic — Sustainable future vs ownership objectives: alignment (objectives +
 *   patience), future assets (young roster), trajectory (value vs prior season).
 *   Relocation is contextual driver only — never an automatic score penalty.
 *
 * Trends — Prefer narrative month snapshots and season history when present;
 *   otherwise trend = null. Do not invent history.
 *
 * Follow-ups: narrative health-shift detectors (V1.1); decision projections (V2).
 * History gaps: no mid-season staff/facility snapshots → Organizational trend
 * often null until a prior season record exists.
 */

import {
  FACILITY_CATEGORIES,
  FACILITY_LEVEL_MAX,
} from "@/domain/entities/franchise-ops";
import type { NarrativeMonthSnapshot } from "@/domain/entities/narrative-situation";
import type { TeamId } from "@/domain/ids";
import { asTeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  toFacilitiesView,
  toFranchiseBusinessView,
  toStaffView,
  type FranchiseBusinessView,
} from "@/state/franchise-selectors";
import {
  readAttendanceRealization,
} from "@/state/franchise-value";
import {
  meanRosterOverall,
  youngRosterSharePct,
} from "@/state/roster-strength";
import { getFinancialStatement } from "@/systems/team-finances";
import type { FinancialHealthState } from "@/systems/financial-health";
import { STARTER_ROLES } from "@/systems/staff-generation";
import {
  getCalendarContext,
  type PlayoffRaceStatus,
} from "@/systems/simulation/calendar-context";
import { TICKET_PRICE_MAX, TICKET_PRICE_MIN } from "@/systems/ticket-pricing";
import { toRosterView } from "@/state/selectors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DimensionStatus =
  | "excellent"
  | "strong"
  | "adequate"
  | "concerning"
  | "critical";

export type DimensionTrend =
  | "strongly_improving"
  | "improving"
  | "stable"
  | "declining"
  | "strongly_declining";

export type HealthConfidence = "low" | "medium" | "high";

export type HealthDriver = {
  key: string;
  direction: "positive" | "negative";
  impact: "major" | "moderate" | "minor";
  label: string;
  explanation: string;
};

export type DimensionHealth = {
  score: number;
  status: DimensionStatus;
  trend: DimensionTrend | null;
  confidence: HealthConfidence;
  drivers: HealthDriver[];
};

export type FranchiseHealthDimensionKey =
  | "competitive"
  | "financial"
  | "commercial"
  | "fan"
  | "organizational"
  | "strategic";

export type FranchiseHealthView = {
  /** Qualitative top-line — not a numeric overall score. */
  condition: DimensionStatus;
  summary: string;
  dimensions: Record<FranchiseHealthDimensionKey, DimensionHealth>;
  biggestStrength: { dimension: FranchiseHealthDimensionKey; label: string } | null;
  biggestRisk: { dimension: FranchiseHealthDimensionKey; label: string } | null;
  primaryDriver: string | null;
};

const DIMENSION_LABELS: Record<FranchiseHealthDimensionKey, string> = {
  competitive: "Competitive",
  financial: "Financial",
  commercial: "Commercial",
  fan: "Fan",
  organizational: "Organizational",
  strategic: "Strategic",
};

const DIMENSION_KEYS: FranchiseHealthDimensionKey[] = [
  "competitive",
  "financial",
  "commercial",
  "fan",
  "organizational",
  "strategic",
];

/** Minimum regular-season games before competitive band is high-confidence. */
const COMPETITIVE_MIN_GAMES = 10;
const COMPETITIVE_FORM_GAMES = 5;

/**
 * Financial SSOT → score midpoints. Trajectory nudges stay within ±band half-width
 * so status never contradicts calculateFinancialHealth.
 */
const FINANCIAL_BAND: Record<
  FinancialHealthState,
  { mid: number; halfWidth: number }
> = {
  healthy: { mid: 88, halfWidth: 10 },
  stable: { mid: 70, halfWidth: 8 },
  warning: { mid: 48, halfWidth: 10 },
  critical: { mid: 28, halfWidth: 10 },
  insolvent: { mid: 8, halfWidth: 8 },
};

const HEALTH_BAND_ORDER: Record<string, number> = {
  insolvent: 0,
  critical: 1,
  warning: 2,
  stable: 3,
  healthy: 4,
};

/** Snapshot metric deltas for trend (sentiment / fill / win% points). */
const TREND_SOFT = 4;
const TREND_STRONG = 10;
/** Franchise value YoY % for strategic trend. */
const VALUE_TREND_SOFT_PCT = 5;
const VALUE_TREND_STRONG_PCT = 12;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure Franchise Health view for the controlled team.
 * Composes existing selectors; does not reimplement demand, valuation, or SSOT health.
 */
export function calculateFranchiseHealth(state: GameState): FranchiseHealthView {
  const teamId = asTeamId(state.user.activeOwnerTeamId);
  const business = toFranchiseBusinessView(state);
  const year = state.competition.season.year;
  const statement = getFinancialStatement(state, teamId, year);
  const calendar = getCalendarContext(state);
  const snapshots = getActiveOwnedFranchise(state).narrative.snapshots;
  const history = state.business.franchiseHistory[teamId]?.seasons ?? [];

  const competitive = scoreCompetitive(state, teamId, calendar.playoffRace, snapshots);
  const financial = scoreFinancial(state, teamId, business, statement.netIncome, snapshots);
  const commercial = scoreCommercial(state, teamId, business, snapshots);
  const fan = scoreFan(state, teamId, business, snapshots);
  const organizational = scoreOrganizational(state, history);
  const strategic = scoreStrategic(state, teamId, business, snapshots, history);

  const dimensions: FranchiseHealthView["dimensions"] = {
    competitive,
    financial,
    commercial,
    fan,
    organizational,
    strategic,
  };

  const biggestStrength = pickExtreme(dimensions, "high");
  const biggestRisk = pickExtreme(dimensions, "low");
  const condition = deriveCondition(dimensions);
  const summary = buildSummary(condition, dimensions, biggestStrength, biggestRisk);
  const primaryDriver = buildPrimaryDriver(dimensions, biggestStrength, biggestRisk);

  return {
    condition,
    summary,
    dimensions,
    biggestStrength,
    biggestRisk,
    primaryDriver,
  };
}

export function statusFromScore(score: number): DimensionStatus {
  if (score >= 80) {
    return "excellent";
  }
  if (score >= 65) {
    return "strong";
  }
  if (score >= 45) {
    return "adequate";
  }
  if (score >= 30) {
    return "concerning";
  }
  return "critical";
}

export function formatDimensionStatus(status: DimensionStatus): string {
  switch (status) {
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "adequate":
      return "Adequate";
    case "concerning":
      return "Concerning";
    case "critical":
      return "Critical";
  }
}

export function trendSymbol(trend: DimensionTrend | null): string {
  if (trend === "strongly_improving" || trend === "improving") {
    return "↑";
  }
  if (trend === "strongly_declining" || trend === "declining") {
    return "↓";
  }
  if (trend === "stable") {
    return "→";
  }
  return "";
}

// ---------------------------------------------------------------------------
// Competitive
// ---------------------------------------------------------------------------

function scoreCompetitive(
  state: GameState,
  teamId: TeamId,
  playoffRace: PlayoffRaceStatus,
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionHealth {
  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const drivers: HealthDriver[] = [];

  let confidence: HealthConfidence =
    games >= COMPETITIVE_MIN_GAMES ? "high" : games >= 3 ? "medium" : "low";

  // Primary band: win percentage once games exist; neutral mid before that.
  let score: number;
  if (games === 0) {
    score = 50;
    drivers.push({
      key: "no_games",
      direction: "positive",
      impact: "minor",
      label: "Season not underway",
      explanation:
        "No games played yet — competitive score is provisional until a record forms.",
    });
  } else {
    const winPct = wins / games;
    // Band: .200 → ~25, .500 → 55, .700 → 78, .850 → 90 (not a raw 0–100 map).
    score = clamp(Math.round(18 + winPct * 85), 5, 95);
    drivers.push({
      key: "record",
      direction: winPct >= 0.5 ? "positive" : "negative",
      impact: winPct >= 0.65 || winPct <= 0.35 ? "major" : "moderate",
      label: `${wins}–${losses} record`,
      explanation: `Winning percentage is ${(winPct * 100).toFixed(1)}% (${wins}–${losses}).`,
    });
  }

  // Roster quality vs league — adjustment, not a second primary axis.
  const strength = meanRosterOverall(state, teamId);
  const leagueMean = meanLeagueStrength(state);
  if (leagueMean !== null && games > 0) {
    const delta = strength - leagueMean;
    if (delta >= 4) {
      score = clamp(score + 6, 0, 100);
      drivers.push({
        key: "roster_strength",
        direction: "positive",
        impact: "moderate",
        label: "Roster above league",
        explanation: `Mean roster overall (${strength.toFixed(1)}) is well above the league mean (${leagueMean.toFixed(1)}).`,
      });
    } else if (delta <= -4) {
      score = clamp(score - 6, 0, 100);
      drivers.push({
        key: "roster_strength",
        direction: "negative",
        impact: "moderate",
        label: "Roster below league",
        explanation: `Mean roster overall (${strength.toFixed(1)}) trails the league mean (${leagueMean.toFixed(1)}).`,
      });
    }
  }

  // Injuries — soft penalty when multiple players unavailable.
  const injured = toRosterView(state).filter((p) => p.injuryKind !== "healthy");
  if (injured.length >= 3) {
    score = clamp(score - 5, 0, 100);
    drivers.push({
      key: "injuries",
      direction: "negative",
      impact: injured.length >= 5 ? "major" : "moderate",
      label: "Injury load",
      explanation: `${injured.length} roster players are currently injured.`,
    });
  }

  // Late-season race: small modifier only (correlated with record — keep tiny).
  if (games >= COMPETITIVE_MIN_GAMES) {
    if (playoffRace === "clinched" || playoffRace === "contending") {
      score = clamp(score + 3, 0, 100);
      drivers.push({
        key: "playoff_race",
        direction: "positive",
        impact: "minor",
        label: "Playoff position",
        explanation: `Playoff race status is ${playoffRace.replaceAll("_", " ")}.`,
      });
    } else if (playoffRace === "eliminated") {
      score = clamp(score - 3, 0, 100);
      drivers.push({
        key: "playoff_race",
        direction: "negative",
        impact: "minor",
        label: "Eliminated from race",
        explanation: "The team is eliminated from playoff contention.",
      });
    }
  }

  // Recent form as driver + trend signal (not primary score weight).
  const form = lastNResults(state, teamId, COMPETITIVE_FORM_GAMES);
  if (form.length >= 3) {
    const formWins = form.filter((r) => r === "W").length;
    if (formWins >= form.length - 1) {
      drivers.push({
        key: "recent_form",
        direction: "positive",
        impact: "moderate",
        label: "Strong recent form",
        explanation: `Won ${formWins} of the last ${form.length} games.`,
      });
    } else if (formWins <= 1) {
      drivers.push({
        key: "recent_form",
        direction: "negative",
        impact: "moderate",
        label: "Poor recent form",
        explanation: `Won only ${formWins} of the last ${form.length} games.`,
      });
    }
  }

  const streak = standing?.streak;
  if (streak && streak.count >= 5) {
    drivers.push({
      key: "streak",
      direction: streak.type === "W" ? "positive" : "negative",
      impact: "major",
      label: streak.type === "W" ? "Winning streak" : "Losing streak",
      explanation: `Current ${streak.type} streak of ${streak.count} games.`,
    });
  }

  const trend = trendFromWinPctSnapshots(snapshots);
  if (confidence === "low") {
    // Suppress strong trend claims with sparse data.
    return finalizeDimension(score, trend && trend !== "stable" ? null : trend, confidence, drivers);
  }
  return finalizeDimension(score, trend, confidence, drivers);
}

function lastNResults(
  state: GameState,
  teamId: TeamId,
  n: number,
): ("W" | "L")[] {
  const results: ("W" | "L")[] = [];
  const games = Object.values(state.competition.games)
    .filter(
      (g) =>
        g.status === "final" &&
        (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
        g.score.home !== g.score.away,
    )
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.id.localeCompare(b.id);
    });
  for (let i = games.length - 1; i >= 0 && results.length < n; i -= 1) {
    const game = games[i]!;
    const isHome = game.homeTeamId === teamId;
    const won = isHome
      ? game.score.home > game.score.away
      : game.score.away > game.score.home;
    results.push(won ? "W" : "L");
  }
  return results.reverse();
}

function trendFromWinPctSnapshots(
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionTrend | null {
  if (snapshots.length < 2) {
    return null;
  }
  const prior = snapshots[snapshots.length - 2]!;
  const latest = snapshots[snapshots.length - 1]!;
  const priorGames = prior.wins + prior.losses;
  const latestGames = latest.wins + latest.losses;
  if (priorGames < 3 || latestGames < 3) {
    return null;
  }
  const priorPct = (prior.wins / priorGames) * 100;
  const latestPct = (latest.wins / latestGames) * 100;
  return trendFromDelta(latestPct - priorPct, TREND_SOFT, TREND_STRONG);
}

// ---------------------------------------------------------------------------
// Financial
// ---------------------------------------------------------------------------

function scoreFinancial(
  state: GameState,
  teamId: TeamId,
  business: FranchiseBusinessView,
  netIncome: number,
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionHealth {
  const health = business.cashRunway.health;
  const band = FINANCIAL_BAND[health];
  const drivers: HealthDriver[] = [];

  drivers.push({
    key: "liquidity_band",
    direction:
      health === "healthy" || health === "stable" ? "positive" : "negative",
    impact:
      health === "insolvent" || health === "critical"
        ? "major"
        : health === "warning"
          ? "moderate"
          : "minor",
    label: `Liquidity ${health}`,
    explanation: `Authoritative financial health classification is ${health}.`,
  });

  // Trajectory nudges stay inside the SSOT band.
  let nudge = 0;
  const runway = business.cashRunway;

  if (netIncome > 0) {
    nudge += 4;
    drivers.push({
      key: "profitability",
      direction: "positive",
      impact: "moderate",
      label: "Season profitable",
      explanation: `Season-to-date net income is positive (${formatMoney(netIncome)}).`,
    });
  } else if (netIncome < 0) {
    nudge -= 4;
    drivers.push({
      key: "profitability",
      direction: "negative",
      impact: "moderate",
      label: "Season loss",
      explanation: `Season-to-date net income is negative (${formatMoney(netIncome)}).`,
    });
  }

  if (runway.netWeeklyBurn > 0 && runway.runwayWeeks !== null) {
    if (runway.runwayWeeks <= 8) {
      nudge -= 5;
      drivers.push({
        key: "runway",
        direction: "negative",
        impact: "major",
        label: "Short cash runway",
        explanation: `About ${runway.runwayWeeks} weeks of runway at current net burn.`,
      });
    } else if (runway.runwayWeeks <= 16) {
      nudge -= 2;
      drivers.push({
        key: "runway",
        direction: "negative",
        impact: "minor",
        label: "Moderate runway",
        explanation: `About ${runway.runwayWeeks} weeks of runway while burning cash weekly.`,
      });
    }
  } else if (runway.netWeeklyBurn < 0) {
    nudge += 3;
    drivers.push({
      key: "cash_surplus",
      direction: "positive",
      impact: "moderate",
      label: "Weekly cash surplus",
      explanation: "Net weekly cash flow is positive.",
    });
  }

  const score = clamp(
    Math.round(band.mid + clamp(nudge, -band.halfWidth, band.halfWidth)),
    0,
    100,
  );

  // Force status alignment with SSOT classification (not statusFromScore alone).
  const status = financialStatusFromHealth(health);
  const trend = trendFromFinancialSnapshots(snapshots);
  const confidence: HealthConfidence =
    snapshots.length >= 2 ? "high" : "medium";

  return {
    score,
    status,
    trend,
    confidence,
    drivers: sortDrivers(drivers),
  };
}

function financialStatusFromHealth(health: FinancialHealthState): DimensionStatus {
  switch (health) {
    case "healthy":
      return "excellent";
    case "stable":
      return "strong";
    case "warning":
      return "concerning";
    case "critical":
      return "critical";
    case "insolvent":
      return "critical";
  }
}

function trendFromFinancialSnapshots(
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionTrend | null {
  if (snapshots.length < 2) {
    return null;
  }
  const prior = snapshots[snapshots.length - 2]!;
  const latest = snapshots[snapshots.length - 1]!;
  const priorOrd = HEALTH_BAND_ORDER[prior.healthBand];
  const latestOrd = HEALTH_BAND_ORDER[latest.healthBand];
  if (priorOrd === undefined || latestOrd === undefined) {
    // Fall back to cash delta.
    if (prior.cash <= 0) {
      return null;
    }
    const cashPct = ((latest.cash - prior.cash) / Math.abs(prior.cash)) * 100;
    return trendFromDelta(cashPct, VALUE_TREND_SOFT_PCT, VALUE_TREND_STRONG_PCT);
  }
  const bandDelta = latestOrd - priorOrd;
  if (bandDelta >= 2) {
    return "strongly_improving";
  }
  if (bandDelta === 1) {
    return "improving";
  }
  if (bandDelta === 0) {
    if (prior.cash <= 0) {
      return "stable";
    }
    const cashPct = ((latest.cash - prior.cash) / Math.abs(prior.cash)) * 100;
    return trendFromDelta(cashPct, VALUE_TREND_SOFT_PCT, VALUE_TREND_STRONG_PCT);
  }
  if (bandDelta === -1) {
    return "declining";
  }
  return "strongly_declining";
}

// ---------------------------------------------------------------------------
// Commercial
// ---------------------------------------------------------------------------

function scoreCommercial(
  state: GameState,
  teamId: TeamId,
  business: FranchiseBusinessView,
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionHealth {
  const drivers: HealthDriver[] = [];
  const realization = readAttendanceRealization(state, teamId);
  const hasSettledHome = business.lastGameDay !== null;
  const fillPct = hasSettledHome
    ? business.lastGameDay!.fillRatePct
    : Math.round(realization * 100);

  // Utilization band from realization / fill (monetization of capacity).
  let score = clamp(Math.round(realization * 100), 0, 100);
  let confidence: HealthConfidence = hasSettledHome
    ? "high"
    : snapshots.some((s) => s.fillRatePct > 0)
      ? "medium"
      : "low";

  if (hasSettledHome) {
    drivers.push({
      key: "fill_rate",
      direction: fillPct >= 70 ? "positive" : fillPct < 55 ? "negative" : "positive",
      impact: fillPct >= 85 || fillPct < 50 ? "major" : "moderate",
      label: `Arena fill ${fillPct}%`,
      explanation: `Last home fill rate was ${fillPct}% (market realization ${(realization * 100).toFixed(0)}%).`,
    });
    if (fillPct < 55) {
      score = clamp(score - 5, 0, 100);
    } else if (fillPct >= 90) {
      score = clamp(score + 4, 0, 100);
    }
  } else {
    drivers.push({
      key: "no_home_games",
      direction: "positive",
      impact: "minor",
      label: "No settled home games",
      explanation:
        "Commercial utilization uses default market realization until home games settle.",
    });
  }

  // Sponsorship revenue signal (active deals).
  const year = state.competition.season.year;
  const activeSponsors = Object.values(state.business.sponsorships).filter(
    (s) =>
      s.teamId === teamId &&
      s.status === "active" &&
      s.startYear <= year &&
      s.endYear >= year,
  );
  const sponsorAnnual = activeSponsors.reduce((sum, s) => sum + s.annualValue, 0);
  if (activeSponsors.length === 0) {
    score = clamp(score - 8, 0, 100);
    drivers.push({
      key: "no_sponsorship",
      direction: "negative",
      impact: "moderate",
      label: "No active sponsorship",
      explanation: "There is no active sponsorship deal contributing commercial revenue.",
    });
  } else {
    score = clamp(score + 6, 0, 100);
    drivers.push({
      key: "sponsorship",
      direction: "positive",
      impact: sponsorAnnual >= 2_000_000 ? "major" : "moderate",
      label: "Active sponsorships",
      explanation: `${activeSponsors.length} active deal${activeSponsors.length === 1 ? "" : "s"} totaling ${formatMoney(sponsorAnnual)}/yr.`,
    });
  }

  // Forecast gate yield vs capacity — efficiency signal, not fan sentiment.
  const forecast = business.forecast;
  if (forecast.capacity > 0 && forecast.totalGameDayRevenue > 0) {
    const revPerSeat = forecast.totalGameDayRevenue / forecast.capacity;
    if (revPerSeat >= 45) {
      score = clamp(score + 4, 0, 100);
      drivers.push({
        key: "gate_yield",
        direction: "positive",
        impact: "minor",
        label: "Strong projected gate yield",
        explanation: `Forecast revenue per seat is about $${revPerSeat.toFixed(0)}.`,
      });
    } else if (revPerSeat < 25) {
      score = clamp(score - 4, 0, 100);
      drivers.push({
        key: "gate_yield",
        direction: "negative",
        impact: "minor",
        label: "Soft projected gate yield",
        explanation: `Forecast revenue per seat is about $${revPerSeat.toFixed(0)}.`,
      });
    }
  }

  if (business.mediaAttention >= 70) {
    drivers.push({
      key: "media",
      direction: "positive",
      impact: "minor",
      label: "Elevated media attention",
      explanation: `Media attention is ${business.mediaAttention} (supports sponsorship leverage in the sim).`,
    });
    score = clamp(score + 2, 0, 100);
  }

  const trend = trendFromFillSnapshots(snapshots);
  return finalizeDimension(score, trend, confidence, drivers);
}

function trendFromFillSnapshots(
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionTrend | null {
  if (snapshots.length < 2) {
    return null;
  }
  const prior = snapshots[snapshots.length - 2]!;
  const latest = snapshots[snapshots.length - 1]!;
  if (prior.fillRatePct <= 0 && latest.fillRatePct <= 0) {
    return null;
  }
  return trendFromDelta(
    latest.fillRatePct - prior.fillRatePct,
    TREND_SOFT,
    TREND_STRONG,
  );
}

// ---------------------------------------------------------------------------
// Fan
// ---------------------------------------------------------------------------

function scoreFan(
  state: GameState,
  teamId: TeamId,
  business: FranchiseBusinessView,
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionHealth {
  const drivers: HealthDriver[] = [];
  // Sentiment is the primary relationship stock (already blends results/media).
  let score = clamp(business.fanSentiment, 0, 100);

  drivers.push({
    key: "fan_sentiment",
    direction: business.fanSentiment >= 55 ? "positive" : "negative",
    impact:
      business.fanSentiment >= 75 || business.fanSentiment <= 35
        ? "major"
        : "moderate",
    label: `Fan sentiment ${business.fanSentiment}`,
    explanation: `Current fan sentiment stock is ${business.fanSentiment}.`,
  });

  // Reputation as brand relationship (secondary).
  const reputation = business.reputation;
  if (reputation >= 70) {
    score = clamp(score + 4, 0, 100);
    drivers.push({
      key: "reputation",
      direction: "positive",
      impact: "minor",
      label: "Strong reputation",
      explanation: `Franchise reputation is ${reputation}.`,
    });
  } else if (reputation <= 35) {
    score = clamp(score - 4, 0, 100);
    drivers.push({
      key: "reputation",
      direction: "negative",
      impact: "moderate",
      label: "Weak reputation",
      explanation: `Franchise reputation is ${reputation}.`,
    });
  }

  // Affordability — price vs league (relationship friction), not commercial yield.
  const leagueMeanTicket = meanValidTicketPrices(state);
  if (leagueMeanTicket !== null && leagueMeanTicket > 0) {
    const vsLeague =
      ((business.ticketPrice - leagueMeanTicket) / leagueMeanTicket) * 100;
    if (vsLeague >= 15) {
      score = clamp(score - 6, 0, 100);
      drivers.push({
        key: "ticket_affordability",
        direction: "negative",
        impact: vsLeague >= 25 ? "major" : "moderate",
        label: "Elevated ticket prices",
        explanation: `Ticket price is ${Math.round(vsLeague)}% above the league average.`,
      });
    } else if (vsLeague <= -10) {
      score = clamp(score + 3, 0, 100);
      drivers.push({
        key: "ticket_affordability",
        direction: "positive",
        impact: "minor",
        label: "Accessible ticket pricing",
        explanation: `Ticket price is ${Math.abs(Math.round(vsLeague))}% below the league average.`,
      });
    }
  }

  // Attendance trend as behavioral signal (not fill-as-monetization).
  const attendanceTrend = attendanceTrendFromHomeGames(state, teamId);
  if (attendanceTrend !== null) {
    if (attendanceTrend < -8) {
      score = clamp(score - 5, 0, 100);
      drivers.push({
        key: "attendance_behavior",
        direction: "negative",
        impact: "moderate",
        label: "Attendance declining",
        explanation: `Home attendance is down ${Math.abs(Math.round(attendanceTrend))}% versus the prior home game.`,
      });
    } else if (attendanceTrend > 8) {
      score = clamp(score + 4, 0, 100);
      drivers.push({
        key: "attendance_behavior",
        direction: "positive",
        impact: "moderate",
        label: "Attendance rising",
        explanation: `Home attendance is up ${Math.round(attendanceTrend)}% versus the prior home game.`,
      });
    }
  }

  const trend = trendFromSentimentSnapshots(snapshots);
  const confidence: HealthConfidence =
    snapshots.length >= 2 ? "high" : "medium";
  return finalizeDimension(score, trend, confidence, drivers);
}

function trendFromSentimentSnapshots(
  snapshots: readonly NarrativeMonthSnapshot[],
): DimensionTrend | null {
  if (snapshots.length < 2) {
    return null;
  }
  const prior = snapshots[snapshots.length - 2]!;
  const latest = snapshots[snapshots.length - 1]!;
  return trendFromDelta(
    latest.fanSentiment - prior.fanSentiment,
    TREND_SOFT,
    TREND_STRONG,
  );
}

function attendanceTrendFromHomeGames(
  state: GameState,
  teamId: TeamId,
): number | null {
  const days: number[] = [];
  for (const event of getActiveOwnedFranchise(state).eventLog) {
    if (event.type !== "HomeGameDaySettled") {
      continue;
    }
    if (event.payload.teamId !== teamId) {
      continue;
    }
    const attendance = Number(event.payload.attendance) || 0;
    days.push(attendance);
  }
  if (days.length < 2) {
    return null;
  }
  const prior = days[days.length - 2]!;
  const latest = days[days.length - 1]!;
  if (prior <= 0) {
    return null;
  }
  return ((latest - prior) / prior) * 100;
}

// ---------------------------------------------------------------------------
// Organizational
// ---------------------------------------------------------------------------

function scoreOrganizational(
  state: GameState,
  history: readonly { facilityLevels: Record<string, number> }[],
): DimensionHealth {
  const drivers: HealthDriver[] = [];
  const staff = toStaffView(state);
  const facilities = toFacilitiesView(state);

  const overalls = staff.roster.map((m) => m.overall);
  const meanQuality =
    overalls.length > 0
      ? overalls.reduce((a, b) => a + b, 0) / overalls.length
      : 40;

  const filledRoles = new Set(staff.roster.map((m) => m.role));
  const vacant = STARTER_ROLES.filter((role) => !filledRoles.has(role));
  const coveragePct =
    ((STARTER_ROLES.length - vacant.length) / STARTER_ROLES.length) * 100;

  const meanFacility =
    facilities.length > 0
      ? facilities.reduce((sum, f) => sum + f.level, 0) / facilities.length
      : 1;
  const facilityScore = (meanFacility / FACILITY_LEVEL_MAX) * 100;

  // Hybrid: quality primary, coverage and facilities as structural modifiers.
  let score = clamp(
    Math.round(meanQuality * 0.55 + coveragePct * 0.25 + facilityScore * 0.2),
    0,
    100,
  );

  drivers.push({
    key: "staff_quality",
    direction: meanQuality >= 60 ? "positive" : "negative",
    impact: meanQuality >= 75 || meanQuality < 45 ? "major" : "moderate",
    label: `Staff quality ${Math.round(meanQuality)}`,
    explanation: `Mean employed staff quality is ${meanQuality.toFixed(0)}.`,
  });

  if (vacant.length > 0) {
    score = clamp(score - vacant.length * 4, 0, 100);
    drivers.push({
      key: "role_coverage",
      direction: "negative",
      impact: vacant.length >= 2 ? "major" : "moderate",
      label: "Vacant starter roles",
      explanation: `Missing starter role${vacant.length === 1 ? "" : "s"}: ${vacant.join(", ")}.`,
    });
  } else {
    drivers.push({
      key: "role_coverage",
      direction: "positive",
      impact: "moderate",
      label: "Full starter staff",
      explanation: "All starter organizational roles are filled.",
    });
  }

  drivers.push({
    key: "facilities",
    direction: meanFacility >= 3.5 ? "positive" : meanFacility <= 2 ? "negative" : "positive",
    impact: meanFacility >= 4 || meanFacility <= 1.5 ? "major" : "minor",
    label: `Facilities L${meanFacility.toFixed(1)}`,
    explanation: `Mean facility level is ${meanFacility.toFixed(1)} of ${FACILITY_LEVEL_MAX}.`,
  });

  // Contract coverage for employed staff.
  const withoutContract = staff.roster.filter((m) => m.annualSalary === null);
  if (withoutContract.length > 0) {
    drivers.push({
      key: "staff_contracts",
      direction: "negative",
      impact: "minor",
      label: "Staff without active contracts",
      explanation: `${withoutContract.length} staff member${withoutContract.length === 1 ? "" : "s"} lack an active salary contract.`,
    });
    score = clamp(score - 3, 0, 100);
  }

  const trend = trendFromFacilityHistory(history, meanFacility);
  const confidence: HealthConfidence =
    staff.roster.length >= STARTER_ROLES.length - 1 ? "high" : "medium";
  return finalizeDimension(score, trend, confidence, drivers);
}

function trendFromFacilityHistory(
  history: readonly { facilityLevels: Record<string, number> }[],
  currentMean: number,
): DimensionTrend | null {
  if (history.length < 1) {
    return null;
  }
  const prior = history[history.length - 1]!;
  const levels = FACILITY_CATEGORIES.map(
    (cat) => prior.facilityLevels[cat] ?? 1,
  );
  const priorMean = levels.reduce((a, b) => a + b, 0) / levels.length;
  // Facility levels change slowly — soft thresholds in level points.
  return trendFromDelta(currentMean - priorMean, 0.25, 0.75);
}

// ---------------------------------------------------------------------------
// Strategic
// ---------------------------------------------------------------------------

function scoreStrategic(
  state: GameState,
  teamId: TeamId,
  business: FranchiseBusinessView,
  snapshots: readonly NarrativeMonthSnapshot[],
  history: readonly {
    franchiseValue: number;
    wins: number;
    losses: number;
  }[],
): DimensionHealth {
  const drivers: HealthDriver[] = [];
  const patience = getActiveOwnedFranchise(state).ownerPatience;
  const objectives = getActiveOwnedFranchise(state).objectives;
  const active = objectives.filter((o) => o.status === "active");
  const completed = objectives.filter((o) => o.status === "completed");
  const failed = objectives.filter((o) => o.status === "failed");

  // --- Alignment ---
  let alignment = clamp(patience, 0, 100);
  if (completed.length + failed.length > 0) {
    const rate = completed.length / (completed.length + failed.length);
    alignment = clamp(Math.round(alignment * 0.55 + rate * 100 * 0.45), 0, 100);
  }

  const ownershipMood = getActiveOwnedFranchise(state).ownershipConfidence.mood;
  const moodBoost =
    ownershipMood === "confident"
      ? 8
      : ownershipMood === "supportive"
        ? 4
        : ownershipMood === "watchful"
          ? -2
          : ownershipMood === "concerned"
            ? -8
            : -14;
  alignment = clamp(Math.round(alignment * 0.85 + (alignment + moodBoost) * 0.15), 0, 100);

  drivers.push({
    key: "owner_patience",
    direction: patience >= 50 ? "positive" : "negative",
    impact: patience < 35 || patience >= 70 ? "major" : "moderate",
    label: `Ownership patience ${patience}`,
    explanation: `Owner mandate patience is ${patience}.`,
  });

  drivers.push({
    key: "ownership_confidence",
    direction:
      ownershipMood === "confident" ||
      ownershipMood === "supportive" ||
      ownershipMood === "watchful"
        ? "positive"
        : "negative",
    impact:
      ownershipMood === "displeased" || ownershipMood === "confident"
        ? "major"
        : "moderate",
    label: `Ownership confidence: ${ownershipMood}`,
    explanation: `Ownership mood is ${ownershipMood}.`,
  });

  if (failed.length > completed.length && failed.length >= 2) {
    drivers.push({
      key: "objectives_failed",
      direction: "negative",
      impact: "major",
      label: "Objectives lagging",
      explanation: `${failed.length} failed vs ${completed.length} completed ownership objectives.`,
    });
  } else if (completed.length >= 2 && completed.length > failed.length) {
    drivers.push({
      key: "objectives_progress",
      direction: "positive",
      impact: "moderate",
      label: "Objectives on track",
      explanation: `${completed.length} completed ownership objectives (${failed.length} failed).`,
    });
  }

  if (active.length > 0) {
    // Progress is absolute (wins, cash, etc.) — only surface when target exists and ratio is high.
    const nearHit = active.filter((o) => {
      if (typeof o.progress !== "number" || typeof o.target !== "number") {
        return false;
      }
      if (o.target <= 0) {
        return false;
      }
      return o.progress / o.target >= 0.7 && o.progress / o.target < 1;
    });
    if (nearHit.length > 0) {
      drivers.push({
        key: "objectives_near",
        direction: "positive",
        impact: "minor",
        label: "Objectives progressing",
        explanation: `${nearHit.length} active objective${nearHit.length === 1 ? "" : "s"} show strong progress toward target.`,
      });
    }
  }

  // --- Future assets ---
  const youngShare = youngRosterSharePct(state, teamId);
  let futureAssets = clamp(youngShare, 0, 100);
  if (youngShare >= 40) {
    drivers.push({
      key: "young_roster",
      direction: "positive",
      impact: "moderate",
      label: "Young roster core",
      explanation: `${youngShare}% of the roster is age ${24} or under.`,
    });
  } else if (youngShare <= 15) {
    futureAssets = clamp(futureAssets - 10, 0, 100);
    drivers.push({
      key: "aging_roster",
      direction: "negative",
      impact: "moderate",
      label: "Aging roster",
      explanation: `Only ${youngShare}% of the roster is age 24 or under.`,
    });
  }

  // --- Trajectory ---
  const liveValue = business.franchiseValue;
  let trajectoryScore = 55;
  let confidence: HealthConfidence = "medium";
  if (history.length >= 1) {
    const priorValue = history[history.length - 1]!.franchiseValue;
    if (priorValue > 0) {
      const growthPct = ((liveValue - priorValue) / priorValue) * 100;
      trajectoryScore = clamp(Math.round(55 + growthPct), 15, 95);
      confidence = "high";
      drivers.push({
        key: "franchise_value_yoy",
        direction: growthPct >= 0 ? "positive" : "negative",
        impact: Math.abs(growthPct) >= 10 ? "major" : "moderate",
        label:
          growthPct >= 0
            ? "Franchise value rising"
            : "Franchise value declining",
        explanation: `Franchise value is ${growthPct >= 0 ? "up" : "down"} ${Math.abs(Math.round(growthPct))}% versus last season's snapshot.`,
      });
    }
  } else {
    confidence = "low";
    drivers.push({
      key: "no_season_history",
      direction: "positive",
      impact: "minor",
      label: "Limited history",
      explanation:
        "No prior season snapshot yet — strategic trajectory is provisional.",
    });
  }

  // Financial sustainability as trajectory context (reuse SSOT band, don't recompute).
  const finHealth = business.cashRunway.health;
  if (finHealth === "critical" || finHealth === "insolvent") {
    trajectoryScore = clamp(trajectoryScore - 12, 0, 100);
    drivers.push({
      key: "financial_sustainability",
      direction: "negative",
      impact: "major",
      label: "Financial sustainability risk",
      explanation: `Liquidity is ${finHealth}, which pressures long-term plans.`,
    });
  } else if (finHealth === "healthy") {
    trajectoryScore = clamp(trajectoryScore + 5, 0, 100);
  }

  // Competitive trajectory from prior season W-L if available.
  if (history.length >= 1) {
    const prior = history[history.length - 1]!;
    const priorGames = prior.wins + prior.losses;
    const standing = state.competition.standings.byTeamId[teamId];
    const curGames = (standing?.wins ?? 0) + (standing?.losses ?? 0);
    if (priorGames >= 10 && curGames >= COMPETITIVE_MIN_GAMES) {
      const priorPct = prior.wins / priorGames;
      const curPct = (standing?.wins ?? 0) / curGames;
      if (curPct - priorPct >= 0.1) {
        drivers.push({
          key: "competitive_trajectory",
          direction: "positive",
          impact: "moderate",
          label: "Competitive trajectory up",
          explanation:
            "Current winning percentage is meaningfully above last season.",
        });
        trajectoryScore = clamp(trajectoryScore + 5, 0, 100);
      } else if (priorPct - curPct >= 0.1) {
        drivers.push({
          key: "competitive_trajectory",
          direction: "negative",
          impact: "moderate",
          label: "Competitive trajectory down",
          explanation:
            "Current winning percentage is meaningfully below last season.",
        });
        trajectoryScore = clamp(trajectoryScore - 5, 0, 100);
      }
    }
  }

  // Combine buckets: alignment / future / trajectory — interpretable hybrid.
  const score = clamp(
    Math.round(alignment * 0.4 + futureAssets * 0.25 + trajectoryScore * 0.35),
    0,
    100,
  );

  // Relocation: contextual driver only — never auto-penalize the score.
  const reloc = state.business.relocationByTeamId[teamId];
  if (reloc && reloc.stage !== "none" && reloc.stage !== "complete") {
    drivers.push({
      key: "relocation_context",
      direction: "positive",
      impact: "minor",
      label: "Relocation process active",
      explanation: `Relocation is in stage "${reloc.stage}" — contextual, not scored as strategic failure.`,
    });
  }

  const trend = trendFromValueSnapshots(snapshots, history, liveValue);
  return finalizeDimension(score, trend, confidence, drivers);
}

function trendFromValueSnapshots(
  snapshots: readonly NarrativeMonthSnapshot[],
  history: readonly { franchiseValue: number }[],
  liveValue: number,
): DimensionTrend | null {
  if (snapshots.length >= 2) {
    const prior = snapshots[snapshots.length - 2]!;
    const latest = snapshots[snapshots.length - 1]!;
    if (prior.franchiseValue > 0) {
      const pct =
        ((latest.franchiseValue - prior.franchiseValue) / prior.franchiseValue) *
        100;
      return trendFromDelta(pct, VALUE_TREND_SOFT_PCT, VALUE_TREND_STRONG_PCT);
    }
  }
  if (history.length >= 1 && history[history.length - 1]!.franchiseValue > 0) {
    const priorValue = history[history.length - 1]!.franchiseValue;
    const pct = ((liveValue - priorValue) / priorValue) * 100;
    return trendFromDelta(pct, VALUE_TREND_SOFT_PCT, VALUE_TREND_STRONG_PCT);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Summary / extremes
// ---------------------------------------------------------------------------

function deriveCondition(
  dimensions: FranchiseHealthView["dimensions"],
): DimensionStatus {
  // Qualitative synthesis: worst risk pulls down; strengths need breadth.
  const scores = DIMENSION_KEYS.map((k) => dimensions[k].score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (min < 30) {
    return "critical";
  }
  if (min < 45 || mean < 48) {
    return "concerning";
  }
  if (mean >= 78 && min >= 60) {
    return "excellent";
  }
  if (mean >= 65 && min >= 50) {
    return "strong";
  }
  if (max >= 80 && min >= 45) {
    return "strong";
  }
  return "adequate";
}

function pickExtreme(
  dimensions: FranchiseHealthView["dimensions"],
  mode: "high" | "low",
): { dimension: FranchiseHealthDimensionKey; label: string } | null {
  let best: FranchiseHealthDimensionKey | null = null;
  let bestScore = mode === "high" ? -1 : 101;
  for (const key of DIMENSION_KEYS) {
    const score = dimensions[key].score;
    if (mode === "high" ? score > bestScore : score < bestScore) {
      bestScore = score;
      best = key;
    }
  }
  if (!best) {
    return null;
  }
  return { dimension: best, label: DIMENSION_LABELS[best] };
}

function buildSummary(
  condition: DimensionStatus,
  dimensions: FranchiseHealthView["dimensions"],
  strength: { dimension: FranchiseHealthDimensionKey; label: string } | null,
  risk: { dimension: FranchiseHealthDimensionKey; label: string } | null,
): string {
  const highs = DIMENSION_KEYS.filter(
    (k) => dimensions[k].score >= 65,
  ).map((k) => DIMENSION_LABELS[k].toLowerCase());
  const lows = DIMENSION_KEYS.filter(
    (k) => dimensions[k].score < 45,
  ).map((k) => DIMENSION_LABELS[k].toLowerCase());

  const strengthClause =
    highs.length >= 2
      ? `${joinNatural(highs)} are solid`
      : strength
        ? `${strength.label} is the clearest strength`
        : "no single dimension stands out as a strength";

  const riskClause =
    lows.length >= 1
      ? `${joinNatural(lows)} ${lows.length === 1 ? "needs" : "need"} attention`
      : risk && dimensions[risk.dimension].score < 65
        ? `${risk.label.toLowerCase()} is the primary concern`
        : "no dimension is in clear distress";

  return `${formatDimensionStatus(condition)} overall — ${strengthClause}, but ${riskClause}.`;
}

function buildPrimaryDriver(
  dimensions: FranchiseHealthView["dimensions"],
  strength: { dimension: FranchiseHealthDimensionKey; label: string } | null,
  risk: { dimension: FranchiseHealthDimensionKey; label: string } | null,
): string | null {
  const parts: string[] = [];
  if (strength) {
    const majorPos = dimensions[strength.dimension].drivers.find(
      (d) => d.direction === "positive" && d.impact !== "minor",
    );
    if (majorPos) {
      parts.push(majorPos.explanation);
    }
  }
  if (risk) {
    const majorNeg = dimensions[risk.dimension].drivers.find(
      (d) => d.direction === "negative" && d.impact !== "minor",
    );
    if (majorNeg) {
      parts.push(majorNeg.explanation);
    }
  }
  if (parts.length === 0) {
    // Fall back to any major driver across dimensions.
    for (const key of DIMENSION_KEYS) {
      const major = dimensions[key].drivers.find((d) => d.impact === "major");
      if (major) {
        parts.push(major.explanation);
        break;
      }
    }
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finalizeDimension(
  score: number,
  trend: DimensionTrend | null,
  confidence: HealthConfidence,
  drivers: HealthDriver[],
): DimensionHealth {
  const clamped = clamp(Math.round(score), 0, 100);
  return {
    score: clamped,
    status: statusFromScore(clamped),
    trend: confidence === "low" && trend && trend !== "stable" ? null : trend,
    confidence,
    drivers: sortDrivers(drivers),
  };
}

function sortDrivers(drivers: HealthDriver[]): HealthDriver[] {
  const impactRank = { major: 0, moderate: 1, minor: 2 };
  return [...drivers].sort((a, b) => {
    if (a.impact !== b.impact) {
      return impactRank[a.impact] - impactRank[b.impact];
    }
    if (a.direction !== b.direction) {
      return a.direction === "negative" ? -1 : 1;
    }
    return a.key.localeCompare(b.key);
  });
}

function trendFromDelta(
  delta: number,
  soft: number,
  strong: number,
): DimensionTrend {
  if (delta >= strong) {
    return "strongly_improving";
  }
  if (delta >= soft) {
    return "improving";
  }
  if (delta <= -strong) {
    return "strongly_declining";
  }
  if (delta <= -soft) {
    return "declining";
  }
  return "stable";
}

function meanLeagueStrength(state: GameState): number | null {
  const teamIds = Object.keys(state.world.teams);
  if (teamIds.length < 2) {
    return null;
  }
  let total = 0;
  for (const id of teamIds) {
    total += meanRosterOverall(state, asTeamId(id));
  }
  return total / teamIds.length;
}

function meanValidTicketPrices(state: GameState): number | null {
  const prices: number[] = [];
  for (const ops of Object.values(state.business.franchiseOps)) {
    const price = ops?.ticketPrice;
    if (
      typeof price === "number" &&
      Number.isInteger(price) &&
      price >= TICKET_PRICE_MIN &&
      price <= TICKET_PRICE_MAX
    ) {
      prices.push(price);
    }
  }
  if (prices.length < 2) {
    return null;
  }
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatMoney(amount: number): string {
  const millions = amount / 1_000_000;
  if (Math.abs(millions) >= 1) {
    return `$${millions.toFixed(1)}M`;
  }
  const thousands = amount / 1_000;
  if (Math.abs(thousands) >= 1) {
    return `$${thousands.toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function joinNatural(items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0]!;
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
