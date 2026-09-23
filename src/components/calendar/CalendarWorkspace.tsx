"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarPageView } from "@/application/game-service";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { DateInspector } from "@/components/calendar/DateInspector";
import { CalendarLeagueContextPanel } from "@/components/calendar/CalendarLeagueContext";
import { SimulationSummaryModal } from "@/components/calendar/SimulationSummaryModal";
import { SimulationPausedBanner } from "@/components/calendar/SimulationPausedBanner";
import { SeasonLifecycleBanner } from "@/components/calendar/SeasonLifecycleBanner";
import { useSimulationActivity } from "@/components/game/simulation-activity";
import { parseCalendarDate } from "@/domain/calendar-date";

function buildCalendarHref(input: {
  saveId: string;
  year: number;
  month: number;
  date?: string;
}): string {
  const params = new URLSearchParams();
  params.set("year", String(input.year));
  params.set("month", String(input.month));
  if (input.date) {
    params.set("date", input.date);
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

export function CalendarWorkspace(props: {
  view: CalendarPageView;
  saveId: string;
  showSimSummary: boolean;
  daysAdvanced: number;
  highlightCount: number;
  fromDate?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { simulationPending } = useSimulationActivity();
  const navigationDisabled = simulationPending;
  const [selectedDate, setSelectedDate] = useState(props.view.selectedDate);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

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
  });

  function navigate(next: { year: number; month: number; date?: string }) {
    if (navigationDisabled) return;
    const href = buildCalendarHref({
      saveId: props.saveId,
      year: next.year,
      month: next.month,
      date: next.date,
    });
    startTransition(() => {
      router.push(href);
    });
  }

  function handleSelectDate(date: string) {
    if (navigationDisabled) return;
    setSelectedDate(date);
    setMobileDetailOpen(true);
    const { year, month } = parseCalendarDate(date);
    navigate({ year, month, date });
  }

  function handleChangeMonth(year: number, month: number) {
    if (navigationDisabled) return;
    const keepDate =
      selectedDate && dateInMonth(selectedDate, year, month)
        ? selectedDate
        : undefined;
    navigate({ year, month, date: keepDate });
  }

  function handleJumpToday() {
    if (navigationDisabled) return;
    const { year, month } = parseCalendarDate(props.view.currentDate);
    setSelectedDate(props.view.currentDate);
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
    navigate({ year, month, date: next });
  }

  const busy = isPending || simulationPending;

  return (
    <div
      className={`space-y-6 ${busy ? "opacity-80" : ""}`}
      aria-busy={simulationPending || undefined}
    >
      {simulationPending ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
        >
          Simulation in progress — calendar navigation is locked until it
          finishes.
        </p>
      ) : null}

      <SimulationPausedBanner
        reason={props.view.pauseBanner.reason}
        message={props.view.pauseBanner.message}
        resolveHref={props.view.pauseBanner.resolveHref}
        currentDate={props.view.currentDate}
      />

      <SeasonLifecycleBanner
        seasonInitializationRequired={props.view.seasonInitializationRequired}
        openingDayPending={props.view.openingDayPending}
      />

      <CalendarMonthView
        grid={props.view.monthGrid}
        selectedDate={selectedDate}
        currentDate={props.view.currentDate}
        nextTeamGameDate={props.view.nextTeamGameDate}
        navigationDisabled={navigationDisabled}
        onSelectDate={handleSelectDate}
        onChangeMonth={handleChangeMonth}
        onJumpToday={handleJumpToday}
        onJumpNextGame={handleJumpNextGame}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <div
          className={
            mobileDetailOpen || selectedDate ? "block" : "hidden lg:block"
          }
        >
          <DateInspector
            saveId={props.saveId}
            returnPath={returnPath}
            inspector={props.view.inspector}
            timeDisabled={props.view.timeDisabled || simulationPending}
            userTeamId={props.view.userTeamId}
          />
        </div>
        <CalendarLeagueContextPanel context={props.view.leagueContext} />
      </div>

      <SimulationSummaryModal
        open={props.showSimSummary}
        daysAdvanced={props.daysAdvanced}
        highlightCount={props.highlightCount}
        returnPath={returnPath}
        recentHighlights={props.view.recentMediaHighlights}
        teamLabel={props.view.simulationSummary?.teamLabel}
        record={props.view.simulationSummary?.record}
        teamEvents={props.view.simulationSummary?.teamEvents}
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
