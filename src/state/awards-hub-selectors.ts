/**
 * Awards Hub presentation — lightweight season browser.
 * Composes award-selectors; does not invent voting data.
 */

import type { GameState } from "@/state/game-state";
import {
  toLeagueAwardsView,
  type LeagueAwardRowView,
} from "@/state/award-selectors";
import { AWARD_DEFINITIONS } from "@/systems/awards/award-definitions";

export type AwardsHubRow = LeagueAwardRowView & {
  seasonYear: number;
  awardId: string;
  cadence: "monthly" | "yearly";
  tier: string;
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
  midseasonAwards: AwardsHubRow[];
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
    const def = AWARD_DEFINITIONS[row.result.awardId as keyof typeof AWARD_DEFINITIONS];
    return {
      ...row,
      seasonYear: row.result.seasonYear,
      awardId: row.result.awardId,
      cadence: row.result.cadence,
      tier: def?.tier ?? "major",
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
    midseasonAwards: rows.filter((r) => r.tier === "midseason"),
    majorAwards: rows.filter(
      (r) => r.cadence === "yearly" && r.tier !== "midseason",
    ),
    monthlyAwards: rows.filter((r) => r.cadence === "monthly"),
  };
}
