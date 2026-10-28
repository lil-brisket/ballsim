"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import type { CalendarPageView } from "@/application/game-service";
import { CalendarGridPanel } from "@/components/calendar/CalendarGridPanel";
import { CalendarDayPanel } from "@/components/calendar/CalendarDayPanel";
import {
  CalendarPlaybackStatus,
  CalendarResumeBanner,
} from "@/components/calendar/CalendarControls";
import { CalendarInterruptPanel } from "@/components/calendar/CalendarInterruptPanel";
import { CalendarLeagueContextPanel } from "@/components/calendar/CalendarLeagueContext";
import { SimulationSummaryModal } from "@/components/calendar/SimulationSummaryModal";
import { SeasonLifecycleBanner } from "@/components/calendar/SeasonLifecycleBanner";
import { SimulateToDateConfirm } from "@/components/calendar/SimulateToDateConfirm";
import { writeCalendarResumeTarget } from "@/components/calendar/calendar-resume-target";
import {
  buildCalendarHref,
  dateInMonth,
} from "@/components/calendar/calendar-workspace-utils";
import { useCalendarPlayback } from "@/components/calendar/use-calendar-playback";
import { Drawer } from "@/components/ui/Drawer";
import { parseCalendarDate } from "@/domain/calendar-date";

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
  const [selectedDate, setSelectedDate] = useState(props.view.selectedDate);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [confirmTargetDate, setConfirmTargetDate] = useState<string | null>(
    null,
  );
  const [confirmWatchGame, setConfirmWatchGame] = useState<{
    gameId: string;
  } | null>(null);
  const autoResumeFiredRef = useRef(false);

  const {
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
  } = useCalendarPlayback({
    view: props.view,
    saveId: props.saveId,
    resumeTo: props.resumeTo,
    startTransition,
    onRunStart: () => {
      setConfirmTargetDate(null);
      setMobileDetailOpen(false);
    },
  });

  /* eslint-disable react-hooks/set-state-in-effect -- sync URL-driven view props into local UI state */
  useEffect(() => {
    setSelectedDate(props.view.selectedDate);
  }, [props.view.selectedDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const returnPath = buildCalendarHref({
    saveId: props.saveId,
    year: props.view.year,
    month: props.view.month,
    date: selectedDate,
    resumeTo: resumeTarget,
  });

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
    handleSimulateRef,
  ]);

  function clearResumeTarget() {
    writeCalendarResumeTarget(props.saveId, null);
    setResumeTarget(null);
    const { year, month } = parseCalendarDate(liveCurrentDate);
    navigate({ year, month, date: selectedDate, resumeTo: null }, "replace");
  }

  const busy = isPending || simulationPending || playback != null;
  const inspector = (
    <CalendarDayPanel
      view={props.view}
      saveId={props.saveId}
      returnPath={returnPath}
      liveInspector={playback?.inspector ?? null}
      busy={busy}
      simulating={playback != null}
      isDesktop={isDesktop}
      currentDate={liveCurrentDate}
      onSimulate={handleSimulate}
      onWatch={handleWatch}
    />
  );
  const monthView = (
    <CalendarGridPanel
      grid={displayedGrid}
      view={props.view}
      selectedDate={selectedDate}
      currentDate={liveCurrentDate}
      navigationDisabled={navigationDisabled}
      resultOverlays={resultOverlays}
      simulating={playback != null}
      onSelectDate={handleSelectDate}
      onChangeMonth={handleChangeMonth}
      onJumpToday={handleJumpToday}
      onJumpNextGame={handleJumpNextGame}
    />
  );

  return (
    <div
      className={`space-y-6 ${busy && playback == null ? "opacity-80" : ""}`}
      aria-busy={playback != null || undefined}
    >
      <CalendarPlaybackStatus
        playback={playback}
        simulationPending={simulationPending}
        announcementText={simAnnouncement?.text}
        stopRequested={stopRequested}
        watching={watching}
        watchNotice={watchNotice}
        simError={simError}
        onStop={handleStopSimulation}
      />

      <CalendarInterruptPanel
        view={props.view}
        saveId={props.saveId}
        interruptState={interruptState}
        dispatchInterrupt={dispatchInterrupt}
        resumeTarget={resumeTarget}
        currentDate={liveCurrentDate}
        onResolve={resolveTradeInterrupt}
      />

      {resumeTarget && !props.view.timeDisabled && !busy ? (
        <CalendarResumeBanner
          resumeTarget={resumeTarget}
          onContinue={handleSimulate}
          onDismiss={clearResumeTarget}
        />
      ) : null}

      <SeasonLifecycleBanner
        seasonInitializationRequired={props.view.seasonInitializationRequired}
        openingDayPending={props.view.openingDayPending}
      />

      {isDesktop ? (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
            {monthView}
            <div className="sticky top-[calc(var(--shell-offset,0px)+1rem)]">
              {inspector}
            </div>
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
        aroundTheLeague={props.view.aroundTheLeague}
        fromDate={props.fromDate}
        toDate={props.view.currentDate}
        saveId={props.saveId}
      />
    </div>
  );
}
