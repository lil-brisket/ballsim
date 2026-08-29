/**
 * Observational metrics for franchise identity differentiation.
 * Records the existing simulation — does not introduce alternate gameplay rules.
 */

import type { AiProfile } from "@/domain/entities/franchise-ops";
import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  meanRosterAge,
  meanRosterOverall,
  youngRosterSharePct,
} from "@/state/roster-strength";
import { getTeamPayroll } from "@/systems/salary-cap";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";

export type FranchiseIdentitySnapshotRow = {
  teamId: TeamId;
  aiProfile: AiProfile;
  spendingTolerance: number;
  patience: number;
  riskTolerance: number;
  marketSize: number;
  cash: number;
  payroll: number;
  ticketPrice: number;
  marketingBudget: number;
  reputation: number;
  fanSentiment: number;
  rosterAge: number;
  rosterOverall: number;
  youngSharePct: number;
  draftPickCount: number;
  developmentFacilityLevel: number;
  wins: number;
  losses: number;
};

export type IdentityFingerprintMeans = {
  profile: AiProfile;
  teamCount: number;
  meanCash: number;
  meanPayroll: number;
  meanRosterAge: number;
  meanYoungShare: number;
  meanDraftPicks: number;
  meanMarketing: number;
  meanDevFacilities: number;
  meanTicketPrice: number;
};

export function countOwnedDraftPicks(state: GameState, teamId: TeamId): number {
  let count = 0;
  for (const pick of Object.values(state.world.draftPicks)) {
    if (pick.ownerTeamId === teamId) {
      count += 1;
    }
  }
  return count;
}

function developmentFacilityLevel(state: GameState, teamId: TeamId): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return 0;
  }
  return (
    ops.facilities.practice.level +
    ops.facilities.training.level +
    ops.facilities.youth.level
  );
}

export function snapshotFranchiseIdentityRow(
  state: GameState,
  teamId: TeamId,
): FranchiseIdentitySnapshotRow | null {
  const ops = state.business.franchiseOps[teamId];
  const team = state.world.teams[teamId];
  if (!ops || !team) {
    return null;
  }
  const standing = state.competition.standings.byTeamId[teamId];
  return {
    teamId,
    aiProfile: ops.aiProfile,
    spendingTolerance: ops.spendingTolerance,
    patience: ops.patience,
    riskTolerance: ops.riskTolerance,
    marketSize: ops.marketSize,
    cash: state.business.finances[teamId]?.businessFunds ?? 0,
    payroll: getTeamPayroll(teamId, state.competition.season.year, state),
    ticketPrice: ops.ticketPrice,
    marketingBudget: ops.marketing.budget,
    reputation: team.reputation,
    fanSentiment: ops.fanSentiment,
    rosterAge: meanRosterAge(state, teamId),
    rosterOverall: meanRosterOverall(state, teamId),
    youngSharePct: youngRosterSharePct(state, teamId),
    draftPickCount: countOwnedDraftPicks(state, teamId),
    developmentFacilityLevel: developmentFacilityLevel(state, teamId),
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
  };
}

export function snapshotAllFranchiseIdentities(
  state: GameState,
): FranchiseIdentitySnapshotRow[] {
  const rows: FranchiseIdentitySnapshotRow[] = [];
  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    const row = snapshotFranchiseIdentityRow(state, teamId);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

/** Capture identity axes for drift detection. */
export function captureIdentityAxes(
  state: GameState,
): Record<
  string,
  {
    aiProfile: AiProfile;
    spendingTolerance: number;
    patience: number;
    riskTolerance: number;
  }
> {
  const out: Record<
    string,
    {
      aiProfile: AiProfile;
      spendingTolerance: number;
      patience: number;
      riskTolerance: number;
    }
  > = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    out[teamId] = {
      aiProfile: ops.aiProfile,
      spendingTolerance: ops.spendingTolerance,
      patience: ops.patience,
      riskTolerance: ops.riskTolerance,
    };
  }
  return out;
}

export function assertIdentityAxesUnchanged(
  before: ReturnType<typeof captureIdentityAxes>,
  after: GameState,
): void {
  for (const [teamId, prior] of Object.entries(before)) {
    const ops = after.business.franchiseOps[teamId];
    if (!ops) {
      throw new Error(`Identity drift: missing franchiseOps for ${teamId}`);
    }
    if (
      ops.aiProfile !== prior.aiProfile ||
      ops.spendingTolerance !== prior.spendingTolerance ||
      ops.patience !== prior.patience ||
      ops.riskTolerance !== prior.riskTolerance
    ) {
      throw new Error(
        `Identity drift on ${teamId}: was ${JSON.stringify(prior)}, now ${JSON.stringify(
          {
            aiProfile: ops.aiProfile,
            spendingTolerance: ops.spendingTolerance,
            patience: ops.patience,
            riskTolerance: ops.riskTolerance,
          },
        )}`,
      );
    }
  }
}

export function meanFingerprintsByProfile(
  rows: readonly FranchiseIdentitySnapshotRow[],
): IdentityFingerprintMeans[] {
  const groups = new Map<AiProfile, FranchiseIdentitySnapshotRow[]>();
  for (const row of rows) {
    const list = groups.get(row.aiProfile) ?? [];
    list.push(row);
    groups.set(row.aiProfile, list);
  }
  const means: IdentityFingerprintMeans[] = [];
  for (const [profile, list] of groups) {
    const n = list.length;
    const avg = (fn: (r: FranchiseIdentitySnapshotRow) => number) =>
      list.reduce((s, r) => s + fn(r), 0) / n;
    means.push({
      profile,
      teamCount: n,
      meanCash: avg((r) => r.cash),
      meanPayroll: avg((r) => r.payroll),
      meanRosterAge: avg((r) => r.rosterAge),
      meanYoungShare: avg((r) => r.youngSharePct),
      meanDraftPicks: avg((r) => r.draftPickCount),
      meanMarketing: avg((r) => r.marketingBudget),
      meanDevFacilities: avg((r) => r.developmentFacilityLevel),
      meanTicketPrice: avg((r) => r.ticketPrice),
    });
  }
  return means.sort((a, b) => a.profile.localeCompare(b.profile));
}

/**
 * Composite personality scores for coherence checks (developer/harness only).
 */
export function personalityCoherenceScores(
  state: GameState,
  teamId: TeamId,
): {
  winNowScore: number;
  rebuildScore: number;
  developmentScore: number;
} | null {
  const resolved = resolveFranchisePreferences(state, teamId);
  const row = snapshotFranchiseIdentityRow(state, teamId);
  if (!resolved || !row) {
    return null;
  }
  const p = resolved.preferences;
  return {
    winNowScore:
      p.winNowPressure * 0.4 +
      p.establishedPlayerValue * 0.3 +
      p.spendWillingness * 0.3,
    rebuildScore:
      p.rebuildPressure * 0.35 + p.pickValue * 0.35 + p.youthValue * 0.3,
    developmentScore:
      p.developmentPriority * 0.45 +
      p.youthValue * 0.35 +
      (row.developmentFacilityLevel / (FACILITY_CATEGORIES.length * 5)) * 0.2,
  };
}
