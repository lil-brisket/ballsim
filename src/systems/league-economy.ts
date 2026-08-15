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

/**
 * Distributes monthly national broadcast pool to all teams via revenue.other.
 */
export function processMonthlyBroadcastRevenue(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const teamCount = Object.keys(state.world.teams).length;
  if (teamCount === 0) {
    return systemResult(state);
  }

  const pool =
    state.business.leagueEconomy.broadcastValue *
    state.business.leagueEconomy.popularity *
    10_000;
  const shareRate = state.business.leagueEconomy.revenueSharingRate;
  const equalShare = Math.floor((pool * shareRate) / teamCount);
  const remaining = pool - equalShare * teamCount;
  const performanceShare = Math.floor(remaining / teamCount);

  let current = state;
  const events: SystemResult["events"] = [];

  for (const teamId of Object.keys(current.world.teams).sort()) {
    const amount = equalShare + performanceShare;
    if (amount <= 0) {
      continue;
    }
    const impact = applyCashAndBooksImpact(
      current,
      teamId as TeamId,
      amount,
      year,
      { revenueCategory: "other" },
    );
    current = impact.state;
    events.push(...impact.events);
  }

  return systemResult(current, events);
}
