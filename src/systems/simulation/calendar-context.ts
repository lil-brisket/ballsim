/**
 * Derived Owner Mode calendar spine.
 * Persisted source of truth remains SeasonPhase + OffseasonStage.
 * Do not invent month checks elsewhere — read getCalendarContext.
 */

import {
  addCalendarDays,
  calendarDaysBetween,
} from "@/domain/calendar-date";
import type { OffseasonStage, SeasonPhase } from "@/domain/entities/season";
import type { TradeDeadlineRule } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isContractActive } from "@/domain/entities/contract";
import { STARTER_ROLES } from "@/systems/staff-generation";
import { CALENDAR_CONTEXT_CONFIG } from "@/systems/simulation/calendar-context-config";
import { assessRelocation } from "@/state/relocation-assessment";
import { TRADE_DEADLINE_SEASON_FRACTION } from "@/systems/league-rules/invariants";

export type SeasonSegment =
  | "none"
  | "early"
  | "mid"
  | "deadline_window"
  | "late";

export type PlayoffRaceStatus =
  | "not_applicable"
  | "contending"
  | "bubble"
  | "clinched"
  | "eliminated";

export type OffseasonPriorityKey =
  | "season_review"
  | "contracts"
  | "free_agency"
  | "draft"
  | "staff"
  | "facilities"
  | "marketing"
  | "sponsorships"
  | "relocation";

export type CalendarContext = {
  lifecyclePhase: SeasonPhase;
  offseasonStage: OffseasonStage;
  seasonSegment: SeasonSegment;
  displayLabel: string;
  /** 0–1 along [seasonStart, regularSeasonEnd]; 0 when unknown. */
  regularSeasonProgress: number;
  /** League-wide remaining scheduled regular-season games. */
  gamesRemaining: number;
  tradeDeadlineDate: string | null;
  daysUntilTradeDeadline: number | null;
  tradesOpen: boolean;
  deadlineWindow: boolean;
  playoffRace: PlayoffRaceStatus;
  offseasonPriorities: readonly OffseasonPriorityKey[];
  /** Short derived story beat; empty when nothing notable. */
  seasonStory: string;
};

/**
 * Identity string for stopOnPhaseChange — includes season segment so
 * deadline window open/close stops multi-day advances.
 */
export function lifecycleIdentity(state: GameState): string {
  const season = state.competition.season;
  const phaseId =
    state.competition.phase?.activePhaseId ??
    `${season.phase}|${season.offseasonStage}`;
  const segment =
    season.phase === "regular"
      ? getCalendarContext(state).seasonSegment
      : "none";
  return `${phaseId}|${season.year}|${segment}`;
}

export function getCalendarContext(state: GameState): CalendarContext {
  const lifecyclePhase = state.competition.season.phase;
  const offseasonStage = state.competition.season.offseasonStage;
  const currentDate = state.world.calendar.currentDate;

  const scheduleBounds = readRegularSeasonScheduleBounds(state);
  const seasonStart =
    state.competition.season.regularSeasonStartDate ??
    scheduleBounds.earliestGameDate;
  const seasonEnd = scheduleBounds.latestGameDate;

  const tradeDeadlineDate =
    state.competition.season.tradeDeadlineDate ??
    resolveTradeDeadlineDate(
      state.settings.regularSeason.tradeDeadlineRule,
      seasonStart,
      seasonEnd,
    );

  const gamesRemaining = countRemainingRegularGames(state);
  const regularSeasonProgress = computeRegularSeasonProgress(
    currentDate,
    seasonStart,
    seasonEnd,
    state,
  );

  const tradesOpen = areTradesOpen(lifecyclePhase, currentDate, tradeDeadlineDate);
  const daysUntilTradeDeadline =
    tradeDeadlineDate === null
      ? null
      : calendarDaysBetween(currentDate, tradeDeadlineDate);

  const seasonSegment = resolveSeasonSegment({
    lifecyclePhase,
    tradesOpen,
    daysUntilTradeDeadline,
    regularSeasonProgress,
  });

  const deadlineWindow = seasonSegment === "deadline_window";
  const playoffRace = resolvePlayoffRace(state);
  const offseasonPriorities = resolveOffseasonPriorities(state);
  const displayLabel = resolveDisplayLabel(
    lifecyclePhase,
    offseasonStage,
    seasonSegment,
  );
  const seasonStory = resolveSeasonStory(state, {
    lifecyclePhase,
    seasonSegment,
    playoffRace,
    tradesOpen,
    daysUntilTradeDeadline,
  });

  return {
    lifecyclePhase,
    offseasonStage,
    seasonSegment,
    displayLabel,
    regularSeasonProgress,
    gamesRemaining,
    tradeDeadlineDate,
    daysUntilTradeDeadline,
    tradesOpen,
    deadlineWindow,
    playoffRace,
    offseasonPriorities,
    seasonStory,
  };
}

