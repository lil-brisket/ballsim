/**
 * Awards Hub presentation — lightweight season browser.
 * Composes award-selectors; does not invent voting data.
 */

import { getCalendarMonthId, parseCalendarDate } from "@/domain/calendar-date";
import type {
  AwardCandidateResult,
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
import {
  awardRaceThroughDate,
  evaluateAwardRace,
} from "@/systems/awards/award-race";
import { getPlayerIdentity } from "@/state/player-identity";

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

export type AwardRaceContenderView = {
  rank: number;
  subjectId: string;
  name: string;
  href: string | null;
  teamId: string | null;
  teamAbbreviation: string | null;
  score: number;
};

/** Weekly snapshot of who is in contention for an undecided award. */
export type AwardRaceView = {
  /** Last day of the completed week the race covers (YYYY-MM-DD). */
  throughDate: string;
  contenders: AwardRaceContenderView[];
};

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
  /** Pending slots only, when races were requested and someone qualifies. */
  race: AwardRaceView | null;
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
  majorAwards: AwardsHubRow[];
  monthlyAwards: AwardsHubRow[];
  currentSeasonGroups: CurrentSeasonAwardGroup[];
};

/** Midseason awards are retired, so that tier is never shown. */
type DisplayedAwardTier = Exclude<AwardTier, "midseason">;

const TIER_GROUP_LABELS: Record<DisplayedAwardTier, string> = {
  major: "Season awards",
  monthly: "Monthly awards",
};

const TIER_GROUP_ORDER: readonly DisplayedAwardTier[] = ["major", "monthly"];

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
    race: null,
  };
}

function majorStatus(state: GameState): AwardAvailability {
  const phase = state.competition.season.phase;
  if (phase === "preseason") return "not_started";
  if (phase === "regular") return "pending";
  return "not_applicable";
}

function toRaceContender(
  state: GameState,
  def: AwardDefinition,
  candidate: AwardCandidateResult,
): AwardRaceContenderView {
  const saveId = state.meta.saveId;
  let name: string = candidate.subjectId;
  let href: string | null = null;
  if (def.subjectType === "coach") {
    const coach = state.world.coaches[candidate.subjectId];
    if (coach) name = `${coach.firstName} ${coach.lastName}`;
  } else {
    name =
      getPlayerIdentity(state, candidate.subjectId)?.displayName ??
      candidate.subjectId;
    href = `/dashboard/${saveId}/players/${candidate.subjectId}`;
  }
  const team = candidate.teamId ? state.world.teams[candidate.teamId] : null;
  return {
    rank: candidate.rank,
    subjectId: candidate.subjectId,
    name,
    href,
    teamId: candidate.teamId,
    teamAbbreviation: team?.abbreviation ?? null,
    score: candidate.score,
  };
}

function attachRace(
  state: GameState,
  slot: CurrentSeasonAwardSlot,
  throughDate: string,
): CurrentSeasonAwardSlot {
  if (slot.status !== "pending") return slot;
  const race = evaluateAwardRace(state, slot.awardId, {
    throughDate,
    period: slot.period ?? undefined,
  });
  if (!race) return slot;
  const def = AWARD_DEFINITIONS[slot.awardId];
  return {
    ...slot,
    race: {
      throughDate: race.throughDate,
      contenders: race.contenders.map((c) => toRaceContender(state, def, c)),
    },
  };
}

/** "Week ending January 11" label for a race cut-off date. */
export function formatRaceWeekLabel(throughDate: string): string {
  const { day } = parseCalendarDate(throughDate);
  const month = formatPeriodLabel(getCalendarMonthId(throughDate))?.split(
    " ",
  )[0];
  return `Week ending ${month} ${day}`;
}

/**
 * Current-season award slots with explicit availability. Only catalog awards
 * from AWARD_DEFINITIONS appear; nothing is invented (e.g. no Finals MVP).
 * `races` adds the weekly contender list to pending slots; it re-scores the
 * season, so only the Current Season tab asks for it.
 */
export function toCurrentSeasonAwardGroups(
  state: GameState,
  options?: { races?: boolean },
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

  const throughDate = awardRaceThroughDate(state.world.calendar.currentDate);
  const withRaces = (slots: CurrentSeasonAwardSlot[]) =>
    options?.races
      ? slots.map((slot) => attachRace(state, slot, throughDate))
      : slots;
  const byTier: Record<DisplayedAwardTier, CurrentSeasonAwardSlot[]> = {
    major: withRaces(major),
    monthly: withRaces(monthly),
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
    majorAwards: rows.filter((r) => r.cadence === "yearly"),
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
