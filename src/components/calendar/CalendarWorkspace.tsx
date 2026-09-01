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
import { parseCalendarDate } from "@/domain/calendar-date";

function buildCalendarHref(input: {
  saveId: string;
  year: number;
  month: number;
  date?: string;
  filter?: CalendarFilter;
}): string {
  const params = new URLSearchParams();
  params.set("year", String(input.year));
  params.set("month", String(input.month));
  if (input.date) params.set("date", input.date);
  if (input.filter && input.filter !== "all") {
    params.set("filter", input.filter);
  }
  return `/dashboard/${input.saveId}/calendar?${params.toString()}`;
}

export function CalendarWorkspace(props: {
  view: CalendarPageView;
  saveId: string;
  showSimSummary: boolean;
  daysAdvanced: number;
  highlightCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(props.view.selectedDate);
  const [filter, setFilter] = useState<CalendarFilter>(props.view.filter);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(props.view.selectedDate);
    setFilter(props.view.filter);
  }, [props.view.selectedDate, props.view.filter]);

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

  // Preview is computed server-side for the URL-selected date only.
  const preview =
    selectedDate === props.view.selectedDate
      ? props.view.simulationPreview
      : null;

  return (
    <div className={`space-y-6 ${isPending ? "opacity-80" : ""}`}>
      <SimulationShortcuts
        saveId={props.saveId}
        returnPath={returnPath}
        disabled={props.view.timeDisabled}
        nextTargets={props.view.nextTargets}
      />

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
          />
        </div>

        <div className="hidden space-y-4 lg:block">
          <CalendarDayDetail
            date={selectedDate}
            events={selectedEvents}
            currentDate={props.view.currentDate}
          />
          <SimulateUntilPanel
            saveId={props.saveId}
            returnPath={returnPath}
            targetDate={selectedDate}
            currentDate={props.view.currentDate}
            preview={preview}
            disabled={props.view.timeDisabled}
          />
        </div>
      </div>

      <div className="space-y-4 lg:hidden">
        {mobileDetailOpen || selectedDate ? (
          <CalendarDayDetail
            date={selectedDate}
            events={selectedEvents}
            currentDate={props.view.currentDate}
            onClose={() => setMobileDetailOpen(false)}
          />
        ) : null}
        <SimulateUntilPanel
          saveId={props.saveId}
          returnPath={returnPath}
          targetDate={selectedDate}
          currentDate={props.view.currentDate}
          preview={preview}
          disabled={props.view.timeDisabled}
        />
      </div>

      <SimulationSummaryModal
        open={props.showSimSummary}
        daysAdvanced={props.daysAdvanced}
        highlightCount={props.highlightCount}
        returnPath={returnPath}
        recentHighlights={props.view.recentMediaHighlights}
      />
    </div>
  );
}
