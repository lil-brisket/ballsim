import "server-only";
import type {
  SaveGameSummary,
  SaveGameStore,
} from "@/persistence/save-game-store";
import { type DashboardSnapshot, toDashboardSnapshot } from "@/state/selectors";
import {
  type CalendarMonthGrid,
  getCalendarMonthGrid,
  buildCalendarDateInspectorView,
  getNextTeamGameDate,
  getTeamGamesForDate,
} from "@/systems/calendar";
import { toGameBoxScoreView } from "@/state/selectors";
import {
  type CalendarGameStatsView,
  toCalendarGameStatsView,
} from "@/state/selectors/calendar-game-stats";
import { canWatchGame } from "@/state/watch-game-selectors";
import {
  type TeamBrandingView,
  toBrandingView,
} from "@/state/team-branding-view";
import type { TeamId } from "@/domain/ids";
import {
  type CalendarInterrupt,
  buildCalendarInterrupt,
  remainingResumeTo,
} from "@/state/calendar-interrupt";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { validateGameState } from "@/persistence/validate-game-state";
import { parseCalendarDate, addCalendarDays } from "@/domain/calendar-date";
import {
  needsRegularSeasonInitialization,
  derivePlannedPreseasonStartDate,
} from "@/systems/simulation/planned-season-dates";
import { toCalendarLeagueContext } from "@/state/standings-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import { getActiveOwnerDecision } from "@/systems/owner-decisions";
import { buildSimulationSummary } from "@/systems/calendar/simulation-summary";
import {
  getStore,
  persistWorkingState,
  toSaveSummary,
} from "@/application/game-service/internal";

export type CalendarPageMediaHighlight = {
  date: string;
  headline: string;
  summary: string;
  storyType: string;
};

export type CalendarPageView = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
  currentDate: string;
  year: number;
  month: number;
  selectedDate: string;
  monthGrid: CalendarMonthGrid;
  inspector: import("@/systems/calendar/calendar-inspector").CalendarDateInspectorView;
  leagueContext:
    import("@/state/standings-selectors").CalendarLeagueContextView | null;
  nextTeamGameDate: string | null;
  /** The owner's next game, so "Next Game" can offer to watch it. */
  nextTeamGame: { date: string; gameId: string } | null;
  /** Box-score summary when the selected date's team game is final. */
  teamGameStats: CalendarGameStatsView | null;
  /** Branding by team id so calendar cells and the inspector can show opponent badges. */
  teamBranding: Record<string, TeamBrandingView>;
  timeDisabled: boolean;
  timeDisabledFlags: {
    userOnDraftClock: boolean;
    seasonReviewPending: boolean;
    pendingOwnerDecision: boolean;
  };
  recentMediaHighlights: CalendarPageMediaHighlight[];
  userTeamId: TeamId;
  /** True while still in preseason.preparation before owner opens the regular season. */
  seasonInitializationRequired: boolean;
  /** True when regular season is open, currentDate is opener, and opener games are still scheduled. */
  openingDayPending: boolean;
  pauseBanner: {
    reason: "draft_clock" | "owner_decision" | null;
    message: string | null;
    resolveHref: string | null;
  };
  interrupt: CalendarInterrupt | null;
  resumeTo: string | null;
  simulationSummary:
    import("@/systems/calendar/simulation-summary").SimulationSummary | null;
};

export type LoadCalendarPageViewOptions = {
  year?: number;
  month?: number;
  selectedDate?: string;
  /** When set with daysAdvanced, rebuilds a team-first simulation summary. */
  simulationFromDate?: string;
  daysAdvanced?: number;
  resumeTo?: string | null;
};

/**
 * Calendar page data: owner-scoped month grid, date inspector, league context.
 * Loads GameState once; does not invent projected trades or injuries.
 */
