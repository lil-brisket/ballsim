"use client";

import { dispatchTickerUpdate } from "@/components/game/TransactionTicker";
import type { TransactionTickerView } from "@/state/transaction-ticker-selectors";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type TransitionStartFunction,
} from "react";
import { useRouter } from "next/navigation";
import type { CalendarPageView } from "@/application/game-service";
import { resolveCalendarTradeInterruptAction } from "@/application/actions";
import type { SimulateToDateStreamEvent } from "@/application/simulate-to-date-stream";
import type { SimulationProgress } from "@/systems/simulation/types";
import { isOwnerInterruptStopReason } from "@/systems/simulation/types";
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
  reduceInterruptState,
  type InterruptResolveAction,
} from "@/components/calendar/calendar-interrupt-state";
import {
  buildCalendarHref,
  monthKey,
} from "@/components/calendar/calendar-workspace-utils";
import { formatGameDate } from "@/presentation/game-date";
import { useSimulationActivity } from "@/components/game/simulation-activity";
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

export type PlaybackFrame = {
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
  /** undefined = event carried no ticker; null = no ticker window. */
  ticker?: TransactionTickerView | null;
};

export function useCalendarPlayback(input: {
  view: CalendarPageView;
  saveId: string;
  resumeTo?: string | null;
  startTransition: TransitionStartFunction;
  /** Called when a run starts so the container can close its own overlays. */
  onRunStart: () => void;
}) {
  const { view, saveId, startTransition, onRunStart } = input;
  const router = useRouter();
  const { simulationPending, setSimulationPending, setSimulationProgress } =
    useSimulationActivity();
  const [resumeTarget, setResumeTarget] = useState<string | null>(() =>
    input.resumeTo && input.resumeTo > view.currentDate ? input.resumeTo : null,
  );
  const [simError, setSimError] = useState<string | null>(null);
  const [watchNotice, setWatchNotice] = useState<string | null>(null);
  // Set while a run is heading to an owner game the user asked to watch.
  const watchTargetRef = useRef<{ gameId: string; gameDate: string } | null>(
    null,
  );
  const [watching, setWatching] = useState(false);
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
  const handleSimulateRef = useRef<(targetDate: string) => Promise<void>>(
    async () => undefined,
  );
  const [simAnnouncement, setSimAnnouncement] = useState<{
    key: string;
    text: string;
  } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- sync URL-driven view props and playback into local UI state */
  useEffect(() => {
    const fromUrl =
      input.resumeTo && input.resumeTo > view.currentDate
        ? input.resumeTo
        : null;
    const stored = readCalendarResumeTarget(saveId);
    const next =
      fromUrl ?? (stored && stored > view.currentDate ? stored : null);
    setResumeTarget(next);
    if (fromUrl) {
      writeCalendarResumeTarget(saveId, fromUrl);
    } else if (stored && stored <= view.currentDate) {
      writeCalendarResumeTarget(saveId, null);
    }
  }, [input.resumeTo, saveId, view.currentDate]);

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

  const liveCurrentDate = playback?.currentDate ?? view.currentDate;
  const playbackDate = playback?.currentDate ?? null;
  const displayedGrid: CalendarMonthGrid = useMemo(() => {
    // Outside playback the grid is whatever month the URL asked for, so
    // Prev / Next can browse away from the current date.
    if (playbackDate == null) {
      return view.monthGrid;
    }
    const streamed = playbackGrids[monthKey(playbackDate)];
    if (streamed) {
      return streamed;
    }
    const parsed = parseCalendarDate(playbackDate);
    if (
      parsed.year === view.monthGrid.year &&
      parsed.month === view.monthGrid.month
    ) {
      return view.monthGrid;
    }
    return buildPlaceholderMonthGrid(parsed.year, parsed.month, playbackDate);
  }, [playbackDate, playbackGrids, view.monthGrid]);
  const leagueContext =
    liveLeagueContext != null && liveLeagueContext.source === view.leagueContext
      ? liveLeagueContext.context
      : view.leagueContext;

  const navigationDisabled = simulationPending || playback != null;

  function clearWatchTarget(options: { keepStored?: boolean } = {}) {
    watchTargetRef.current = null;
    setWatching(false);
    if (!options.keepStored) {
      writeCalendarWatchTarget(saveId, null);
    }
  }

  function handleWatch(gameId: string, gameDate: string) {
    if (navigationDisabled) return;
    const target = { gameId, gameDate };
    watchTargetRef.current = target;
    setWatching(true);
    setWatchNotice(null);
    writeCalendarWatchTarget(saveId, target);
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
        writeCalendarResumeTarget(saveId, null);
        setResumeTarget(null);
        startTransition(() => {
          router.push(`/dashboard/${saveId}/games/${watchTarget.gameId}/watch`);
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
    writeCalendarResumeTarget(saveId, remaining);
    setResumeTarget(remaining);
    const href = buildCalendarHref({
      saveId,
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
        if (next.ticker !== undefined) {
          dispatchTickerUpdate(next.ticker);
        }
        if (next.leagueContext !== undefined) {
          setLiveLeagueContext({
            source: view.leagueContext,
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
      ticker?: TransactionTickerView | null;
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
      ticker: "ticker" in progress ? (progress.ticker ?? null) : undefined,
    });
    drainQueue();
  }

  async function handleSimulate(targetDate: string) {
    if (navigationDisabled) return;
    const pendingWatch =
      watchTargetRef.current ?? readCalendarWatchTarget(saveId);
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
    onRunStart();
    setSimulationPending(true);
    setStopRequested(false);
    stopRequestedRef.current = false;
    setPlayback({
      currentDate: view.currentDate,
      completedDate: view.currentDate,
      daysAdvanced: 0,
      daysRequested: 1,
      gamesSimulated: 0,
      percentComplete: 0,
      phase: view.inspector.phaseLabel,
      seasonYear: parseCalendarDate(view.currentDate).year,
    });
    queueRef.current = [];
    doneRef.current = null;

    try {
      await streamSimulateToDate(saveId, targetDate, (event) => {
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
    void requestStopSimulation(saveId).catch(() => {
      setSimError(
        "Could not stop the simulation. It will run to the selected date.",
      );
    });
  }

  /* eslint-disable react-hooks/set-state-in-effect -- interrupt sync */
  useEffect(() => {
    dispatchInterrupt({ type: "sync", interrupt: view.interrupt });
  }, [view.interrupt]);

  useEffect(() => {
    if (interruptState.status !== "resuming") {
      return;
    }
    const target = interruptState.resumeTo;
    dispatchInterrupt({ type: "resume_started" });
    void handleSimulateRef.current(target);
  }, [interruptState]);
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
      saveId,
      decisionId,
      action,
      resumeTarget,
    );
    if (!result.ok) {
      dispatchInterrupt({ type: "resolve_error", error: result.error });
      return;
    }
    if (result.resumeTo) {
      writeCalendarResumeTarget(saveId, result.resumeTo);
      setResumeTarget(result.resumeTo);
    }
    dispatchInterrupt({
      type: "resolve_success",
      interrupt: result.interrupt,
      resumeTo: result.resumeTo,
    });
  }

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

  return {
    playback,
    simulationPending,
    navigationDisabled,
    liveCurrentDate,
    displayedGrid,
    leagueContext,
    resultOverlays,
    resumeTarget,
    setResumeTarget,
    simError,
    watchNotice,
    watching,
    stopRequested,
    simAnnouncement,
    interruptState,
    dispatchInterrupt,
    handleSimulate,
    handleSimulateRef,
    handleWatch,
    handleStopSimulation,
    resolveTradeInterrupt,
  };
}
