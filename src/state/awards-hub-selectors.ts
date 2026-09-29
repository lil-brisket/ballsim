/**
 * Awards Hub presentation — lightweight season browser.
 * Composes award-selectors; does not invent voting data.
 */

import { getCalendarMonthId } from "@/domain/calendar-date";
import type {
  AwardCadence,
  AwardDefinition,
  AwardDefinitionId,
  AwardTier,
} from "@/domain/entities/awards";
import type { GameState } from "@/state/game-state";
import {
  formatPeriodLabel,
  toLeagueAwardsView,
  type LeagueAwardRowView,
} from "@/state/award-selectors";
import {
  AWARD_DEFINITIONS,
  MONTHLY_AWARD_IDS,
  YEARLY_AWARD_IDS,
} from "@/systems/awards/award-definitions";

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

/**
 * Semantic state of a current-season award slot. Derived here so the UI only
 * maps status to copy:
 * - won: an AwardResult exists
 * - pending: evaluation window is open, no result yet
 * - not_started: evaluation window has not opened
 * - not_applicable: window closed or event absent/cancelled with no result
 */
export type AwardAvailability =
  "won" | "pending" | "not_started" | "not_applicable";

export type CurrentSeasonAwardSlot = {
  key: string;
  awardId: AwardDefinitionId;
  displayName: string;
  shortLabel: string;
  tier: AwardTier;
  cadence: AwardCadence;
  /** YYYY-MM for monthly slots; null otherwise. */
  period: string | null;
  periodLabel: string | null;
  status: AwardAvailability;
  winner: AwardsHubRow | null;
};

export type CurrentSeasonAwardGroup = {
  tier: AwardTier;
  label: string;
  slots: CurrentSeasonAwardSlot[];
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
  currentSeasonGroups: CurrentSeasonAwardGroup[];
};

const TIER_GROUP_LABELS: Record<AwardTier, string> = {
  major: "Season awards",
  midseason: "Midseason awards",
  monthly: "Monthly awards",
};

const TIER_GROUP_ORDER: readonly AwardTier[] = [
  "major",
  "midseason",
  "monthly",
];

function toHubRows(
  state: GameState,
  filters?: { seasonYear?: number; awardId?: AwardDefinitionId },
): AwardsHubRow[] {
  const currentSeasonYear = state.competition.season.year;
  return toLeagueAwardsView(state, state.meta.saveId, filters).rows.map(
    (row) => {
      const def = AWARD_DEFINITIONS[row.result.awardId];
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
    },
  );
}

function slotFor(
  def: AwardDefinition,
  period: string | null,
  status: AwardAvailability,
  winner: AwardsHubRow | null,
): CurrentSeasonAwardSlot {
  return {
    key: `${def.id}:${period ?? "season"}`,
    awardId: def.id,
    displayName: def.displayName,
    shortLabel: def.shortLabel,
    tier: def.tier,
    cadence: def.cadence,
    period,
    periodLabel: def.cadence === "monthly" ? formatPeriodLabel(period) : null,
    status,
    winner,
  };
}

function majorStatus(state: GameState): AwardAvailability {
  const phase = state.competition.season.phase;
  if (phase === "preseason") return "not_started";
  if (phase === "regular") return "pending";
  return "not_applicable";
}

function midseasonStatus(state: GameState): AwardAvailability {
  const season = state.competition.season;
  const midseason = state.competition.seasonEvents?.midseasonAwards;
  if (
    !midseason ||
    midseason.seasonId !== season.id ||
    midseason.status !== "scheduled"
  ) {
    return "not_applicable";
  }
  if (season.phase === "preseason") return "not_started";
  if (season.phase !== "regular") return "not_applicable";
  return state.world.calendar.currentDate < midseason.cutoffDate
    ? "not_started"
    : "pending";
}

/**
 * Current-season award slots with explicit availability. Only catalog awards
 * from AWARD_DEFINITIONS appear; nothing is invented (e.g. no Finals MVP).
 */
export function toCurrentSeasonAwardGroups(
  state: GameState,
): CurrentSeasonAwardGroup[] {
  const seasonYear = state.competition.season.year;
  const rows = toHubRows(state, { seasonYear });
  const yearlyRow = (awardId: AwardDefinitionId, period: string | null) =>
    rows.find(
      (row) => row.result.awardId === awardId && row.result.period === period,
    ) ?? null;

  const defs = Object.values(AWARD_DEFINITIONS);
  const major = defs
    .filter((def) => def.tier === "major")
    .map((def) => {
      const winner = yearlyRow(def.id, null);
      return slotFor(def, null, winner ? "won" : majorStatus(state), winner);
    });

  const midseason = defs
    .filter((def) => def.tier === "midseason")
    .map((def) => {
      const winner = yearlyRow(def.id, "midseason");
      return slotFor(
        def,
        null,
        winner ? "won" : midseasonStatus(state),
        winner,
      );
    });

  const monthly: CurrentSeasonAwardSlot[] = rows
    .filter((row) => row.result.cadence === "monthly")
    .map((row) =>
      slotFor(
        AWARD_DEFINITIONS[row.result.awardId],
        row.result.period,
        "won",
        row,
      ),
    );
  const phase = state.competition.season.phase;
  if (phase === "preseason") {
    for (const awardId of MONTHLY_AWARD_IDS) {
      monthly.push(
        slotFor(AWARD_DEFINITIONS[awardId], null, "not_started", null),
      );
    }
  } else if (phase === "regular") {
    const currentMonth = getCalendarMonthId(state.world.calendar.currentDate);
    for (const awardId of MONTHLY_AWARD_IDS) {
      const decided = monthly.some(
        (slot) => slot.awardId === awardId && slot.period === currentMonth,
      );
      if (!decided) {
        monthly.push(
          slotFor(AWARD_DEFINITIONS[awardId], currentMonth, "pending", null),
        );
      }
    }
  }
  monthly.sort(
    (a, b) =>
      (b.period ?? "").localeCompare(a.period ?? "") ||
      MONTHLY_AWARD_IDS.indexOf(a.awardId) -
        MONTHLY_AWARD_IDS.indexOf(b.awardId),
  );

  const byTier: Record<AwardTier, CurrentSeasonAwardSlot[]> = {
    major,
    midseason,
    monthly,
  };
  return TIER_GROUP_ORDER.map((tier) => ({
    tier,
    label: TIER_GROUP_LABELS[tier],
    slots: byTier[tier],
  }));
}

