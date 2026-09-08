import { notFound } from "next/navigation";
import { loadCalendarPageView } from "@/application/game-service";
import { CalendarTodayBriefing } from "@/components/calendar/CalendarTodayBriefing";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import type { CalendarFilter } from "@/domain/entities/calendar-event";
import { parseCalendarDate } from "@/domain/calendar-date";

type CalendarPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    year?: string;
    month?: string;
    date?: string;
    filter?: string;
    simSummary?: string;
    daysAdvanced?: string;
    highlights?: string;
    fromDate?: string;
    focus?: string;
  }>;
};

/**
 * First-class Calendar — primary time-control surface.
 * Month view + Today briefing + simulate-until; selecting a date does not simulate.
 */
export default async function CalendarPage({
  params,
  searchParams,
}: CalendarPageProps) {
  const { saveId } = await params;
  const sp = await searchParams;

  let year = sp.year ? Number(sp.year) : undefined;
  let month = sp.month ? Number(sp.month) : undefined;
  const daysAdvanced = sp.daysAdvanced ? Number(sp.daysAdvanced) : 0;
  const showSimSummary = sp.simSummary === "1";
  let selectedDate = sp.date;

  // Resolve focus=next-game server-side so CalendarWorkspace stays URL-driven.
  if (sp.focus === "next-game" && !selectedDate) {
    const probe = await loadCalendarPageView(saveId, {});
    const nextGameDate = probe?.nextTargets.nextGame?.date;
    if (nextGameDate) {
      selectedDate = nextGameDate;
      const parsed = parseCalendarDate(nextGameDate);
      year = parsed.year;
      month = parsed.month;
    }
  }

  const view = await loadCalendarPageView(saveId, {
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) ? month : undefined,
    selectedDate,
    filter: sp.filter as CalendarFilter | undefined,
    simulationFromDate: sp.fromDate,
    daysAdvanced:
      showSimSummary && Number.isFinite(daysAdvanced) && daysAdvanced > 0
        ? daysAdvanced
        : undefined,
  });
  if (!view) {
    notFound();
  }

  const highlightCount = sp.highlights ? Number(sp.highlights) : 0;

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={`${view.dashboard.controlledTeam.city} ${view.dashboard.controlledTeam.name} · ${view.currentDate}`}
      />

      {sp.error ? <ErrorState message={sp.error} /> : null}

      <div className="mb-6">
        <CalendarTodayBriefing briefing={view.todayBriefing} />
      </div>

      <CalendarWorkspace
        view={view}
        saveId={saveId}
        showSimSummary={showSimSummary}
        daysAdvanced={Number.isFinite(daysAdvanced) ? daysAdvanced : 0}
        highlightCount={Number.isFinite(highlightCount) ? highlightCount : 0}
        fromDate={sp.fromDate ?? null}
        focus={sp.focus ?? null}
      />
    </>
  );
}
