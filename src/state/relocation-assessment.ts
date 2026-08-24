/**
 * RelocationAssessment — single source of truth for gameplay, narrative, and UI.
 * Never auto-relocates. strong_case means the option is legitimate; the owner decides.
 *
 * Basketball health and business health are separate axes.
 * Do not invent parallel economic calculations.
 */

import { createIdleRelocation } from "@/domain/entities/relocation";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  calculateCashRunway,
} from "@/state/franchise-selectors";
import {
  explainFranchiseValue,
  readAttendanceRealization,
} from "@/state/franchise-value";
import {
  rankRelocationDestinations,
  type DestinationEvaluation,
} from "@/state/market-destination";
import type { FinancialHealthState } from "@/systems/financial-health";
import {
  RELOCATION_FAILED_ATTEMPT_COOLDOWN_SEASONS,
  RELOCATION_FEE_PER_MARKET_SIZE_POINT,
  RELOCATION_MIN_SEASONS_IN_CITY,
  RELOCATION_SOFT_REALIZATION,
  RELOCATION_STRONG_MARKET_SIZE,
  RELOCATION_TRANSITION_FEE,
  RELOCATION_WEAK_MARKET_SIZE,
  RELOCATION_WEAK_REALIZATION,
} from "@/systems/relocation-config";

export type RelocationAssessmentStatus =
  | "not_relevant"
  | "watch"
  | "consider"
  | "strong_case"
  | "blocked_tenure"
  | "in_progress";

export type HealthBand = "strong" | "moderate" | "weak";

export type RelocationAssessment = {
  teamId: TeamId;
  status: RelocationAssessmentStatus;
  basketballHealth: HealthBand;
  businessHealth: HealthBand;
  marketConstraint: {
    marketSize: number;
    attendanceRealization: number;
    weakMarket: boolean;
    softRealization: boolean;
  };
  primaryDrivers: string[];
  constraints: string[];
  stayAdvantages: string[];
  destinationOpportunity: DestinationEvaluation[];
  estimatedCost: {
    fee: number;
    fanDisruptionSummary: string;
    transitionRiskSummary: string;
  };
  tenure: {
    seasonsInCurrentCity: number;
    seasonsSinceLastRelocation: number | null;
    minSeasonsInCity: number;
    cooldownSeasonsRemaining: number;
    failedAttemptCooldownSeasonsRemaining: number;
    blocked: boolean;
  };
  /** Economic status before tenure gate — used for narrative when blocked_tenure. */
  economicStatus: Exclude<
    RelocationAssessmentStatus,
    "blocked_tenure" | "in_progress"
  >;
  canStart: boolean;
};

function basketballBand(state: GameState, teamId: TeamId): HealthBand {
  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const winPct = games === 0 ? 0.5 : wins / games;

  const history = state.business.franchiseHistory[teamId]?.seasons ?? [];
  const recent = history.slice(-3);
  let playoffRate = 0;
  if (recent.length > 0) {
    playoffRate =
      recent.filter((s) => s.playoffResult !== "missed").length / recent.length;
  }

  const score = winPct * 0.7 + playoffRate * 0.3;
  if (score >= 0.55) {
    return "strong";
  }
  if (score >= 0.4) {
    return "moderate";
  }
  return "weak";
}

function businessBand(
  state: GameState,
  teamId: TeamId,
  realization: number,
): { band: HealthBand; health: FinancialHealthState } {
  const runway = calculateCashRunway(state, teamId);
  const health = runway.health;
  const value = explainFranchiseValue(state, teamId);
  const standing = value.standing;

  const distressed =
    health === "warning" ||
    health === "critical" ||
    health === "insolvent";
  const softBiz = realization < RELOCATION_SOFT_REALIZATION;
  const strongStanding =
    standing === "major" ||
    standing === "elite" ||
    standing === "legacy" ||
    standing === "established";

  if (distressed && softBiz) {
    return { band: "weak", health };
  }
  if (distressed) {
    return { band: "weak", health };
  }
  if (health === "healthy" && strongStanding && realization >= RELOCATION_SOFT_REALIZATION) {
    return { band: "strong", health };
  }
  if (health === "healthy" || (health === "stable" && !softBiz)) {
    return { band: "strong", health };
  }
  if (softBiz && !strongStanding) {
    return { band: "weak", health };
  }
  return { band: "moderate", health };
}