export function areTradesOpen(
  lifecyclePhase: SeasonPhase,
  currentDate: string,
  tradeDeadlineDate: string | null,
): boolean {
  if (lifecyclePhase !== "regular") {
    return false;
  }
  if (tradeDeadlineDate === null) {
    // No deadline yet (no schedule / start) — allow trades during regular.
    return true;
  }
  // Hard lock: deadline day itself is closed (currentDate < deadline).
  return currentDate < tradeDeadlineDate;
}

/**
 * Trade deadline from 60% of regular-season calendar span (hard lock).
 * Not based on games played. Prefer settings only for days_after_season_start legacy.
 */
export function resolveTradeDeadlineDate(
  rule: TradeDeadlineRule,
  seasonStart: string | null,
  seasonEnd: string | null,
): string | null {
  if (seasonStart === null) {
    return null;
  }
  if (rule.kind === "days_after_season_start") {
    return addCalendarDays(seasonStart, rule.daysAfterSeasonStart);
  }
  // Hard lock: always use TRADE_DEADLINE_SEASON_FRACTION (0.6), ignore settings fraction.
  if (seasonEnd === null || seasonEnd < seasonStart) {
    return null;
  }
  const spanDays = calendarDaysBetween(seasonStart, seasonEnd);
  const offset = Math.max(
    0,
    Math.round(spanDays * TRADE_DEADLINE_SEASON_FRACTION),
  );
  return addCalendarDays(seasonStart, offset);
}

function readRegularSeasonScheduleBounds(state: GameState): {
  earliestGameDate: string | null;
  latestGameDate: string | null;
} {
  const { schedule, games } = state.competition;
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const gameId of schedule.gameIds) {
    const game = games[gameId];
    if (!game) {
      continue;
    }
    if (earliest === null || game.date < earliest) {
      earliest = game.date;
    }
    if (latest === null || game.date > latest) {
      latest = game.date;
    }
  }
  return { earliestGameDate: earliest, latestGameDate: latest };
}

function countRemainingRegularGames(state: GameState): number {
  let remaining = 0;
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (game && game.status !== "final") {
      remaining += 1;
    }
  }
  return remaining;
}

function computeRegularSeasonProgress(
  currentDate: string,
  seasonStart: string | null,
  seasonEnd: string | null,
  state: GameState,
): number {
  if (seasonStart !== null && seasonEnd !== null && seasonEnd >= seasonStart) {
    const span = calendarDaysBetween(seasonStart, seasonEnd);
    if (span <= 0) {
      return currentDate >= seasonEnd ? 1 : 0;
    }
    const elapsed = calendarDaysBetween(seasonStart, currentDate);
    return Math.max(0, Math.min(1, elapsed / span));
  }
  const total = state.competition.schedule.gameIds.length;
  if (total === 0) {
    return 0;
  }
  const remaining = countRemainingRegularGames(state);
  return Math.max(0, Math.min(1, (total - remaining) / total));
}

function resolveSeasonSegment(input: {
  lifecyclePhase: SeasonPhase;
  tradesOpen: boolean;
  daysUntilTradeDeadline: number | null;
  regularSeasonProgress: number;
}): SeasonSegment {
  if (input.lifecyclePhase !== "regular") {
    return "none";
  }
  if (!input.tradesOpen) {
    return "late";
  }
  if (
    input.daysUntilTradeDeadline !== null &&
    input.daysUntilTradeDeadline >= 0 &&
    input.daysUntilTradeDeadline <= CALENDAR_CONTEXT_CONFIG.deadlineWindowDays
  ) {
    return "deadline_window";
  }
  if (input.regularSeasonProgress < CALENDAR_CONTEXT_CONFIG.earlyProgressMax) {
    return "early";
  }
  return "mid";
}

