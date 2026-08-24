/**
 * Builds living ownership expectations from philosophy + franchise state.
 * Derived only — never persisted as a second mandate source of truth.
 */

import type { TeamId } from "@/domain/ids";
import type {
  OwnershipExpectations,
} from "@/domain/entities/ownership-expectations";
import {
  competitiveStanceLabel,
  rosterStanceLabel,
} from "@/domain/entities/ownership-expectations";
import type { GameState } from "@/state/game-state";
import { buildFranchiseContext } from "@/systems/franchise-ai-context";
import { getOwnerPhilosophyProfile } from "@/systems/owner-philosophy-config";
import {
  AWARENESS_LOW_THRESHOLD,
  ATTENDANCE_SOFT_FILL_PCT,
  competitiveBandFromWins,
  resolveCompetitiveExpectation,
  resolveFinancialExpectation,
  resolveMarketExpectation,
  resolveRosterExpectation,
  resolveTolerance,
  YOUNG_CORE_SHARE_PCT,
  YOUNG_CORE_STRENGTH_FLOOR,
} from "@/systems/ownership-expectations-config";
import { arenaCapacity } from "@/systems/facilities";

/**
 * Projected season wins from current pace, or last completed season if none played.
 */
export function projectedSeasonWins(state: GameState, teamId: TeamId): number {
  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  if (games >= 10) {
    return Math.round((wins / games) * 82);
  }
  const history = state.business.franchiseHistory[teamId]?.seasons;
  if (history && history.length > 0) {
    const last = history[history.length - 1]!;
    return last.wins;
  }
  const profile = getOwnerPhilosophyProfile(state.user.ownerPhilosophy);
  return profile.winTolerance.acceptable;
}

function revenueGrowing(state: GameState, teamId: TeamId): boolean {
  const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
  if (seasons.length < 2) {
    return false;
  }
  const prior = seasons[seasons.length - 2]!;
  const last = seasons[seasons.length - 1]!;
  return last.revenue > prior.revenue * 1.03;
}

function attendanceFillPct(state: GameState, teamId: TeamId): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return 50;
  }
  const capacity = arenaCapacity(state, teamId);
  if (capacity <= 0) {
    return 50;
  }
  const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
  const last = seasons[seasons.length - 1];
  if (last?.attendance != null && last.wins + last.losses > 0) {
    const homeGames = Math.max(1, Math.round((last.wins + last.losses) / 2));
    return Math.round((last.attendance / (capacity * homeGames)) * 100);
  }
  return Math.round((ops.fanSentiment / 100) * 70 + ops.marketing.awareness * 0.3);
}

function buildMandateSummary(
  expectations: Omit<OwnershipExpectations, "mandateSummary" | "priorityBullets">,
): string {
  const competitive = competitiveStanceLabel(expectations.competitiveExpectation);
  const roster = rosterStanceLabel(expectations.rosterBuildingExpectation);
  switch (expectations.philosophy) {
    case "win_now":
      if (expectations.competitiveExpectation === "rebuild") {
        return `Accept a short rebuild while protecting flexibility, then return to ${competitive}.`;
      }
      return `Pursue ${competitive} and prioritize ${roster}.`;
    case "build_for_the_future":
      return `Focus on ${roster} while targeting ${competitive} over time.`;
    case "financially_conservative":
      return `Keep finances disciplined while aiming for ${competitive}.`;
    case "market_expansion":
      return `Grow the commercial footprint while supporting ${competitive}.`;
    case "balanced":
      return `Balance ${competitive} with sustainable roster and financial choices.`;
  }
}

function buildPriorityBullets(
  expectations: Omit<OwnershipExpectations, "mandateSummary" | "priorityBullets">,
): string[] {
  const bullets: string[] = [];
  switch (expectations.competitiveExpectation) {
    case "rebuild":
      bullets.push("Preserve future flexibility and avoid empty contention spending");
      break;
    case "develop":
      bullets.push("Show meaningful progress without forcing a win-now roster");
      break;
    case "compete":
      bullets.push("Compete for the playoffs and protect the current core");
      break;
    case "contend":
      bullets.push("Maximize contention windows and avoid unnecessary asset accumulation");
      break;
  }
  switch (expectations.rosterBuildingExpectation) {
    case "youth_focus":
      bullets.push("Develop young players and preserve draft capital");
      break;
    case "balanced":
      bullets.push("Blend youth development with targeted veteran help");
      break;
    case "win_now_roster":
      bullets.push("Prioritize established contributors over long-term asset gathering");
      break;
  }
  switch (expectations.financialExpectation) {
    case "preserve_cash":
      bullets.push("Avoid aggressive payroll growth until finances stabilize");
      break;
    case "sustainable":
      bullets.push("Keep payroll growth aligned with revenue");
      break;
    case "invest":
      bullets.push("Invest where it improves competitiveness or market strength");
      break;
  }
  if (
    expectations.marketExpectation === "grow" ||
    expectations.marketExpectation === "aggressive_growth"
  ) {
    bullets.push("Invest in facilities, marketing, and fan engagement");
  }
  return bullets.slice(0, 5);
}

/**
 * Derive current ownership expectations for the controlled (or given) team.
 */
export function buildOwnershipExpectations(
  state: GameState,
  teamId: TeamId = state.user.controlledTeamId,
): OwnershipExpectations {
  const philosophy = state.user.ownerPhilosophy;
  const ctx = buildFranchiseContext(state, teamId);
  const wins = projectedSeasonWins(state, teamId);
  const band = competitiveBandFromWins(wins);
  const competitiveExpectation = resolveCompetitiveExpectation(philosophy, band);

  const youngCoreReady =
    (ctx?.youngRosterSharePct ?? 0) >= YOUNG_CORE_SHARE_PCT &&
    (ctx?.rosterStrength ?? 0) >= YOUNG_CORE_STRENGTH_FLOOR;

  const rosterBuildingExpectation = resolveRosterExpectation(
    philosophy,
    competitiveExpectation,
    youngCoreReady,
  );

  const cashHealthy =
    ctx?.financialHealth === "stable" ||
    ctx?.financialHealth === "healthy" ||
    (ctx?.cash ?? 0) > 15_000_000;

  const financialExpectation = resolveFinancialExpectation(
    philosophy,
    revenueGrowing(state, teamId),
    cashHealthy,
  );

  const awareness = ctx?.marketingAwareness ?? 40;
  const fillPct = attendanceFillPct(state, teamId);
  const marketExpectation = resolveMarketExpectation(
    philosophy,
    awareness < AWARENESS_LOW_THRESHOLD,
    fillPct < ATTENDANCE_SOFT_FILL_PCT,
  );

  const tolerance = resolveTolerance(philosophy, competitiveExpectation);

  const partial = {
    philosophy,
    competitiveExpectation,
    rosterBuildingExpectation,
    financialExpectation,
    marketExpectation,
    tolerance,
  };

  return {
    ...partial,
    mandateSummary: buildMandateSummary(partial),
    priorityBullets: buildPriorityBullets(partial),
  };
}
