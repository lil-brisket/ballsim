import { createIdleExpansionState } from "@/domain/entities/expansion";
import { createEmptyFranchiseHistory } from "@/domain/entities/franchise-history";
import {
  createDefaultFranchiseOps,
  type AiProfile,
  type FranchiseOps,
} from "@/domain/entities/franchise-ops";
import { createDefaultLeagueEconomy } from "@/domain/entities/league-economy";
import { createIdleRelocation } from "@/domain/entities/relocation";
import type { TeamId } from "@/domain/ids";

const AI_PROFILE_CYCLE: readonly AiProfile[] = [
  "conservative",
  "win_now",
  "development",
  "aggressive",
  "market_growth",
];

/**
 * Builds Phase E business maps for every team (ops, relocation, history).
 * Used by create-initial-state and schema migration defaults.
 */
export function createPhaseEBusinessDefaults(teamIds: readonly TeamId[]): {
  staffContracts: Record<string, never>;
  sponsorships: Record<string, never>;
  franchiseOps: Record<string, FranchiseOps>;
  leagueEconomy: ReturnType<typeof createDefaultLeagueEconomy>;
  relocationByTeamId: Record<string, ReturnType<typeof createIdleRelocation>>;
  expansion: ReturnType<typeof createIdleExpansionState>;
  franchiseHistory: Record<string, ReturnType<typeof createEmptyFranchiseHistory>>;
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
    // Deterministic market size from team id hash + profile cycle
    let hash = 0;
    for (let c = 0; c < teamId.length; c += 1) {
      hash = (hash + teamId.charCodeAt(c) * (c + 1)) % 997;
    }
    const marketSize = 35 + (hash % 45);
    franchiseOps[teamId] = createDefaultFranchiseOps({
      marketSize,
      aiProfile: AI_PROFILE_CYCLE[i % AI_PROFILE_CYCLE.length]!,
    });
    relocationByTeamId[teamId] = createIdleRelocation(teamId);
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
  };
}
