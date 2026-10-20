"use client";

import { formatGameDate } from "@/presentation/game-date";
import { buttonClass } from "@/components/ui/Button";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import type { CalendarPageView } from "@/application/game-service";
import { resolveCalendarTradeInterruptAction } from "@/application/actions";
import type { SimulateToDateStreamEvent } from "@/application/simulate-to-date-stream";
import type { SimulationProgress } from "@/systems/simulation/types";
import { isOwnerInterruptStopReason } from "@/systems/simulation/types";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { DateInspector } from "@/components/calendar/DateInspector";
import { CalendarLeagueContextPanel } from "@/components/calendar/CalendarLeagueContext";
import { SimulationSummaryModal } from "@/components/calendar/SimulationSummaryModal";
import { SimulationPausedBanner } from "@/components/calendar/SimulationPausedBanner";
import { SeasonLifecycleBanner } from "@/components/calendar/SeasonLifecycleBanner";
import { SimulateToDateConfirm } from "@/components/calendar/SimulateToDateConfirm";
import {
  requestStopSimulation,
  streamSimulateToDate,
} from "@/components/calendar/stream-simulate-to-date";
import {
  readCalendarResumeTarget,
  readCalendarWatchTarget,
  remainingSimulateTarget,
  writeCalendarResumeTarget,
  writeCalendarWatchTarget,
} from "@/components/calendar/calendar-resume-target";
import {
  INITIAL_INTERRUPT_STATE,
  interruptBannerVisible,
  interruptModalOpen,
  reduceInterruptState,
  type InterruptResolveAction,
} from "@/components/calendar/calendar-interrupt-state";
import { OwnerDecisionInterruptModal } from "@/components/calendar/OwnerDecisionInterruptModal";
import { useSimulationActivity } from "@/components/game/simulation-activity";
import { Drawer } from "@/components/ui/Drawer";
import { addCalendarDays, parseCalendarDate } from "@/domain/calendar-date";
import {
  buildPlaceholderMonthGrid,
  type CalendarDateInspectorView,
  type CalendarMonthGrid,
} from "@/systems/calendar";
import type { CalendarLeagueContextView } from "@/state/standings-selectors";

// Playback paces one day per frame, then speeds up as the server gets ahead
// so the calendar never trails the simulation by more than a moment.
const PLAYBACK_MS_PER_DAY = 70;
const PLAYBACK_MIN_MS_PER_DAY = 16;
const PLAYBACK_BACKLOG_STEP_MS = 8;

function playbackDelayMs(backlog: number): number {
  return Math.max(
    PLAYBACK_MIN_MS_PER_DAY,
    PLAYBACK_MS_PER_DAY - backlog * PLAYBACK_BACKLOG_STEP_MS,
  );
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function useIsDesktopCalendar(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window.matchMedia !== "function") {
        return () => undefined;
      }
      const media = window.matchMedia("(min-width: 1024px)");
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", onStoreChange);
        return () => media.removeEventListener("change", onStoreChange);
      }
      if (typeof media.addListener === "function") {
        media.addListener(onStoreChange);
        return () => media.removeListener(onStoreChange);
      }
      return () => undefined;
    },
    () =>
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 1024px)").matches
        : false,
    () => false,
  );
}

