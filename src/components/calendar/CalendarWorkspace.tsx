"use client";

import { useEffect, useMemo, useRef, useState, useTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { CalendarPageView } from "@/application/game-service";
import type { SimulateToDateStreamEvent } from "@/application/simulate-to-date-stream";
import type { SimulationProgress } from "@/systems/simulation/types";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { DateInspector } from "@/components/calendar/DateInspector";
import { CalendarLeagueContextPanel } from "@/components/calendar/CalendarLeagueContext";
import { SimulationSummaryModal } from "@/components/calendar/SimulationSummaryModal";
import { SimulationPausedBanner } from "@/components/calendar/SimulationPausedBanner";
import { SeasonLifecycleBanner } from "@/components/calendar/SeasonLifecycleBanner";
import { SimulateToDateConfirm } from "@/components/calendar/SimulateToDateConfirm";
import { streamSimulateToDate } from "@/components/calendar/stream-simulate-to-date";
import {
  readCalendarResumeTarget,
  remainingSimulateTarget,
  writeCalendarResumeTarget,
} from "@/components/calendar/calendar-resume-target";
import { useSimulationActivity } from "@/components/game/simulation-activity";
import { SimulationProgressBanner } from "@/components/game/SimulationProgressBanner";
import { Drawer } from "@/components/ui/Drawer";
import { parseCalendarDate } from "@/domain/calendar-date";
import {
  buildPlaceholderMonthGrid,
  type CalendarMonthGrid,
} from "@/systems/calendar";

const PLAYBACK_MS_PER_DAY = 110;

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
};