function seasonsInCity(
  process: ReturnType<typeof createIdleRelocation>,
  currentYear: number,
  historyLength: number,
): number {
  if (process.cityStartSeasonYear > 0) {
    return Math.max(0, currentYear - process.cityStartSeasonYear + 1);
  }
  // Missing tenure start: treat franchise history length as seasons in city.
  return Math.max(1, historyLength);
}

function interpretEconomicStatus(input: {
  weakMarket: boolean;
  softRealization: boolean;
  basketball: HealthBand;
  business: HealthBand;
  financialPressure: boolean;
}): Exclude<RelocationAssessmentStatus, "blocked_tenure" | "in_progress"> {
  const { weakMarket, softRealization, basketball, business, financialPressure } =
    input;
  const marketBinding = weakMarket || softRealization;

  if (!marketBinding) {
    // Strong market: relocation is not an escape from poor basketball.
    if (business === "strong" || business === "moderate") {
      return "not_relevant";
    }
    return "watch";
  }

  // Weak / soft market cases.
  if (business === "weak" && financialPressure) {
    return "strong_case";
  }
  if (business === "weak") {
    return basketball === "weak" ? "strong_case" : "consider";
  }
  if (business === "strong" && weakMarket) {
    // Strong business in weak market — opportunity, urgency from how binding.
    return softRealization || financialPressure ? "strong_case" : "consider";
  }
  if (business === "strong") {
    return "consider";
  }
  // moderate business + weak market
  if (basketball === "weak") {
    return "consider";
  }
  return softRealization ? "consider" : "watch";
}

/**
 * Pure relocation assessment for one team.
 * Hard rule: this never relocates a franchise.
 */
