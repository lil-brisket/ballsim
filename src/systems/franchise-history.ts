import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type {
  FranchiseHistory,
  FranchiseSeasonRecord,
  PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import { getFinancialStatement } from "@/systems/team-finances";

export type AppendFranchiseSeasonRecordInput = {
  teamId: TeamId;
  playoffResult?: PlayoffResultSnapshot;
  championship?: boolean;
  relocated?: boolean;
  notableEventIds?: string[];
};

function facilityLevelsSnapshot(
  state: GameState,
  teamId: TeamId,
): Record<FacilityCategory, number> {
  const ops = state.business.franchiseOps[teamId];
  const levels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    levels[category] = ops?.facilities[category].level ?? 1;
  }
  return levels;
}

/**
 * Appends a season-end snapshot to franchise history for one team.
 */
export function appendFranchiseSeasonRecord(
  state: GameState,
  input: AppendFranchiseSeasonRecordInput,
): SystemResult {
  const { teamId } = input;
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  if (!team || !ops) {
    throw new Error(`appendFranchiseSeasonRecord: team "${teamId}" missing.`);
  }

  const season = state.competition.season;
  const standing = state.competition.standings.byTeamId[teamId];
  const year = season.year;
  const statement = getFinancialStatement(state, teamId, year);
  const finances = state.business.finances[teamId];

  const record: FranchiseSeasonRecord = {
    seasonId: season.id,
    seasonYear: year,
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
    playoffResult: input.playoffResult ?? "missed",
    championship: input.championship ?? false,
    revenue: statement.revenue.total,
    cash: finances?.cash ?? 0,
    fanSentiment: ops.fanSentiment,
    reputation: team.reputation,
    facilityLevels: facilityLevelsSnapshot(state, teamId),
    relocated: input.relocated ?? false,
    notableEventIds: input.notableEventIds ?? [],
    franchiseValue: calculateFranchiseValue(state, teamId),
  };

  const existing: FranchiseHistory =
    state.business.franchiseHistory[teamId] ?? {
      teamId,
      seasons: [],
    };

  return systemResult({
    ...state,
    business: {
      ...state.business,
      franchiseHistory: {
        ...state.business.franchiseHistory,
        [teamId]: {
          teamId,
          seasons: [...existing.seasons, record],
        },
      },
    },
  });
}

/**
 * Append season records for every team at season finalization.
 * Idempotent for the current seasonId (skips teams that already have it).
 */
export function appendAllFranchiseSeasonRecords(state: GameState): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];
  const championId = state.competition.playoffs.championTeamId ?? null;
  const playoffResultByTeam = derivePlayoffResults(state);

  for (const teamId of Object.keys(current.world.teams).sort() as TeamId[]) {
    const history = current.business.franchiseHistory[teamId];
    const already =
      history?.seasons.some((s) => s.seasonId === current.competition.season.id) ??
      false;
    if (already) {
      continue;
    }
    const result = appendFranchiseSeasonRecord(current, {
      teamId,
      playoffResult: playoffResultByTeam[teamId] ?? "missed",
      championship: championId === teamId,
      relocated:
        current.business.relocationByTeamId[teamId]?.stage === "complete",
    });
    current = result.state;
    events.push(...result.events);
  }
  return systemResult(current, events);
}

function derivePlayoffResults(
  state: GameState,
): Record<string, PlayoffResultSnapshot> {
  const results: Record<string, PlayoffResultSnapshot> = {};
  const playoffs = state.competition.playoffs;
  for (const seed of playoffs.qualifiedTeams) {
    results[seed.teamId] = "first_round";
  }
  if (playoffs.championTeamId) {
    results[playoffs.championTeamId] = "champion";
  }
  return results;
}