export function CalendarWorkspace(props: {
  view: CalendarPageView;
  saveId: string;
  showSimSummary: boolean;
  daysAdvanced: number;
  highlightCount: number;
  fromDate?: string | null;
  resumeTo?: string | null;
}) {
  const isDesktop = useIsDesktopCalendar();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    simulationPending,
    setSimulationPending,
    setSimulationProgress,
  } = useSimulationActivity();
  const [selectedDate, setSelectedDate] = useState(props.view.selectedDate);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [confirmTargetDate, setConfirmTargetDate] = useState<string | null>(
    null,
  );
  const [resumeTarget, setResumeTarget] = useState<string | null>(
    () =>
      props.resumeTo && props.resumeTo > props.view.currentDate
        ? props.resumeTo
        : null,
  );
  const [simError, setSimError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackFrame | null>(null);
  const [resultOverlays, setResultOverlays] = useState<Record<string, string>>(
    {},
  );
  const queueRef = useRef<PlaybackFrame[]>([]);
  const drainingRef = useRef(false);
  const doneRef = useRef<Extract<SimulateToDateStreamEvent, { type: "done" }> | null>(
    null,
  );

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
      fromUrl ??
      (stored && stored > props.view.currentDate ? stored : null);
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
  const displayedGrid: CalendarMonthGrid = useMemo(() => {
    const parsed = parseCalendarDate(liveCurrentDate);
    if (
      parsed.year === props.view.monthGrid.year &&
      parsed.month === props.view.monthGrid.month
    ) {
      return props.view.monthGrid;
    }
    return buildPlaceholderMonthGrid(parsed.year, parsed.month, liveCurrentDate);
  }, [liveCurrentDate, props.view.monthGrid]);

  const navigationDisabled = simulationPending || playback != null;

  function navigate(
    next: { year: number; month: number; date?: string; resumeTo?: string | null },
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
      setConfirmTargetDate(next);
      setMobileDetailOpen(false);
      return;
    }
    navigate({ year, month, date: next });
  }

  function finishPlayback(
    done: Extract<SimulateToDateStreamEvent, { type: "done" }>,
  ) {
    setPlayback(null);
    setResultOverlays({});
    setSimulationPending(false);
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
    const separator = href.includes("?") ? "&" : "?";
    startTransition(() => {
      router.replace(
        `${href}${separator}simSummary=1&daysAdvanced=${done.daysAdvanced}&highlights=${done.highlightCount}&fromDate=${done.fromDate}`,
        { scroll: false },
      );
      router.refresh();
    });
  }

  function drainQueue() {
    if (drainingRef.current) return;
    drainingRef.current = true;

    const tick = () => {
      const next = queueRef.current.shift();
      if (next) {
        setPlayback(next);
        if (next.teamResult?.resultLabel) {
          setResultOverlays((current) => ({
            ...current,
            [next.teamResult!.date]: next.teamResult!.resultLabel,
          }));
        }
        window.setTimeout(tick, PLAYBACK_MS_PER_DAY);
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

  function enqueueProgress(progress: SimulationProgress) {
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
    });
    drainQueue();
  }

  async function handleSimulate(targetDate: string) {
    if (navigationDisabled) return;
    setSimError(null);
    setConfirmTargetDate(null);
    setMobileDetailOpen(false);
    setSimulationPending(true);
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
          setPlayback(null);
          setResultOverlays({});
          setSimulationPending(false);
          setSimError(event.message);
          return;
        }
        doneRef.current = event;
        drainQueue();
      });
    } catch (error) {
      setPlayback(null);
      setResultOverlays({});
      setSimulationPending(false);
      setSimError(
        error instanceof Error ? error.message : "Simulation failed.",
      );
    }
  }

  function clearResumeTarget() {
    writeCalendarResumeTarget(props.saveId, null);
    setResumeTarget(null);
    const { year, month } = parseCalendarDate(liveCurrentDate);
    navigate({ year, month, date: selectedDate, resumeTo: null }, "replace");
  }

  const busy = isPending || simulationPending || playback != null;
  const inspector = (
    <DateInspector
      saveId={props.saveId}
      returnPath={returnPath}
      inspector={props.view.inspector}
      timeDisabled={props.view.timeDisabled || busy}
      userTeamId={props.view.userTeamId}
      simulating={playback != null}
      onSimulate={handleSimulate}
      showSimulateAction={isDesktop}
      hideTitle={!isDesktop}
    />
  );

  return (
    <div
      className={`space-y-6 ${busy ? "opacity-80" : ""}`}
      aria-busy={playback != null || undefined}
    >
      {playback ? (
        <SimulationProgressBanner
          busy
          seasonYear={playback.seasonYear}
          phase={playback.phase}
          currentDate={playback.currentDate}
          daysAdvanced={playback.daysAdvanced}
          daysRequested={playback.daysRequested}
          gamesSimulated={playback.gamesSimulated}
          percentComplete={playback.percentComplete}
        />
      ) : simulationPending ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
        >
          Simulation in progress — calendar navigation is locked until it
          finishes.
        </p>
      ) : null}

      {simError ? (
        <p role="alert" className="text-sm text-red-300">
          {simError}
        </p>
      ) : null}

      <SimulationPausedBanner
        reason={props.view.pauseBanner.reason}
        message={props.view.pauseBanner.message}
        resolveHref={props.view.pauseBanner.resolveHref}
        currentDate={liveCurrentDate}
      />

      {resumeTarget && !props.view.timeDisabled && !busy ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-700/50 bg-sky-950/30 px-4 py-3"
        >
          <p className="text-sm text-sky-100">
            Continue simulation through{" "}
            <span className="font-mono font-medium">{resumeTarget}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSimulate(resumeTarget)}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
            >
              Continue to {resumeTarget}
            </button>
            <button
              type="button"
              onClick={clearResumeTarget}
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
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

      <CalendarMonthView
        grid={displayedGrid}
        selectedDate={selectedDate}
        currentDate={liveCurrentDate}
        nextTeamGameDate={props.view.nextTeamGameDate}
        navigationDisabled={navigationDisabled}
        resultOverlays={resultOverlays}
        onSelectDate={handleSelectDate}
        onChangeMonth={handleChangeMonth}
        onJumpToday={handleJumpToday}
        onJumpNextGame={handleJumpNextGame}
        layout="grid"
      />

      {isDesktop ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
          {inspector}
          <CalendarLeagueContextPanel context={props.view.leagueContext} />
        </div>
      ) : (
        <>
          <CalendarLeagueContextPanel context={props.view.leagueContext} />
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
