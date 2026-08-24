/**
 * ExpansionAssessment — three independent gates:
 * league readiness, market opportunity, structural capacity.
 * Single source of truth for gameplay, narrative, and UI.
 */

import { SUPPORTED_TEAM_COUNTS } from "@/domain/game-settings";
import { tryResolveLeagueShape } from "@/domain/league-shape";
import type { GameState } from "@/state/game-state";
import {
  rankExpansionDestinations,
  type DestinationEvaluation,
} from "@/state/market-destination";
import { listAttractiveExpansionMarkets } from "@/systems/market-catalog";
import {
  EXPANSION_READY_MIN_BROADCAST,
  EXPANSION_READY_MIN_POPULARITY,
  EXPANSION_READY_MIN_SPONSORSHIP,
} from "@/systems/expansion-config";

export type ExpansionGateStatus = "open" | "closed";

export type ExpansionAssessmentStatus =
  | "not_relevant"
  | "partial"
  | "opportunity"
  | "in_progress";

export type ExpansionAssessment = {
  status: ExpansionAssessmentStatus;
  leagueReadiness: {
    status: ExpansionGateStatus;
    reasons: string[];
    cycle: string;
    popularity: number;
    broadcastValue: number;
    sponsorshipClimate: number;
  };
  marketOpportunity: {
    status: ExpansionGateStatus;
    reasons: string[];
    destinations: DestinationEvaluation[];
  };
  structuralCapacity: {
    status: ExpansionGateStatus;
    reasons: string[];
    liveTeamCount: number;
    nextSupportedCount: number | null;
  };
  canPropose: boolean;
  summaryReasons: string[];
};

function nextSupportedTeamCount(liveCount: number): number | null {
  for (const count of SUPPORTED_TEAM_COUNTS) {
    if (count > liveCount) {
      return count;
    }
  }
  return null;
}

function evaluateLeagueReadiness(state: GameState): ExpansionAssessment["leagueReadiness"] {
  const eco = state.business.leagueEconomy;
  const reasons: string[] = [];
  let open = true;

  if (eco.cycle === "recession") {
    open = false;
    reasons.push("League economic cycle is in recession.");
  } else if (eco.cycle === "growth") {
    reasons.push("League cycle is in growth.");
  } else {
    reasons.push("League cycle is stable.");
  }

  if (eco.popularity < EXPANSION_READY_MIN_POPULARITY) {
    open = false;
    reasons.push(
      `Popularity (${eco.popularity}) is below the expansion threshold (${EXPANSION_READY_MIN_POPULARITY}).`,
    );
  }
  if (eco.broadcastValue < EXPANSION_READY_MIN_BROADCAST) {
    open = false;
    reasons.push(
      `Broadcast value (${eco.broadcastValue}) is below the expansion threshold (${EXPANSION_READY_MIN_BROADCAST}).`,
    );
  }
  if (eco.sponsorshipClimate < EXPANSION_READY_MIN_SPONSORSHIP) {
    open = false;
    reasons.push(
      `Sponsorship climate (${eco.sponsorshipClimate}) is below the expansion threshold (${EXPANSION_READY_MIN_SPONSORSHIP}).`,
    );
  }

  if (open && reasons.length === 1) {
    reasons.push("Popularity, broadcast, and sponsorship climate support expansion.");
  }

  return {
    status: open ? "open" : "closed",
    reasons,
    cycle: eco.cycle,
    popularity: eco.popularity,
    broadcastValue: eco.broadcastValue,
    sponsorshipClimate: eco.sponsorshipClimate,
  };
}

function evaluateMarketOpportunity(
  state: GameState,
): ExpansionAssessment["marketOpportunity"] {
  const attractive = listAttractiveExpansionMarkets(state);
  const destinations = rankExpansionDestinations(state).filter((d) =>
    attractive.some((m) => m.city === d.city),
  );
  if (destinations.length === 0) {
    return {
      status: "closed",
      reasons: ["No attractive unoccupied markets are available."],
      destinations: [],
    };
  }
  return {
    status: "open",
    reasons: [
      `${destinations.length} unoccupied market(s) meet expansion attractiveness.`,
    ],
    destinations,
  };
}

function evaluateStructuralCapacity(
  state: GameState,
): ExpansionAssessment["structuralCapacity"] {
  const liveTeamCount = Object.keys(state.world.teams).length;
  const next = nextSupportedTeamCount(liveTeamCount);
  const maxSupported = SUPPORTED_TEAM_COUNTS[SUPPORTED_TEAM_COUNTS.length - 1]!;
  const divisionCount = Object.keys(state.world.divisions).length;

  if (liveTeamCount >= maxSupported) {
    return {
      status: "closed",
      reasons: [
        `Live league size (${liveTeamCount}) is at the maximum supported team count (${maxSupported}).`,
      ],
      liveTeamCount,
      nextSupportedCount: null,
    };
  }

  if (divisionCount === 0) {
    return {
      status: "closed",
      reasons: ["League has no divisions available for placement."],
      liveTeamCount,
      nextSupportedCount: next,
    };
  }

  // Geographic/equal-division realignment is deferred. Adding one franchise
  // often makes division sizes unequal until a future realignment pass.
  // Structural capacity: under max size and has a division slot.
  const conferenceCount = state.settings.league.conferenceCount;
  const shapeAtNext = next
    ? tryResolveLeagueShape({
        teamCount: next,
        conferenceCount,
        divisionsEnabled: state.settings.league.divisionsEnabled,
      })
    : null;

  const reasons = [
    `League can add a franchise (${liveTeamCount} → ${liveTeamCount + 1}; max ${maxSupported}).`,
  ];
  if (shapeAtNext && !shapeAtNext.ok) {
    reasons.push(
      "Equal conference/division counts for the next supported size are not required until realignment (deferred).",
    );
  }

  return {
    status: "open",
    reasons,
    liveTeamCount,
    nextSupportedCount: next,
  };
}

/**
 * Pure expansion assessment.
 * Does not propose or create teams.
 */
export function assessExpansion(state: GameState): ExpansionAssessment {
  const expansion = state.business.expansion;
  const inProgress =
    expansion.stage !== "none" && expansion.stage !== "complete";

  const leagueReadiness = evaluateLeagueReadiness(state);
  const marketOpportunity = evaluateMarketOpportunity(state);
  const structuralCapacity = evaluateStructuralCapacity(state);

  const allOpen =
    leagueReadiness.status === "open" &&
    marketOpportunity.status === "open" &&
    structuralCapacity.status === "open";

  const anyOpen =
    leagueReadiness.status === "open" ||
    marketOpportunity.status === "open" ||
    structuralCapacity.status === "open";

  let status: ExpansionAssessmentStatus;
  if (inProgress) {
    status = "in_progress";
  } else if (allOpen) {
    status = "opportunity";
  } else if (anyOpen) {
    status = "partial";
  } else {
    status = "not_relevant";
  }

  const summaryReasons: string[] = [];
  if (leagueReadiness.status === "closed") {
    summaryReasons.push(...leagueReadiness.reasons.filter((r) => r.includes("below") || r.includes("recession")));
  }
  if (marketOpportunity.status === "closed") {
    summaryReasons.push(...marketOpportunity.reasons);
  }
  if (structuralCapacity.status === "closed") {
    summaryReasons.push(...structuralCapacity.reasons);
  }
  if (allOpen) {
    summaryReasons.push(
      "League readiness, market opportunity, and structural capacity all support expansion.",
    );
  }

  return {
    status,
    leagueReadiness,
    marketOpportunity,
    structuralCapacity,
    canPropose: allOpen || inProgress,
    summaryReasons,
  };
}