export async function loadCalendarPageView(
  saveId: string,
  options: LoadCalendarPageViewOptions = {},
  store?: SaveGameStore,
): Promise<CalendarPageView | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }

  let state = loaded.state;
  const rng = createSeededRng(state.meta.rngState);
  const bootstrapped = bootstrapWorld(state, rng);
  if (bootstrapped.state !== state) {
    state = {
      ...bootstrapped.state,
      meta: {
        ...bootstrapped.state.meta,
        rngState: rng.getState(),
        updatedAt: new Date().toISOString(),
      },
    };
    validateGameState(state);
    state = (
      await persistWorkingState(saveId, state, rng.getState(), saveStore)
    ).state;
  }

  const currentDate = state.world.calendar.currentDate;
  const parsedCurrent = parseCalendarDate(currentDate);

  const hasExplicitYear =
    options.year !== undefined && Number.isInteger(options.year);
  const hasExplicitMonth =
    options.month !== undefined &&
    Number.isInteger(options.month) &&
    options.month >= 1 &&
    options.month <= 12;

  let year = hasExplicitYear ? options.year! : parsedCurrent.year;
  let month = hasExplicitMonth ? options.month! : parsedCurrent.month;

  // When URL does not pin year/month and preseason init is still pending, open
  // on the preseason month so the PRESEASON milestone is visible. selectedDate
  // stays on currentDate (e.g. opening night).
  if (
    !hasExplicitYear &&
    !hasExplicitMonth &&
    needsRegularSeasonInitialization(state)
  ) {
    const plannedPreseason = derivePlannedPreseasonStartDate(state);
    if (plannedPreseason) {
      const parsedPreseason = parseCalendarDate(plannedPreseason);
      if (
        parsedPreseason.year !== parsedCurrent.year ||
        parsedPreseason.month !== parsedCurrent.month
      ) {
        year = parsedPreseason.year;
        month = parsedPreseason.month;
      }
    }
  }

  const selectedDate =
    options.selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(options.selectedDate)
      ? options.selectedDate
      : currentDate;

  const teamId = state.user.activeOwnerTeamId;
  const monthGrid = getCalendarMonthGrid(state, year, month, {
    saveId,
    teamId,
  });
  const inspector = buildCalendarDateInspectorView(state, selectedDate, {
    saveId,
  });
  const leagueContext = toCalendarLeagueContext(state);
  const nextTeamGameDate = getNextTeamGameDate(state, teamId);
  const nextGame = nextTeamGameDate
    ? (getTeamGamesForDate(state, teamId, nextTeamGameDate).find(
        (game) => game.competitionType !== "development_league",
      ) ?? null)
    : null;
  const selectedTeamGame = inspector.teamGame;
  const selectedBoxScore =
    selectedTeamGame?.status === "final"
      ? toGameBoxScoreView(state, selectedTeamGame.gameId)
      : null;

  const ownerDash = toOwnerDashboardView(state);
  const timeDisabledFlags = {
    userOnDraftClock: ownerDash.flags.userOnDraftClock,
    seasonReviewPending: ownerDash.flags.seasonReviewPending,
    pendingOwnerDecision: ownerDash.flags.pendingOwnerDecision,
  };

  const franchise = getActiveOwnedFranchise(state);
  const recentMediaHighlights: CalendarPageMediaHighlight[] = (
    franchise.mediaFeed?.items ?? []
  )
    .slice(0, 40)
    .map((item) => ({
      date: item.occurredOn,
      headline: item.headline,
      summary: item.summary,
      storyType: item.storyType,
    }));

  const seasonInitializationRequired = needsRegularSeasonInitialization(state);
  const openerDate = state.competition.season.regularSeasonStartDate;
  const openingDayPending =
    state.competition.season.phase === "regular" &&
    openerDate != null &&
    openerDate === currentDate &&
    Object.values(state.competition.games).some(
      (game) =>
        game.competitionType === "regular_season" &&
        game.date === currentDate &&
        game.status === "scheduled",
    );

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    currentDate,
    year,
    month,
    selectedDate,
    monthGrid,
    inspector,
    leagueContext,
    nextTeamGameDate,
    nextTeamGame:
      nextGame && nextTeamGameDate
        ? {
            date: nextTeamGameDate,
            gameId: nextGame.id,
          }
        : null,
    teamGameStats: selectedBoxScore
      ? toCalendarGameStatsView(
          selectedBoxScore,
          canWatchGame(state, selectedBoxScore.gameId),
        )
      : null,
    teamBranding: Object.fromEntries(
      Object.values(state.world.teams).flatMap((team) => {
        const branding = toBrandingView(team.branding);
        return branding ? [[team.id, branding] as const] : [];
      }),
    ),
    timeDisabled:
      timeDisabledFlags.userOnDraftClock ||
      timeDisabledFlags.pendingOwnerDecision,
    timeDisabledFlags,
    recentMediaHighlights,
    userTeamId: teamId,
    seasonInitializationRequired,
    openingDayPending,
    pauseBanner: timeDisabledFlags.userOnDraftClock
      ? {
          reason: "draft_clock" as const,
          message: "Simulation paused — your team is on the draft clock.",
          resolveHref: `/dashboard/${saveId}/draft`,
        }
      : timeDisabledFlags.pendingOwnerDecision
        ? {
            reason: "owner_decision" as const,
            message:
              "Simulation paused — a required owner decision must be resolved.",
            resolveHref: (() => {
              const blocking = getActiveOwnerDecision(state.user);
              return blocking
                ? `/dashboard/${saveId}/trades/${blocking.id}`
                : `/dashboard/${saveId}`;
            })(),
          }
        : { reason: null, message: null, resolveHref: null },
    interrupt: buildCalendarInterrupt(state, saveId),
    resumeTo: remainingResumeTo(currentDate, options.resumeTo),
    simulationSummary: (() => {
      const daysAdvanced = options.daysAdvanced;
      if (
        daysAdvanced == null ||
        !Number.isInteger(daysAdvanced) ||
        daysAdvanced < 1
      ) {
        return null;
      }
      const fromDate =
        options.simulationFromDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(options.simulationFromDate)
          ? options.simulationFromDate
          : addCalendarDays(currentDate, -daysAdvanced);
      return buildSimulationSummary(state, [], {
        fromDate,
        toDate: currentDate,
      });
    })(),
  };
}