function resolveDisplayLabel(
  phase: SeasonPhase,
  stage: OffseasonStage,
  segment: SeasonSegment,
): string {
  switch (phase) {
    case "preseason":
      return "Preseason";
    case "regular":
      if (segment === "deadline_window") {
        return "Trade Deadline";
      }
      if (segment === "early") {
        return "Early Season";
      }
      if (segment === "late") {
        return "Late Season";
      }
      return "Regular Season";
    case "playoffs":
      return "Playoffs";
    case "postseason":
      return "Season Review";
    case "offseason":
      if (stage === "free_agency") {
        return "Free Agency";
      }
      if (stage === "draft") {
        return "Draft";
      }
      return "Offseason";
    default:
      return phase;
  }
}

function resolvePlayoffRace(state: GameState): PlayoffRaceStatus {
  const phase = state.competition.season.phase;
  if (phase === "playoffs") {
    return "contending";
  }
  if (phase !== "regular") {
    return "not_applicable";
  }
  const playoffTeams = state.settings.playoffs.playoffTeams;
  const teamId = state.user.activeOwnerTeamId;
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing || playoffTeams <= 0) {
    return "not_applicable";
  }

  const conferenceId = state.world.teams[teamId]?.conferenceId;
  const ranked = Object.values(state.competition.standings.byTeamId)
    .filter((row) => {
      if (!conferenceId) {
        return true;
      }
      return state.world.teams[row.teamId]?.conferenceId === conferenceId;
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      return a.losses - b.losses;
    });

  const conferencePlayoffSpots =
    conferenceId && Object.keys(state.world.conferences).length > 1
      ? Math.ceil(
          playoffTeams / Math.max(1, Object.keys(state.world.conferences).length),
        )
      : playoffTeams;

  const rank =
    ranked.findIndex((row) => row.teamId === teamId) + 1 || ranked.length;
  const gamesPlayed = standing.wins + standing.losses;
  if (gamesPlayed === 0) {
    return "not_applicable";
  }

  const cutoff = ranked[conferencePlayoffSpots - 1];
  const bubbleFloor = ranked[conferencePlayoffSpots];
  if (rank <= conferencePlayoffSpots) {
    if (
      bubbleFloor &&
      standing.wins - bubbleFloor.wins <= CALENDAR_CONTEXT_CONFIG.playoffBubbleGames &&
      countRemainingRegularGames(state) > 0
    ) {
      return "bubble";
    }
    if (countRemainingRegularGames(state) === 0) {
      return "clinched";
    }
    return "contending";
  }
  if (
    cutoff &&
    cutoff.wins - standing.wins > CALENDAR_CONTEXT_CONFIG.playoffBubbleGames &&
    countRemainingRegularGames(state) <
      (cutoff.wins - standing.wins) * 2
  ) {
    return "eliminated";
  }
  return "bubble";
}

function resolveOffseasonPriorities(
  state: GameState,
): readonly OffseasonPriorityKey[] {
  const phase = state.competition.season.phase;
  const stage = state.competition.season.offseasonStage;
  const teamId = state.user.activeOwnerTeamId;
  const priorities: OffseasonPriorityKey[] = [];

  if (phase === "postseason") {
    priorities.push("season_review");
    return priorities;
  }

  if (phase !== "offseason" && phase !== "preseason") {
    return priorities;
  }

  if (stage === "free_agency") {
    priorities.push("free_agency");
  }
  if (stage === "draft") {
    priorities.push("draft");
  }

  const year = state.competition.season.year;
    const expiring = Object.values(state.business.contracts).filter(
    (contract) =>
      contract.teamId === teamId &&
      isContractActive(contract, year) &&
      contract.endYear <= year + 1,
  );
  if (expiring.length > 0 || stage === "contract_expiration") {
    priorities.push("contracts");
  }

  const staffRoles = new Set(
    Object.values(state.world.staff)
      .filter((staff) => staff.teamId === teamId)
      .map((staff) => staff.role),
  );
  for (const role of STARTER_ROLES) {
    if (!staffRoles.has(role)) {
      priorities.push("staff");
      break;
    }
  }

  const ops = state.business.franchiseOps[teamId];
  if (ops) {
    const hasUpgrade = Object.values(ops.facilities).some(
      (facility) => facility.upgradeWeeksRemaining === 0,
    );
    // Always surface facilities as a planning item in offseason.
    priorities.push("facilities");
    void hasUpgrade;
    priorities.push("marketing");
  }

  const hasExpiringSponsor = Object.values(state.business.sponsorships).some(
    (sponsor) =>
      sponsor.teamId === teamId &&
      sponsor.status === "active" &&
      sponsor.endYear <= year,
  );
  if (hasExpiringSponsor || phase === "offseason") {
    priorities.push("sponsorships");
  }

  const relocation = state.business.relocationByTeamId[teamId];
  const relocInProgress =
    relocation !== undefined &&
    relocation.stage !== "none" &&
    relocation.stage !== "complete" &&
    relocation.stage !== "rejected";
  if (relocInProgress) {
    priorities.push("relocation");
  } else {
    const assessment = assessRelocation(state, teamId);
    if (
      assessment.status === "consider" ||
      assessment.status === "strong_case"
    ) {
      priorities.push("relocation");
    }
  }

  return uniquePriorities(priorities);
}

