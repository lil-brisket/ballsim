import { createIdleExpansionState } from "@/domain/entities/expansion";
import { createEmptyFranchiseHistory } from "@/domain/entities/franchise-history";
import {
  createDefaultFranchiseOps,
  type FranchiseOps,
} from "@/domain/entities/franchise-ops";
import { createDefaultLeagueEconomy } from "@/domain/entities/league-economy";
import { createIdleRelocation } from "@/domain/entities/relocation";
import type { TeamId } from "@/domain/ids";
import { generateFranchiseIdentity } from "@/systems/franchise-identity-generation";

/**
 * Builds Phase E business maps for every team (ops, relocation, history).
 * Used by create-initial-state and schema migration defaults.
 *
 * @param rngSeed — save meta.rngSeed for deterministic identity; 0 is allowed
 *   for pure structural migrations that will be re-seeded later.
 */
export function createPhaseEBusinessDefaults(
  teamIds: readonly TeamId[],
  rngSeed = 0,
  cityStartSeasonYear = 0,
): {
  staffContracts: Record<string, never>;
  sponsorships: Record<string, never>;
  franchiseOps: Record<string, FranchiseOps>;
  leagueEconomy: ReturnType<typeof createDefaultLeagueEconomy>;
  relocationByTeamId: Record<string, ReturnType<typeof createIdleRelocation>>;
  expansion: ReturnType<typeof createIdleExpansionState>;
  franchiseHistory: Record<string, ReturnType<typeof createEmptyFranchiseHistory>>;
  franchiseReportCache: Record<string, never>;
  gameArchive: Record<string, never>;
  playerHistory: Record<string, never>;
} {
  const franchiseOps: Record<string, FranchiseOps> = {};
  const relocationByTeamId: Record<
    string,
    ReturnType<typeof createIdleRelocation>
  > = {};
  const franchiseHistory: Record<
    string,
    ReturnType<typeof createEmptyFranchiseHistory>
  > = {};

  const sorted = [...teamIds].sort();
  for (let i = 0; i < sorted.length; i += 1) {
    const teamId = sorted[i]!;
    // Deterministic market size from team id hash
    let hash = 0;
    for (let c = 0; c < teamId.length; c += 1) {
      hash = (hash + teamId.charCodeAt(c) * (c + 1)) % 997;
    }
    const marketSize = 35 + (hash % 45);
    const identity = generateFranchiseIdentity({
      rngSeed,
      teamId,
      marketSize,
    });
    franchiseOps[teamId] = createDefaultFranchiseOps({
      marketSize,
      aiProfile: identity.aiProfile,
      spendingTolerance: identity.spendingTolerance,
      patience: identity.patience,
      riskTolerance: identity.riskTolerance,
      foundedSeasonYear: cityStartSeasonYear || 2026,
    });
    relocationByTeamId[teamId] = createIdleRelocation(
      teamId,
      cityStartSeasonYear,
    );
    franchiseHistory[teamId] = createEmptyFranchiseHistory(teamId);
  }

  return {
    staffContracts: {},
    sponsorships: {},
    franchiseOps,
    leagueEconomy: createDefaultLeagueEconomy(),
    relocationByTeamId,
    expansion: createIdleExpansionState(),
    franchiseHistory,
    franchiseReportCache: {},
    gameArchive: {},
    playerHistory: {},
  };
}
