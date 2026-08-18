/**
 * Authoritative derived franchise situation for AI preference resolution.
 * Built once per decision; owner AI and team AI must not invent competing metrics.
 */

import type { AiProfile } from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  meanRosterAge,
  meanRosterOverall,
  youngRosterSharePct,
} from "@/state/roster-strength";
import { calculateCashRunway } from "@/state/franchise-selectors";
import type { FinancialHealthState } from "@/systems/financial-health";
import { getTeamCapSpace } from "@/systems/salary-cap";

export type FranchiseIdentitySnapshot = {
  aiProfile: AiProfile;
  spendingTolerance: number;
  patience: number;
  riskTolerance: number;
  marketSize: number;
};

/**
 * Current franchise situation — derived, never persisted as identity.
 */
export type FranchiseContext = {
  teamId: TeamId;
  wins: number;
  losses: number;
  /** 0–1 win percentage; 0.5 if no games. */
  winPct: number;
  rosterStrength: number;
  rosterAge: number;
  youngRosterSharePct: number;
  cash: number;
  financialHealth: FinancialHealthState;
  capSpace: number;
  marketSize: number;
  reputation: number;
  fanSentiment: number;
  marketingAwareness: number;
  /** Owned future draft picks (count). */
  draftAssetCount: number;
  /**
   * Recent performance pressure 0–1: high when losing / weak roster.
   * Used only as situation input into the resolver.
   */
  performancePressure: number;
};

export function readFranchiseIdentity(
  state: GameState,
  teamId: TeamId,
): FranchiseIdentitySnapshot | null {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return null;
  }
  return {
    aiProfile: ops.aiProfile,
    spendingTolerance: ops.spendingTolerance,
    patience: ops.patience,
    riskTolerance: ops.riskTolerance,
    marketSize: ops.marketSize,
  };
}

export function buildFranchiseContext(
  state: GameState,
  teamId: TeamId,
): FranchiseContext | null {
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  if (!team || !ops) {
    return null;
  }

  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const winPct = games === 0 ? 0.5 : wins / games;

  const runway = calculateCashRunway(state, teamId);
  const seasonYear = state.competition.season.year;
  const capSpace = state.settings.financialRules.salaryCapEnabled
    ? getTeamCapSpace(teamId, seasonYear, state)
    : Number.MAX_SAFE_INTEGER;

  let draftAssetCount = 0;
  for (const pick of Object.values(state.world.draftPicks)) {
    if (pick.ownerTeamId === teamId) {
      draftAssetCount += 1;
    }
  }

  const rosterStrength = meanRosterOverall(state, teamId);
  const rosterAge = meanRosterAge(state, teamId);
  const youngShare = youngRosterSharePct(state, teamId);

  // High pressure when losing and/or weak roster (0–1).
  const recordPressure = Math.max(0, Math.min(1, (0.5 - winPct) * 2));
  const strengthPressure =
    rosterStrength <= 0
      ? 0.5
      : Math.max(0, Math.min(1, (55 - rosterStrength) / 30));
  const performancePressure = Math.max(
    0,
    Math.min(1, recordPressure * 0.6 + strengthPressure * 0.4),
  );

  return {
    teamId,
    wins,
    losses,
    winPct,
    rosterStrength,
    rosterAge,
    youngRosterSharePct: youngShare,
    cash: runway.cash,
    financialHealth: runway.health,
    capSpace,
    marketSize: ops.marketSize,
    reputation: team.reputation,
    fanSentiment: ops.fanSentiment,
    marketingAwareness: ops.marketing.awareness,
    draftAssetCount,
    performancePressure,
  };
}