function uniquePriorities(
  keys: readonly OffseasonPriorityKey[],
): readonly OffseasonPriorityKey[] {
  const seen = new Set<OffseasonPriorityKey>();
  const out: OffseasonPriorityKey[] = [];
  for (const key of keys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(key);
  }
  return out;
}

function resolveSeasonStory(
  state: GameState,
  ctx: {
    lifecyclePhase: SeasonPhase;
    seasonSegment: SeasonSegment;
    playoffRace: PlayoffRaceStatus;
    tradesOpen: boolean;
    daysUntilTradeDeadline: number | null;
  },
): string {
  const teamId = state.user.activeOwnerTeamId;
  const standing = state.competition.standings.byTeamId[teamId];
  const ops = state.business.franchiseOps[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const record = `${wins}–${losses}`;

  if (ctx.lifecyclePhase === "postseason") {
    const playoffResult = deriveControlledPlayoffLine(state, teamId);
    return `Season complete (${record}). ${playoffResult} Review results before opening the offseason.`;
  }

  if (ctx.lifecyclePhase === "offseason") {
    if (state.competition.season.offseasonStage === "free_agency") {
      return "Free agency is open — reshape the roster for next season.";
    }
    if (state.competition.season.offseasonStage === "draft") {
      return "The draft is underway — select prospects that fit your strategy.";
    }
    return "Offseason planning — staff, facilities, and commercial decisions matter now.";
  }

  if (ctx.lifecyclePhase === "playoffs") {
    return `Playoffs in progress (${record}). Every series changes franchise trajectory.`;
  }

  if (ctx.lifecyclePhase === "regular") {
    if (ctx.seasonSegment === "deadline_window") {
      const days = ctx.daysUntilTradeDeadline ?? 0;
      const race =
        ctx.playoffRace === "bubble"
          ? " Playoff bubble decisions loom."
          : ctx.playoffRace === "contending"
            ? " Contenders look for upgrades."
            : ctx.playoffRace === "eliminated"
              ? " Sellers may move veterans."
              : "";
      return `Trade deadline in ${days} day${days === 1 ? "" : "s"} (${record}).${race}`;
    }
    if (ctx.seasonSegment === "late") {
      if (ctx.playoffRace === "bubble") {
        return `Late season playoff race (${record}). Every remaining game matters.`;
      }
      if (ctx.playoffRace === "eliminated") {
        return `Out of the race (${record}). Focus on development and next season.`;
      }
      return `Late season (${record}). Positioning for the postseason.`;
    }
    if (ctx.seasonSegment === "early") {
      const sentiment = ops?.fanSentiment ?? 50;
      if (sentiment >= 60 && wins > losses) {
        return `Strong start (${record}). Attendance and sentiment are tracking well.`;
      }
      if (wins + losses >= 5 && losses > wins) {
        return `Slow start (${record}). Early trends are forming.`;
      }
      return `Early season (${record}). Establishing trends.`;
    }
    return `Midseason (${record}). Evaluate whether this roster is working.`;
  }

  if (ctx.lifecyclePhase === "preseason") {
    return "Season preparation — the regular season opens next.";
  }

  return "";
}

function deriveControlledPlayoffLine(
  state: GameState,
  teamId: TeamId,
): string {
  const champion = state.competition.playoffs.championTeamId;
  if (champion === teamId) {
    return "Championship secured.";
  }
  const made = state.competition.playoffs.qualifiedTeams.some(
    (seed) => seed.teamId === teamId,
  );
  if (state.competition.playoffs.status === "complete") {
    return made ? "Playoff run finished." : "Missed the playoffs.";
  }
  return made ? "Playoff appearance recorded." : "Missed the playoffs.";
}
