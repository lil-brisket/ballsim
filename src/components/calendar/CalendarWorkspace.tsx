"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarPageView } from "@/application/game-service";
import {
  matchesCalendarFilter,
  type CalendarFilter,
  type CalendarEventView,
} from "@/domain/entities/calendar-event";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarDayDetail } from "@/components/calendar/CalendarDayDetail";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { SimulateUntilPanel } from "@/components/calendar/SimulateUntilPanel";
import { SimulationShortcuts } from "@/components/calendar/SimulationShortcuts";
import { SimulationSummaryModal } from "@/components/calendar/SimulationSummaryModal";
import { SimulationPausedBanner } from "@/components/calendar/SimulationPausedBanner";
import { parseCalendarDate } from "@/domain/calendar-date";

function buildCalendarHref(input: {
  saveId: string;
  year: number;
  month: number;
  date?: string;
  filter?: CalendarFilter;
  focus?: string;
}): string {
  const params = new URLSearchParams();
  params.set("year", String(input.year));
  params.set("month", String(input.month));
  if (input.date) params.set("date", input.date);
  if (input.filter && input.filter !== "all") {
    params.set("filter", input.filter);
  }
  if (input.focus) params.set("focus", input.focus);
  return `/dashboard/${input.saveId}/calendar?${params.toString()}`;
}

export function CalendarWorkspace(props: {
  view: CalendarPageView;
  saveId: string;
  showSimSummary: boolean;
  daysAdvanced: number;
  highlightCount: number;
  fromDate?: string | null;
  focus?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(props.view.selectedDate);
  const [filter, setFilter] = useState<CalendarFilter>(props.view.filter);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const focus = props.focus ?? null;

  /* eslint-disable react-hooks/set-state-in-effect -- sync URL-driven view props into local UI state */
  useEffect(() => {
    setSelectedDate(props.view.selectedDate);
    setFilter(props.view.filter);
  }, [props.view.selectedDate, props.view.filter]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const returnPath = buildCalendarHref({
    saveId: props.saveId,
    year: props.view.year,
    month: props.view.month,
    date: selectedDate,
    filter,
  });

  const filteredGrid = useMemo(() => {
    const weeks = props.view.monthGrid.weeks.map((week) =>
      week.map((cell) => {
        const events = cell.events.filter((event) =>
          matchesCalendarFilter(event, filter, props.view.userTeamId),
        );
        return { ...cell, events };
      }),
    );
    return { ...props.view.monthGrid, weeks };
  }, [props.view.monthGrid, props.view.userTeamId, filter]);

  const selectedEvents = useMemo(() => {
    for (const week of filteredGrid.weeks) {
      for (const cell of week) {
        if (cell.date === selectedDate) return cell.events;
      }
    }
    return [] as CalendarEventView[];
  }, [filteredGrid, selectedDate]);

  function navigate(next: {
    year: number;
    month: number;
    date?: string;
    filter?: CalendarFilter;
  }) {
    const href = buildCalendarHref({
      saveId: props.saveId,
      year: next.year,
      month: next.month,
      date: next.date,
      filter: next.filter ?? filter,
    });
    startTransition(() => {
      router.push(href);
    });
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setMobileDetailOpen(true);
    const { year, month } = parseCalendarDate(date);
    if (year !== props.view.year || month !== props.view.month) {
      navigate({ year, month, date, filter });
      return;
    }
    navigate({
      year: props.view.year,
      month: props.view.month,
      date,
      filter,
    });
  }

  function handleFilterChange(nextFilter: CalendarFilter) {
    setFilter(nextFilter);
    navigate({
      year: props.view.year,
      month: props.view.month,
      date: selectedDate,
      filter: nextFilter,
    });
  }

  function handleJumpToday() {
    const { year, month } = parseCalendarDate(props.view.currentDate);
    setSelectedDate(props.view.currentDate);
    navigate({
      year,
      month,
      date: props.view.currentDate,
      filter,
    });
  }

  const preview =
    selectedDate === props.view.selectedDate
      ? props.view.simulationPreview
      : null;

  const teamGame = props.view.teamGameOnSelectedDate
    ? {
        gameId: props.view.teamGameOnSelectedDate.gameId,
        opponentLabel: props.view.teamGameOnSelectedDate.opponentLabel,
        opponentTeamId: props.view.teamGameOnSelectedDate.opponentTeamId,
        home: props.view.teamGameOnSelectedDate.home,
        status: props.view.teamGameOnSelectedDate.status,
        scoreLabel: props.view.teamGameOnSelectedDate.scoreLabel,
      }
    : null;

  const simulatePanel = (
    <SimulateUntilPanel
      saveId={props.saveId}
      returnPath={returnPath}
      targetDate={selectedDate}
      currentDate={props.view.currentDate}
      preview={preview}
      disabled={props.view.timeDisabled}
    />
  );

  return (
    <div className={`space-y-6 ${isPending ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Current phase
          </p>
          <p className="text-sm font-medium text-zinc-100">
            {props.view.phaseLabel}
          </p>
        </div>
      </div>

      <SimulationPausedBanner
        reason={props.view.pauseBanner.reason}
        message={props.view.pauseBanner.message}
        resolveHref={props.view.pauseBanner.resolveHref}
        currentDate={props.view.currentDate}
      />

      <div
        id="simulation-shortcuts"
        className={
          focus === "next-game"
            ? "rounded-xl border border-amber-700/40 bg-amber-950/10 p-3"
            : undefined
        }
      >
        <SimulationShortcuts
          saveId={props.saveId}
          returnPath={returnPath}
          disabled={props.view.timeDisabled}
          nextTargets={props.view.nextTargets}
        />
      </div>

      <CalendarFilters value={filter} onChange={handleFilterChange} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <CalendarMonthView
            grid={filteredGrid}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onChangeMonth={(year, month) =>
              navigate({ year, month, date: selectedDate, filter })
            }
            onJumpToday={handleJumpToday}
            userTeamId={props.view.userTeamId}
          />
        </div>

        <div className="hidden space-y-4 lg:block">
          <CalendarDayDetail
            saveId={props.saveId}
            date={selectedDate}
            events={selectedEvents}
            currentDate={props.view.currentDate}
            userTeamId={props.view.userTeamId}
            teamGame={teamGame}
            simulatePanel={simulatePanel}
          />
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {mobileDetailOpen || selectedDate ? (
          <CalendarDayDetail
            saveId={props.saveId}
            date={selectedDate}
            events={selectedEvents}
            currentDate={props.view.currentDate}
            userTeamId={props.view.userTeamId}
            onClose={() => setMobileDetailOpen(false)}
            teamGame={teamGame}
            simulatePanel={simulatePanel}
          />
        ) : null}
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