export function toAwardsHubView(
  state: GameState,
  filters?: { seasonYear?: number },
): AwardsHubView {
  const saveId = state.meta.saveId;
  const currentSeasonYear = state.competition.season.year;
  const base = toLeagueAwardsView(state, saveId, filters);
  const selectedSeasonYear =
    filters?.seasonYear ?? base.seasons[0] ?? currentSeasonYear;
  const isBrowsingHistorical = selectedSeasonYear !== currentSeasonYear;

  const rows = toHubRows(state, { seasonYear: selectedSeasonYear });

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
    currentSeasonGroups: toCurrentSeasonAwardGroups(state),
  };
}

export type AwardHistorySeason = {
  seasonYear: number;
  isCurrentSeason: boolean;
  /** Completed results for this season, catalog order then newest period. */
  winners: AwardsHubRow[];
  /** Full-season (period null) winners keyed by award id for pivot layouts. */
  yearlyByAwardId: Partial<Record<AwardDefinitionId, AwardsHubRow>>;
};

export type AwardHistorySeasonSelection = number | "all";

export type AwardHistoryView = {
  hasHistory: boolean;
  currentSeasonYear: number;
  availableSeasons: number[];
  selectedSeason: AwardHistorySeasonSelection | null;
  awardFilter: AwardDefinitionId | null;
  /** Catalog definitions (layout-agnostic). */
  definitions: AwardDefinition[];
  /** Suggested compact pivot columns; not every award is a column. */
  pivotAwardIds: readonly AwardDefinitionId[];
  seasons: AwardHistorySeason[];
};

const AWARD_CATALOG_ORDER = Object.keys(
  AWARD_DEFINITIONS,
) as AwardDefinitionId[];

function isCompletedAwardSeason(
  state: GameState,
  seasonYear: number,
  rows: readonly AwardsHubRow[],
): boolean {
  if (seasonYear < state.competition.season.year) return true;
  return rows.some(
    (row) =>
      row.seasonYear === seasonYear &&
      row.result.period === null &&
      AWARD_DEFINITIONS[row.result.awardId].tier === "major",
  );
}

/**
 * Season-grouped history of completed award results. Only existing
 * AwardResult rows appear, so in-progress awards are omitted by construction.
 * Default selection: most recent completed season, else latest season with
 * any result.
 */
export function toAwardHistoryView(
  state: GameState,
  options?: {
    seasonYear?: AwardHistorySeasonSelection;
    awardId?: AwardDefinitionId;
  },
): AwardHistoryView {
  const currentSeasonYear = state.competition.season.year;
  const allRows = toHubRows(state);
  const availableSeasons = [...new Set(allRows.map((r) => r.seasonYear))].sort(
    (a, b) => b - a,
  );

  const requested = options?.seasonYear;
  const defaultSeason =
    availableSeasons.find((year) =>
      isCompletedAwardSeason(state, year, allRows),
    ) ??
    availableSeasons[0] ??
    null;
  const selectedSeason: AwardHistorySeasonSelection | null =
    requested === "all"
      ? "all"
      : requested !== undefined && availableSeasons.includes(requested)
        ? requested
        : defaultSeason;

  const awardFilter =
    options?.awardId && AWARD_DEFINITIONS[options.awardId]
      ? options.awardId
      : null;
  const rows = awardFilter
    ? allRows.filter((row) => row.result.awardId === awardFilter)
    : allRows;

  const seasonYears =
    selectedSeason === "all"
      ? availableSeasons
      : selectedSeason === null
        ? []
        : [selectedSeason];

  const seasons: AwardHistorySeason[] = seasonYears.map((seasonYear) => {
    const winners = rows
      .filter((row) => row.seasonYear === seasonYear)
      .sort(
        (a, b) =>
          AWARD_CATALOG_ORDER.indexOf(a.result.awardId) -
            AWARD_CATALOG_ORDER.indexOf(b.result.awardId) ||
          (b.result.period ?? "").localeCompare(a.result.period ?? ""),
      );
    const yearlyByAwardId: Partial<Record<AwardDefinitionId, AwardsHubRow>> =
      {};
    for (const row of winners) {
      if (row.result.period === null) {
        yearlyByAwardId[row.result.awardId] = row;
      }
    }
    return {
      seasonYear,
      isCurrentSeason: seasonYear === currentSeasonYear,
      winners,
      yearlyByAwardId,
    };
  });

  return {
    hasHistory: allRows.length > 0,
    currentSeasonYear,
    availableSeasons,
    selectedSeason,
    awardFilter,
    definitions: AWARD_CATALOG_ORDER.map((id) => AWARD_DEFINITIONS[id]),
    pivotAwardIds: YEARLY_AWARD_IDS,
    seasons,
  };
}
