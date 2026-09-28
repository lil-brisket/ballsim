/**
 * League champion history — derived only from completed FranchiseSeasonRecord
 * snapshots (written at season_transition). Live playoffs are never read, so an
 * in-progress season cannot produce a champion.
 */

import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import type { GameState } from "@/state/game-state";

export type LeagueHistorySeasonRow = {
  seasonYear: number;
  championTeamId: string;
  /** Identity at that season's end (relocation-safe). */
  championName: string;
  championRecord: string;
  runnerUpTeamId?: string;
  runnerUpName?: string;
};

export type LeagueHistoryView = {
  seasons: LeagueHistorySeasonRow[];
  /** True when at least one row has a derivable runner-up. */
  hasRunnerUpData: boolean;
};

type SeasonEntry = { teamId: string; record: FranchiseSeasonRecord };

function snapshotName(record: FranchiseSeasonRecord): string {
  return `${record.city} ${record.name}`;
}

/**
 * Runner-up is exposed only when the championship-series loser is unambiguous:
 * the champion row carries "champion" and exactly one other team carries
 * "finals". Non-power-of-2 brackets (6/12) never emit "finals", so they
 * resolve to no runner-up rather than a guess.
 */
function resolveRunnerUp(
  champion: SeasonEntry,
  entries: readonly SeasonEntry[],
): SeasonEntry | undefined {
  if (champion.record.playoffResult !== "champion") {
    return undefined;
  }
  const finalsLosers = entries.filter(
    (entry) =>
      entry.teamId !== champion.teamId &&
      !entry.record.championship &&
      entry.record.playoffResult === "finals",
  );
  return finalsLosers.length === 1 ? finalsLosers[0] : undefined;
}

export function toLeagueHistoryView(state: GameState): LeagueHistoryView {
  const byYear = new Map<number, SeasonEntry[]>();
  for (const [teamId, history] of Object.entries(
    state.business.franchiseHistory,
  )) {
    for (const record of history.seasons) {
      const list = byYear.get(record.seasonYear) ?? [];
      list.push({ teamId, record });
      byYear.set(record.seasonYear, list);
    }
  }

  const seasons: LeagueHistorySeasonRow[] = [];
  for (const [seasonYear, entries] of byYear) {
    const champions = entries.filter((entry) => entry.record.championship);
    if (champions.length !== 1) {
      continue;
    }
    const champion = champions[0]!;
    const runnerUp = resolveRunnerUp(champion, entries);
    seasons.push({
      seasonYear,
      championTeamId: champion.teamId,
      championName: snapshotName(champion.record),
      championRecord: `${champion.record.wins}-${champion.record.losses}`,
      ...(runnerUp
        ? {
            runnerUpTeamId: runnerUp.teamId,
            runnerUpName: snapshotName(runnerUp.record),
          }
        : {}),
    });
  }

  seasons.sort((a, b) => b.seasonYear - a.seasonYear);
  return {
    seasons,
    hasRunnerUpData: seasons.some((row) => row.runnerUpTeamId !== undefined),
  };
}
