import type { EconomicCycle } from "@/domain/entities/league-economy";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

const CYCLE_DRIFT: Record<EconomicCycle, { popularity: number; broadcast: number; sponsorship: number }> = {
  growth: { popularity: 1, broadcast: 1, sponsorship: 1 },
  stable: { popularity: 0, broadcast: 0, sponsorship: 0 },
  recession: { popularity: -1, broadcast: -1, sponsorship: -2 },
};

function clampLeagueMetric(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function nextCycle(current: EconomicCycle, popularity: number): EconomicCycle {
  if (popularity >= 70) {
    return "growth";
  }
  if (popularity <= 35) {
    return "recession";
  }
  return current === "growth" || current === "recession" ? "stable" : current;
}

export function processMonthlyLeagueEconomyDrift(state: GameState): SystemResult {
  const economy = state.business.leagueEconomy;
  const drift = CYCLE_DRIFT[economy.cycle];
  const popularity = clampLeagueMetric(economy.popularity + drift.popularity);
  const broadcastValue = clampLeagueMetric(
    economy.broadcastValue + drift.broadcast,
  );
  const sponsorshipClimate = clampLeagueMetric(
    economy.sponsorshipClimate + drift.sponsorship,
  );

  return systemResult({
    ...state,
    business: {
      ...state.business,
      leagueEconomy: {
        ...economy,
        popularity,
        broadcastValue,
        sponsorshipClimate,
      },
    },
  });
}

export function processSeasonalLeagueEconomy(state: GameState): SystemResult {
  const economy = state.business.leagueEconomy;
  const popularity = clampLeagueMetric(economy.popularity);
  return systemResult({
    ...state,
    business: {
      ...state.business,
      leagueEconomy: {
        ...economy,
        cycle: nextCycle(economy.cycle, popularity),
      },
    },
  });
}

/** National broadcast pool (integer dollars). */
export function computeLeagueBroadcastPool(state: GameState): number {
  return (
    state.business.leagueEconomy.broadcastValue *
    state.business.leagueEconomy.popularity *
    10_000
  );
}

/**
 * Weight for the market-weighted remainder of the broadcast pool.
 * Popularity/reputation change weights only — they cannot create money.
 */
export function broadcastMarketWeight(
  state: GameState,
  teamId: TeamId,
): number {
  const ops = state.business.franchiseOps[teamId];
  const team = state.world.teams[teamId];
  const marketSize = ops?.marketSize ?? 50;
  const reputation = team?.reputation ?? 50;
  // Market size dominates; light reputation mix.
  return Math.max(1, marketSize * 0.85 + reputation * 0.15);
}

/**
 * Deterministic per-team monthly broadcast distribution.
 *
 * Invariants:
 * - sum(distributions) === pool
 * - every team receives a non-negative share; when pool > 0, every team receives > 0
 * - sharing increases the equal component; when sharing is off, equal slice = 0
 * - weighted remainder is normalized and sums exactly to the pool remainder
 */
export function distributeMonthlyBroadcastPool(
  state: GameState,
): Record<TeamId, number> {
  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  const result: Record<string, number> = {};
  if (teamIds.length === 0) {
    return result;
  }

  const pool = computeLeagueBroadcastPool(state);
  if (pool <= 0) {
    for (const teamId of teamIds) {
      result[teamId] = 0;
    }
    return result;
  }

  const n = teamIds.length;
  const sharingEnabled = state.settings.financialRules.revenueSharingEnabled;
  const shareRate = sharingEnabled
    ? Math.max(0, Math.min(1, state.business.leagueEconomy.revenueSharingRate))
    : 0;

  // Equal component (floor). Remainder after equal slices goes to weighted.
  const equalTotal = Math.floor(pool * shareRate);
  const equalEach = Math.floor(equalTotal / n);
  let equalDistributed = equalEach * n;
  // Distribute leftover equal cents by sorted team id for determinism.
  let equalLeftover = equalTotal - equalDistributed;

  const weightedPool = pool - equalTotal;
  const weights = teamIds.map((teamId) => ({
    teamId,
    weight: broadcastMarketWeight(state, teamId),
  }));
  const weightSum = weights.reduce((sum, row) => sum + row.weight, 0);

  let weightedDistributed = 0;
  const weightedShares: Array<{ teamId: TeamId; amount: number }> = [];
  for (const row of weights) {
    const amount =
      weightSum > 0
        ? Math.floor((weightedPool * row.weight) / weightSum)
        : Math.floor(weightedPool / n);
    weightedShares.push({ teamId: row.teamId, amount });
    weightedDistributed += amount;
  }
  let weightedLeftover = weightedPool - weightedDistributed;

  for (const teamId of teamIds) {
    result[teamId] = equalEach;
  }
  for (const teamId of teamIds) {
    if (equalLeftover <= 0) {
      break;
    }
    result[teamId]! += 1;
    equalLeftover -= 1;
  }
  for (const row of weightedShares) {
    result[row.teamId]! += row.amount;
  }
  for (const teamId of teamIds) {
    if (weightedLeftover <= 0) {
      break;
    }
    result[teamId]! += 1;
    weightedLeftover -= 1;
  }

  // Safety: if somehow a team is still 0 with positive pool, give from largest.
  for (const teamId of teamIds) {
    if (result[teamId]! > 0) {
      continue;
    }
    const donor = teamIds.reduce((best, id) =>
      result[id]! > result[best]! ? id : best,
    );
    if (result[donor]! > 1) {
      result[donor]! -= 1;
      result[teamId] = 1;
    }
  }

  return result as Record<TeamId, number>;
}

/** Per-team monthly broadcast estimate (for projections). */
export function estimateMonthlyBroadcastShare(
  state: GameState,
  teamId?: TeamId,
): number {
  const teamCount = Object.keys(state.world.teams).length;
  if (teamCount === 0) {
    return 0;
  }
  const distributions = distributeMonthlyBroadcastPool(state);
  if (teamId) {
    return distributions[teamId] ?? 0;
  }
  // Legacy call sites without teamId: mean share (pool / n).
  const pool = computeLeagueBroadcastPool(state);
  return Math.floor(pool / teamCount);
}

/**
 * Distributes monthly national broadcast pool to all teams via revenue.broadcast.
 * Total posted equals the league pool.
 */
export function processMonthlyBroadcastRevenue(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const distributions = distributeMonthlyBroadcastPool(state);
  const teamIds = Object.keys(distributions).sort() as TeamId[];

  let current = state;
  const events: SystemResult["events"] = [];

  for (const teamId of teamIds) {
    const amount = distributions[teamId] ?? 0;
    if (amount <= 0) {
      continue;
    }
    const impact = applyCashAndBooksImpact(
      current,
      teamId,
      amount,
      year,
      { revenueCategory: "broadcast" },
    );
    current = impact.state;
    events.push(...impact.events);
  }

  return systemResult(current, events);
}