export function assessRelocation(
  state: GameState,
  teamId: TeamId = state.user.controlledTeamId,
): RelocationAssessment {
  const process =
    state.business.relocationByTeamId[teamId] ??
    createIdleRelocation(teamId, state.competition.season.year);
  const ops = state.business.franchiseOps[teamId];
  const marketSize = ops?.marketSize ?? 50;
  const realization = readAttendanceRealization(state, teamId);
  const basketball = basketballBand(state, teamId);
  const { band: business, health } = businessBand(state, teamId, realization);
  const financialPressure =
    health === "warning" ||
    health === "critical" ||
    health === "insolvent";

  const weakMarket = marketSize < RELOCATION_WEAK_MARKET_SIZE;
  const softRealization = realization < RELOCATION_SOFT_REALIZATION;
  const year = state.competition.season.year;
  const historyLength =
    state.business.franchiseHistory[teamId]?.seasons.length ?? 0;
  const inCity = seasonsInCity(process, year, historyLength);
  const seasonsSinceLast =
    process.lastCompletedRelocationSeasonYear === null
      ? null
      : Math.max(0, year - process.lastCompletedRelocationSeasonYear);

  const tenureBlocked =
    process.cooldownSeasonsRemaining > 0 ||
    process.failedAttemptCooldownSeasonsRemaining > 0 ||
    inCity < RELOCATION_MIN_SEASONS_IN_CITY;

  const destinations = rankRelocationDestinations(state, marketSize, {
    currentRealization: realization,
    financialPressure,
  });

  const bestCredible = destinations.find((d) => d.credibleImprovement);
  const feeDelta = Math.max(0, bestCredible?.marketSizeDelta ?? 0);
  const estimatedFee =
    RELOCATION_TRANSITION_FEE +
    feeDelta * RELOCATION_FEE_PER_MARKET_SIZE_POINT;

  const primaryDrivers: string[] = [];
  const constraints: string[] = [];
  const stayAdvantages: string[] = [];

  if (weakMarket) {
    primaryDrivers.push(
      `Current market size (${marketSize}) constrains commercial potential.`,
    );
  }
  if (softRealization) {
    primaryDrivers.push(
      `Attendance realization (${realization.toFixed(2)}) is soft relative to market potential.`,
    );
  }
  if (financialPressure) {
    primaryDrivers.push(`Financial health is ${health}.`);
  }
  if (business === "strong" && weakMarket) {
    primaryDrivers.push(
      "Business is healthy but the market structurally limits upside.",
    );
  }
  if (basketball === "weak" && !weakMarket) {
    constraints.push(
      "On-court results are weak in a workable market — improve the team before considering a move.",
    );
    stayAdvantages.push("Invest in roster, coaching, and development.");
  }
  if (business === "strong") {
    stayAdvantages.push(
      "Finances and franchise value can support staying and investing locally.",
    );
  }
  stayAdvantages.push("Adjust ticket prices and marketing to lift demand.");
  stayAdvantages.push("Upgrade facilities to improve fan experience.");
  stayAdvantages.push("Wait for market conditions and loyalty to recover.");

  if (tenureBlocked) {
    if (process.cooldownSeasonsRemaining > 0) {
      constraints.push(
        `Franchise moved recently — ${process.cooldownSeasonsRemaining} season(s) of cooldown remain.`,
      );
    }
    if (process.failedAttemptCooldownSeasonsRemaining > 0) {
      constraints.push(
        `Recent failed relocation attempt — ${process.failedAttemptCooldownSeasonsRemaining} season(s) before retry.`,
      );
    }
    if (inCity < RELOCATION_MIN_SEASONS_IN_CITY) {
      constraints.push(
        `Only ${inCity} season(s) in the current city; minimum is ${RELOCATION_MIN_SEASONS_IN_CITY}.`,
      );
    }
  }

  if (marketSize >= RELOCATION_STRONG_MARKET_SIZE && realization >= RELOCATION_SOFT_REALIZATION) {
    stayAdvantages.push(
      "Strong local market and solid fill — relocation would give up valuable relationships.",
    );
  }

  const inProgress =
    process.stage !== "none" &&
    process.stage !== "complete" &&
    process.stage !== "rejected";

  const economicStatus = interpretEconomicStatus({
    weakMarket,
    softRealization,
    basketball,
    business,
    financialPressure,
  });

  let status: RelocationAssessmentStatus;
  if (inProgress) {
    status = "in_progress";
  } else if (
    tenureBlocked &&
    (economicStatus === "consider" || economicStatus === "strong_case")
  ) {
    status = "blocked_tenure";
  } else if (tenureBlocked && economicStatus === "watch") {
    status = "watch";
  } else if (tenureBlocked) {
    status = "not_relevant";
  } else {
    status = economicStatus;
  }

  // Extra constraint: very soft realization alone in strong market stays watch.
  if (
    !weakMarket &&
    realization < RELOCATION_WEAK_REALIZATION &&
    status === "not_relevant"
  ) {
    status = "watch";
  }

  const canStart =
    (status === "consider" || status === "strong_case" || status === "in_progress") &&
    !tenureBlocked;

  return {
    teamId,
    status,
    basketballHealth: basketball,
    businessHealth: business,
    marketConstraint: {
      marketSize,
      attendanceRealization: realization,
      weakMarket,
      softRealization,
    },
    primaryDrivers,
    constraints,
    stayAdvantages,
    destinationOpportunity: destinations,
    estimatedCost: {
      fee: estimatedFee,
      fanDisruptionSummary:
        "Large immediate hit to local fan sentiment; demand recovers through monthly smoothing.",
      transitionRiskSummary:
        "Fee, short-term disruption, and uncertain new-market realization — not a guaranteed fill rate.",
    },
    tenure: {
      seasonsInCurrentCity: inCity,
      seasonsSinceLastRelocation: seasonsSinceLast,
      minSeasonsInCity: RELOCATION_MIN_SEASONS_IN_CITY,
      cooldownSeasonsRemaining: process.cooldownSeasonsRemaining,
      failedAttemptCooldownSeasonsRemaining:
        process.failedAttemptCooldownSeasonsRemaining,
      blocked: tenureBlocked,
    },
    economicStatus:
      economicStatus === "not_relevant" ||
      economicStatus === "watch" ||
      economicStatus === "consider" ||
      economicStatus === "strong_case"
        ? economicStatus
        : "not_relevant",
    canStart,
  };
}

export function relocationMayStart(
  assessment: RelocationAssessment,
): boolean {
  return assessment.canStart;
}

/** Fee for a specific target (positive market delta scales fee). */
export function relocationFeeForTarget(
  currentMarketSize: number,
  targetMarketSize: number,
): number {
  const delta = Math.max(0, targetMarketSize - currentMarketSize);
  return (
    RELOCATION_TRANSITION_FEE +
    delta * RELOCATION_FEE_PER_MARKET_SIZE_POINT
  );
}

export { RELOCATION_FAILED_ATTEMPT_COOLDOWN_SEASONS };
