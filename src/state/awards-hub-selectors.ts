/**
 * Awards Hub presentation — lightweight season browser.
 * Composes award-selectors; does not invent voting data.
 */

import type { GameState } from "@/state/game-state";
import {
  toLeagueAwardsView,
  type LeagueAwardRowView,
} from "@/state/award-selectors";

export type AwardsHubRow = LeagueAwardRowView & {
  seasonYear: number;
  awardId: string;
  cadence: "monthly" | "yearly";
  winnerSubjectType: string;
  winnerSubjectId: string;
  winnerTeamId: string | null;
  isHistorical: boolean;
};

export type AwardsHubView = {
  saveId: string;
  currentSeasonYear: number;
  selectedSeasonYear: number;
  isBrowsingHistorical: boolean;
  seasons: number[];
  majorAwards: AwardsHubRow[];
  monthlyAwards: AwardsHubRow[];
};

export function toAwardsHubView(
  state: GameState,
  filters?: { seasonYear?: number },
): AwardsHubView {
  const saveId = state.meta.saveId;
  const currentSeasonYear = state.competition.season.year;
  const base = toLeagueAwardsView(state, saveId, filters);
  const selectedSeasonYear =
    filters?.seasonYear ??
    base.seasons[0] ??
    currentSeasonYear;
  const isBrowsingHistorical = selectedSeasonYear !== currentSeasonYear;

  const filtered = toLeagueAwardsView(state, saveId, {
    seasonYear: selectedSeasonYear,
  });

  const rows: AwardsHubRow[] = filtered.rows.map((row) => {
    return {
      ...row,
      seasonYear: row.result.seasonYear,
      awardId: row.result.awardId,
      cadence: row.result.cadence,
      winnerSubjectType: row.result.winner.subjectType,
      winnerSubjectId: row.result.winner.subjectId,
      winnerTeamId: row.result.winner.teamId,
      isHistorical: row.result.seasonYear !== currentSeasonYear,
    };
  });

  return {
    saveId,
    currentSeasonYear,
    selectedSeasonYear,
    isBrowsingHistorical,
    seasons: base.seasons,
    majorAwards: rows.filter((r) => r.cadence === "yearly"),
    monthlyAwards: rows.filter((r) => r.cadence === "monthly"),
  };
}
