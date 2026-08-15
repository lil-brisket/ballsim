import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { arenaCapacityForLevel } from "@/systems/facilities-config";

/**
 * Pure derived franchise valuation — never stored as live mutable state.
 * Used for season snapshots and UI selectors only.
 */
export function calculateFranchiseValue(
  state: GameState,
  teamId: TeamId,
): number {
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  const finances = state.business.finances[teamId];
  if (!team || !ops || !finances) {
    return 0;
  }

  const marketComponent = ops.marketSize * 5_000_000;
  const reputationComponent = team.reputation * 3_000_000;
  const sentimentComponent = ops.fanSentiment * 1_500_000;
  const cashComponent = Math.max(0, finances.cash) * 0.5;

  let facilitySum = 0;
  for (const category of FACILITY_CATEGORIES) {
    facilitySum += ops.facilities[category].level;
  }
  const facilityComponent = facilitySum * 2_000_000;

  const arenaLevel = ops.facilities.arena.level;
  const capacityComponent = arenaCapacityForLevel(arenaLevel) * 200;

  const leagueMultiplier =
    0.8 + state.business.leagueEconomy.popularity / 100 * 0.4;

  const raw =
    (marketComponent +
      reputationComponent +
      sentimentComponent +
      cashComponent +
      facilityComponent +
      capacityComponent) *
    leagueMultiplier;

  return Math.round(raw);
}