function buildCalendarHref(input: {
  saveId: string;
  year: number;
  month: number;
  date?: string;
  resumeTo?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("year", String(input.year));
  params.set("month", String(input.month));
  if (input.date) {
    params.set("date", input.date);
  }
  if (input.resumeTo) {
    params.set("resumeTo", input.resumeTo);
  }
  return `/dashboard/${input.saveId}/calendar?${params.toString()}`;
}

function dateInMonth(date: string, year: number, month: number): boolean {
  try {
    const parsed = parseCalendarDate(date);
    return parsed.year === year && parsed.month === month;
  } catch {
    return false;
  }
}

type PlaybackFrame = {
  currentDate: string;
  completedDate: string;
  daysAdvanced: number;
  daysRequested: number;
  gamesSimulated: number;
  percentComplete: number;
  phase: string;
  seasonYear: number;
  teamResult?: { date: string; resultLabel: string } | null;
  leagueContext?: CalendarLeagueContextView | null;
  monthGrid?: CalendarMonthGrid;
  inspector?: CalendarDateInspectorView;
};

export function CalendarWorkspace(props: {
  view: CalendarPageView;
  saveId: string;
  showSimSummary: boolean;
  daysAdvanced: number;
  highlightCount: number;
  fromDate?: string | null;
  resumeTo?: string | null;
  autoResume?: boolean;
}) {
  const isDesktop = useIsDesktopCalendar();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { simulationPending, setSimulationPending, setSimulationProgress } =
    useSimulationActivity();
  const [selectedDate, setSelectedDate] = useState(props.view.selectedDate);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [confirmTargetDate, setConfirmTargetDate] = useState<string | null>(
    null,
  );
  const [resumeTarget, setResumeTarget] = useState<string | null>(() =>
    props.resumeTo && props.resumeTo > props.view.currentDate
      ? props.resumeTo
      : null,
  );
  const [simError, setSimError] = useState<string | null>(null);
  const [watchNotice, setWatchNotice] = useState<string | null>(null);
  // Set while a run is heading to an owner game the user asked to watch.
  const watchTargetRef = useRef<{ gameId: string; gameDate: string } | null>(
    null,
  );
  const [watching, setWatching] = useState(false);
  const [confirmWatchGame, setConfirmWatchGame] = useState<{
    gameId: string;
  } | null>(null);
  const [playback, setPlayback] = useState<PlaybackFrame | null>(null);
  const [resultOverlays, setResultOverlays] = useState<Record<string, string>>(
    {},
  );
  // Month grids streamed by the server, keyed by YYYY-MM, for months the run
  // passes through other than the one this page loaded with.
  const [playbackGrids, setPlaybackGrids] = useState<
    Record<string, CalendarMonthGrid>
  >({});
  // Standings streamed during playback. Kept until the refreshed view arrives
  // so the strip does not flash back to the pre-simulation record.
  const [liveLeagueContext, setLiveLeagueContext] = useState<{
    source: CalendarPageView["leagueContext"];
    context: CalendarLeagueContextView | null;
  } | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);
  const queueRef = useRef<PlaybackFrame[]>([]);
  const drainingRef = useRef(false);
  const doneRef = useRef<Extract<
    SimulateToDateStreamEvent,
    { type: "done" }
  > | null>(null);
  const [interruptState, dispatchInterrupt] = useReducer(
    reduceInterruptState,
    INITIAL_INTERRUPT_STATE,
  );
  const autoResumeFiredRef = useRef(false);
  const handleSimulateRef = useRef<(targetDate: string) => Promise<void>>(
    async () => undefined,
  );
  const [simAnnouncement, setSimAnnouncement] = useState<{
    key: string;
    text: string;
  } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- sync URL-driven view props and playback into local UI state */
  useEffect(() => {
    setSelectedDate(props.view.selectedDate);
  }, [props.view.selectedDate]);

  useEffect(() => {
    const fromUrl =
      props.resumeTo && props.resumeTo > props.view.currentDate
        ? props.resumeTo
        : null;
    const stored = readCalendarResumeTarget(props.saveId);
    const next =
      fromUrl ?? (stored && stored > props.view.currentDate ? stored : null);
    setResumeTarget(next);
    if (fromUrl) {
      writeCalendarResumeTarget(props.saveId, fromUrl);
    } else if (stored && stored <= props.view.currentDate) {
      writeCalendarResumeTarget(props.saveId, null);
    }
  }, [props.resumeTo, props.saveId, props.view.currentDate]);

  useEffect(() => {
    if (playback) {
      setSimulationProgress({
        currentDate: playback.currentDate,
        daysAdvanced: playback.daysAdvanced,
        daysRequested: playback.daysRequested,
        percentComplete: playback.percentComplete,
        phase: playback.phase,
      });
      return;
    }
    setSimulationProgress(null);
  }, [playback, setSimulationProgress]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const returnPath = buildCalendarHref({
    saveId: props.saveId,
    year: props.view.year,
    month: props.view.month,
    date: selectedDate,
    resumeTo: resumeTarget,
  });

  const liveCurrentDate = playback?.currentDate ?? props.view.currentDate;
  const playbackDate = playback?.currentDate ?? null;
  const displayedGrid: CalendarMonthGrid = useMemo(() => {
    // Outside playback the grid is whatever month the URL asked for, so
    // Prev / Next can browse away from the current date.
    if (playbackDate == null) {
      return props.view.monthGrid;
    }
    const streamed = playbackGrids[monthKey(playbackDate)];
    if (streamed) {
      return streamed;
    }
    const parsed = parseCalendarDate(playbackDate);
    if (
      parsed.year === props.view.monthGrid.year &&
      parsed.month === props.view.monthGrid.month
    ) {
      return props.view.monthGrid;
    }
    return buildPlaceholderMonthGrid(parsed.year, parsed.month, playbackDate);
  }, [playbackDate, playbackGrids, props.view.monthGrid]);
  const leagueContext =
    liveLeagueContext != null &&
    liveLeagueContext.source === props.view.leagueContext
      ? liveLeagueContext.context
      : props.view.leagueContext;

  const navigationDisabled = simulationPending || playback != null;

  function navigate(
    next: {
      year: number;
      month: number;
      date?: string;
      resumeTo?: string | null;
    },
    mode: "replace" | "push" = "replace",
  ) {
    if (navigationDisabled) return;
    const href = buildCalendarHref({
      saveId: props.saveId,
      year: next.year,
      month: next.month,
      date: next.date,
      resumeTo: next.resumeTo === undefined ? resumeTarget : next.resumeTo,
    });
    startTransition(() => {
      if (mode === "push") {
        router.push(href, { scroll: false });
      } else {
        router.replace(href, { scroll: false });
      }
    });
  }

  function handleSelectDate(date: string) {
    if (navigationDisabled) return;
    setSelectedDate(date);
    if (date > props.view.currentDate && !props.view.timeDisabled) {
      const teamGame = displayedGrid.weeks
        .flat()
        .find((cell) => cell.date === date)?.teamGame;
      setConfirmWatchGame(
        teamGame?.status === "scheduled" && teamGame.watchable
          ? { gameId: teamGame.gameId }
          : null,
      );
      setConfirmTargetDate(date);
      setMobileDetailOpen(false);
      return;
    }
    setConfirmTargetDate(null);
    setMobileDetailOpen(true);
    const { year, month } = parseCalendarDate(date);
    navigate({ year, month, date }, "replace");
  }

  function handleChangeMonth(year: number, month: number) {
    if (navigationDisabled) return;
    const keepDate =
      selectedDate && dateInMonth(selectedDate, year, month)
        ? selectedDate
        : undefined;
    navigate({ year, month, date: keepDate }, "push");
  }

  function handleJumpToday() {
    if (navigationDisabled) return;
    const { year, month } = parseCalendarDate(props.view.currentDate);
    setSelectedDate(props.view.currentDate);
    setConfirmTargetDate(null);
    navigate({
      year,
      month,
      date: props.view.currentDate,
    });
  }

  function handleJumpNextGame() {
    if (navigationDisabled) return;
    const next = props.view.nextTeamGameDate;
    if (!next) return;
    const { year, month } = parseCalendarDate(next);
    setSelectedDate(next);
    if (next > props.view.currentDate && !props.view.timeDisabled) {
      const nextGame = props.view.nextTeamGame;
      setConfirmWatchGame(
        nextGame && nextGame.date === next ? { gameId: nextGame.gameId } : null,
      );
      setConfirmTargetDate(next);
      setMobileDetailOpen(false);
      return;
    }
    navigate({ year, month, date: next });
  }

  function clearWatchTarget(options: { keepStored?: boolean } = {}) {
    watchTargetRef.current = null;
    setWatching(false);
    if (!options.keepStored) {
      writeCalendarWatchTarget(props.saveId, null);
    }
  }

  function handleWatch(gameId: string, gameDate: string) {
    if (navigationDisabled) return;
    const target = { gameId, gameDate };
    watchTargetRef.current = target;
    setWatching(true);
    setWatchNotice(null);
    writeCalendarWatchTarget(props.saveId, target);
    void handleSimulate(addCalendarDays(gameDate, 1));
  }

  function resetPlayback() {
    setPlayback(null);
    setResultOverlays({});
    setPlaybackGrids({});
    setSimulationPending(false);
    setStopRequested(false);
    stopRequestedRef.current = false;
  }

  function finishPlayback(
    done: Extract<SimulateToDateStreamEvent, { type: "done" }>,
  ) {
    resetPlayback();
    const watchTarget = watchTargetRef.current;
    if (watchTarget) {
      if (done.currentDate >= done.requestedTargetDate) {
        clearWatchTarget();
        writeCalendarResumeTarget(props.saveId, null);
        setResumeTarget(null);
        startTransition(() => {
          router.push(
            `/dashboard/${props.saveId}/games/${watchTarget.gameId}/watch`,
          );
        });
        return;
      }
      // Stopped early (decision pause, etc.): keep the stored target so a
      // resumed run still ends on the Watch page.
      clearWatchTarget({ keepStored: true });
      setWatchNotice("Stopped before tip-off — continue to watch the game.");
    }
    const remaining = remainingSimulateTarget({
      requestedTargetDate: done.requestedTargetDate,
      currentDate: done.currentDate,
      stopReason: done.stopReason,
    });
    writeCalendarResumeTarget(props.saveId, remaining);
    setResumeTarget(remaining);
    const href = buildCalendarHref({
      saveId: props.saveId,
      year: parseCalendarDate(done.currentDate).year,
      month: parseCalendarDate(done.currentDate).month,
      date: done.currentDate,
      resumeTo: remaining,
    });
    startTransition(() => {
      if (isOwnerInterruptStopReason(done.stopReason)) {
        router.replace(href, { scroll: false });
      } else {
        const separator = href.includes("?") ? "&" : "?";
        router.replace(
          `${href}${separator}simSummary=1&daysAdvanced=${done.daysAdvanced}&highlights=${done.highlightCount}&fromDate=${done.fromDate}`,
          { scroll: false },
        );
      }
      router.refresh();
    });
  }

  function drainQueue() {
    if (drainingRef.current) return;
    drainingRef.current = true;

    const tick = () => {
      // After Stop, the server has already finished the days still queued:
      // show them all at once instead of replaying them.
      const frames = stopRequestedRef.current
        ? queueRef.current.splice(0)
        : queueRef.current.splice(0, 1);
      const next = frames.at(-1);
      if (next) {
        setPlayback(next);
        const grids = frames.flatMap((frame) =>
          frame.monthGrid ? [frame.monthGrid] : [],
        );
        if (grids.length > 0) {
          setPlaybackGrids((current) => {
            const merged = { ...current };
            for (const grid of grids) {
              merged[`${grid.year}-${String(grid.month).padStart(2, "0")}`] =
                grid;
            }
            return merged;
          });
        }
        const results = frames.flatMap((frame) =>
          frame.teamResult?.resultLabel ? [frame.teamResult] : [],
        );
        // Hide the result of the game the user is about to watch.
        const watchDate = watchTargetRef.current?.gameDate;
        const visibleResults = results.filter(
          (result) => result.date !== watchDate,
        );
        if (visibleResults.length > 0) {
          setResultOverlays((current) => {
            const merged = { ...current };
            for (const result of visibleResults) {
              merged[result.date] = result.resultLabel;
            }
            return merged;
          });
        }
        if (next.leagueContext !== undefined) {
          setLiveLeagueContext({
            source: props.view.leagueContext,
            context: next.leagueContext,
          });
        }
        window.setTimeout(tick, playbackDelayMs(queueRef.current.length));
        return;
      }
      drainingRef.current = false;
      const done = doneRef.current;
      if (done) {
        doneRef.current = null;
        finishPlayback(done);
      }
    };
    tick();
  }

  function enqueueProgress(
    progress: SimulationProgress & {
      leagueContext?: CalendarLeagueContextView | null;
      monthGrid?: CalendarMonthGrid;
      inspector?: CalendarDateInspectorView;
    },
  ) {
    queueRef.current.push({
      currentDate: progress.currentDate,
      completedDate: progress.completedDate,
      daysAdvanced: progress.daysAdvanced,
      daysRequested: progress.daysRequested,
      gamesSimulated: progress.gamesSimulated,
      percentComplete: progress.percentComplete,
      phase: progress.phase,
      seasonYear: progress.seasonYear,
      teamResult:
        progress.teamGame?.resultLabel != null
          ? {
              date: progress.completedDate,
              resultLabel: progress.teamGame.resultLabel,
            }
          : null,
      leagueContext: progress.leagueContext,
      monthGrid: progress.monthGrid,
      inspector: progress.inspector,
    });
    drainQueue();
  }

  async function handleSimulate(targetDate: string) {
    if (navigationDisabled) return;
    const pendingWatch =
      watchTargetRef.current ?? readCalendarWatchTarget(props.saveId);
    if (
      pendingWatch &&
      addCalendarDays(pendingWatch.gameDate, 1) === targetDate
    ) {
      watchTargetRef.current = pendingWatch;
      setWatching(true);
    } else if (pendingWatch) {
      clearWatchTarget();
    }
    setSimError(null);
    setWatchNotice(null);
    setConfirmTargetDate(null);
    setMobileDetailOpen(false);
    setSimulationPending(true);
    setStopRequested(false);
    stopRequestedRef.current = false;
    setPlayback({
      currentDate: props.view.currentDate,
      completedDate: props.view.currentDate,
      daysAdvanced: 0,
      daysRequested: 1,
      gamesSimulated: 0,
      percentComplete: 0,
      phase: props.view.inspector.phaseLabel,
      seasonYear: parseCalendarDate(props.view.currentDate).year,
    });
    queueRef.current = [];
    doneRef.current = null;

    try {
      await streamSimulateToDate(props.saveId, targetDate, (event) => {
        if (event.type === "progress") {
          enqueueProgress(event);
          return;
        }
        if (event.type === "error") {
          queueRef.current = [];
          doneRef.current = null;
          clearWatchTarget();
          resetPlayback();
          setSimError(event.message);
          return;
        }
        doneRef.current = event;
        drainQueue();
      });
    } catch (error) {
      clearWatchTarget();
      resetPlayback();
      setSimError(
        error instanceof Error ? error.message : "Simulation failed.",
      );
    }
  }
  useEffect(() => {
    handleSimulateRef.current = handleSimulate;
  });

  function handleStopSimulation() {
    if (stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    clearWatchTarget();
    setStopRequested(true);
    void requestStopSimulation(props.saveId).catch(() => {
      setSimError(
        "Could not stop the simulation. It will run to the selected date.",
      );
    });
  }

  /* eslint-disable react-hooks/set-state-in-effect -- interrupt sync and leftover auto-resume */
  useEffect(() => {
    dispatchInterrupt({ type: "sync", interrupt: props.view.interrupt });
  }, [props.view.interrupt]);

  useEffect(() => {
    if (interruptState.status !== "resuming") {
      return;
    }
    const target = interruptState.resumeTo;
    dispatchInterrupt({ type: "resume_started" });
    void handleSimulateRef.current(target);
  }, [interruptState]);

  useEffect(() => {
    if (!props.autoResume) {
      return;
    }
    if (autoResumeFiredRef.current) {
      return;
    }
    if (
      props.view.timeDisabled ||
      isPending ||
      simulationPending ||
      playback != null
    ) {
      return;
    }
    autoResumeFiredRef.current = true;
    const { year, month } = parseCalendarDate(liveCurrentDate);
    navigate(
      { year, month, date: selectedDate, resumeTo: resumeTarget },
      "replace",
    );
    if (resumeTarget) {
      void handleSimulateRef.current(resumeTarget);
    }
  }, [
    props.autoResume,
    props.view.timeDisabled,
    isPending,
    simulationPending,
    playback,
    liveCurrentDate,
    selectedDate,
    resumeTarget,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function resolveTradeInterrupt(action: InterruptResolveAction) {
    if (
      interruptState.status !== "interrupted" ||
      interruptState.interrupt.kind !== "trade_offer"
    ) {
      return;
    }
    const decisionId = interruptState.interrupt.decisionId;
    dispatchInterrupt({ type: "start_resolve", action });
    const result = await resolveCalendarTradeInterruptAction(
      props.saveId,
      decisionId,
      action,
      resumeTarget,
    );
    if (!result.ok) {
      dispatchInterrupt({ type: "resolve_error", error: result.error });
      return;
    }
    if (result.resumeTo) {
      writeCalendarResumeTarget(props.saveId, result.resumeTo);
      setResumeTarget(result.resumeTo);
    }
    dispatchInterrupt({
      type: "resolve_success",
      interrupt: result.interrupt,
      resumeTo: result.resumeTo,
    });
  }

  function clearResumeTarget() {
    writeCalendarResumeTarget(props.saveId, null);
    setResumeTarget(null);
    const { year, month } = parseCalendarDate(liveCurrentDate);
    navigate({ year, month, date: selectedDate, resumeTo: null }, "replace");
  }

  const busy = isPending || simulationPending || playback != null;
  // Announce once per phase/month so screen readers are not flooded per day.
  const announcementKey =
    playback == null
      ? null
      : `${playback.phase}:${monthKey(playback.currentDate)}`;
  if ((simAnnouncement?.key ?? null) !== announcementKey) {
    setSimAnnouncement(
      playback == null || announcementKey == null
        ? null
        : {
            key: announcementKey,
            text: `Simulating ${playback.phase} · ${formatGameDate(playback.currentDate)}`,
          },
    );
  }
  // During playback the panel follows the simulation cursor; the page's
  // inspector only describes the date selected before the run.
  const liveInspector = playback?.inspector ?? null;
  const inspector = (
    <DateInspector
      saveId={props.saveId}
      returnPath={returnPath}
      inspector={liveInspector ?? props.view.inspector}
      timeDisabled={props.view.timeDisabled || busy}
      userTeamId={props.view.userTeamId}
      simulating={playback != null}
      onSimulate={handleSimulate}
      showSimulateAction={isDesktop}
      teamGameStats={liveInspector ? null : props.view.teamGameStats}
      currentDate={liveCurrentDate}
      onWatch={handleWatch}
      hideTitle={!isDesktop}
      userTeamName={`${props.view.dashboard.controlledTeam.city} ${props.view.dashboard.controlledTeam.name}`}
      userBranding={props.view.dashboard.controlledTeam.branding}
      teamBranding={props.view.teamBranding}
    />
  );
  const monthView = (
    <CalendarMonthView
      grid={displayedGrid}
      selectedDate={selectedDate}
      currentDate={liveCurrentDate}
      nextTeamGameDate={props.view.nextTeamGameDate}
      navigationDisabled={navigationDisabled}
      resultOverlays={resultOverlays}
      teamBranding={props.view.teamBranding}
      simulating={playback != null}
      onSelectDate={handleSelectDate}
      onChangeMonth={handleChangeMonth}
      onJumpToday={handleJumpToday}
      onJumpNextGame={handleJumpNextGame}
      layout="grid"
    />
  );

  return (
    <div
      className={`space-y-6 ${busy && playback == null ? "opacity-80" : ""}`}
      aria-busy={playback != null || undefined}
    >
      {playback ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {simAnnouncement?.text}
          </p>
          <div className="min-w-0 space-y-1" aria-hidden="true">
            <p className="text-sm font-medium text-warning">
              {stopRequested
                ? "Stopping simulation"
                : watching
                  ? "Heading to tip-off"
                  : "Simulating"}{" "}
              · {formatGameDate(playback.currentDate)}
            </p>
            <p className="text-xs text-zinc-400">
              Day {playback.daysAdvanced} of {playback.daysRequested} ·{" "}
              {playback.gamesSimulated} games played
            </p>
          </div>
          <button
            type="button"
            onClick={handleStopSimulation}
            disabled={stopRequested}
            className={buttonClass({ variant: "secondary" })}
          >
            {stopRequested ? "Stopping…" : "Stop simulation"}
          </button>
        </div>
      ) : simulationPending ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-team-ink/50 bg-team/15 px-3 py-2 text-sm text-zinc-100"
        >
          Simulation in progress — calendar navigation is locked until it
          finishes.
        </p>
      ) : null}

      {watchNotice ? (
        <p role="status" className="text-sm text-warning">
          {watchNotice}
        </p>
      ) : null}

      {simError ? (
        <p role="alert" className="text-sm text-red-300">
          {simError}
        </p>
      ) : null}

      {interruptModalOpen(interruptState) &&
      (interruptState.status === "interrupted" ||
        interruptState.status === "resolving") ? (
        <OwnerDecisionInterruptModal
          interrupt={interruptState.interrupt}
          resumeTo={resumeTarget}
          busy={interruptState.status === "resolving"}
          error={
            interruptState.status === "interrupted"
              ? interruptState.error
              : null
          }
          onAccept={() => {
            void resolveTradeInterrupt("accept");
          }}
          onDecline={() => {
            void resolveTradeInterrupt("decline");
          }}
          onLetAiDecide={() => {
            void resolveTradeInterrupt("let_ai_decide");
          }}
          onNegotiate={() => {
            if (
              interruptState.status !== "interrupted" ||
              interruptState.interrupt.kind !== "trade_offer"
            ) {
              return;
            }
            const params = new URLSearchParams();
            if (resumeTarget) {
              params.set("resumeTo", resumeTarget);
            }
            const query = params.toString();
            router.push(
              `/dashboard/${props.saveId}/trades/${interruptState.interrupt.decisionId}/negotiate${query ? `?${query}` : ""}`,
            );
          }}
          onStopSimulation={() => dispatchInterrupt({ type: "dismiss" })}
        />
      ) : null}

      {!interruptModalOpen(interruptState) ? (
        <SimulationPausedBanner
          reason={props.view.pauseBanner.reason}
          message={props.view.pauseBanner.message}
          resolveHref={props.view.pauseBanner.resolveHref}
          currentDate={liveCurrentDate}
          onResolve={
            interruptBannerVisible(interruptState) || props.view.interrupt
              ? () => dispatchInterrupt({ type: "reopen" })
              : undefined
          }
        />
      ) : null}

      {resumeTarget && !props.view.timeDisabled && !busy ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-700/50 bg-sky-950/30 px-4 py-3"
        >
          <p className="text-sm text-sky-100">
            Continue simulation through{" "}
            <span className="font-medium">{formatGameDate(resumeTarget)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSimulate(resumeTarget)}
              className={buttonClass({ variant: "primary" })}
            >
              Continue to {formatGameDate(resumeTarget)}
            </button>
            <button
              type="button"
              onClick={clearResumeTarget}
              className={buttonClass({ variant: "secondary" })}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <SeasonLifecycleBanner
        seasonInitializationRequired={props.view.seasonInitializationRequired}
        openingDayPending={props.view.openingDayPending}
      />

      {isDesktop ? (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
            {monthView}
            <div className="sticky top-4">{inspector}</div>
          </div>
          <CalendarLeagueContextPanel context={leagueContext} />
        </>
      ) : (
        <>
          {monthView}
          <CalendarLeagueContextPanel context={leagueContext} />
          <Drawer
            open={mobileDetailOpen && !playback}
            onOpenChange={setMobileDetailOpen}
            title={props.view.inspector.longDateLabel}
            size="md"
          >
            {inspector}
          </Drawer>
        </>
      )}

      {confirmTargetDate ? (
        <SimulateToDateConfirm
          date={confirmTargetDate}
          disabled={busy || props.view.timeDisabled}
          onConfirm={handleSimulate}
          onCancel={() => setConfirmTargetDate(null)}
          watchGame={confirmWatchGame ?? undefined}
          onWatch={handleWatch}
        />
      ) : null}

      <SimulationSummaryModal
        open={props.showSimSummary}
        daysAdvanced={props.daysAdvanced}
        highlightCount={props.highlightCount}
        returnPath={returnPath}
        recentHighlights={props.view.recentMediaHighlights}
        teamLabel={props.view.simulationSummary?.teamLabel}
        record={props.view.simulationSummary?.record}
        teamEvents={props.view.simulationSummary?.teamEvents}
        teamGames={props.view.simulationSummary?.teamGames}
        leagueEvents={props.view.simulationSummary?.leagueEvents}
        injuryNotes={props.view.simulationSummary?.injuryNotes}
        transactionCount={props.view.simulationSummary?.transactionCount}
        fromDate={props.fromDate}
        toDate={props.view.currentDate}
        saveId={props.saveId}
      />
    </div>
  );
}
