import { notFound } from "next/navigation";
import { loadCalendarPageView } from "@/application/game-service";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { parseCalendarDate } from "@/domain/calendar-date";

type CalendarPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    year?: string;
    month?: string;
    date?: string;
    simSummary?: string;
    daysAdvanced?: string;
    highlights?: string;
    fromDate?: string;
    focus?: string;
  }>;
};

/**
 * Owner Mode Calendar — primary time-navigation surface.
 * Month grid + Date Inspector + compact league context.
 * Selecting a date does not simulate; only the inspector action does.
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

  // Resolve focus=next-game server-side so the workspace stays URL-driven.
  if (sp.focus === "next-game" && !selectedDate) {
    const probe = await loadCalendarPageView(saveId, {});
    const nextGameDate = probe?.nextTeamGameDate;
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

      <CalendarWorkspace
        view={view}
        saveId={saveId}
        showSimSummary={showSimSummary}
        daysAdvanced={Number.isFinite(daysAdvanced) ? daysAdvanced : 0}
        highlightCount={Number.isFinite(highlightCount) ? highlightCount : 0}
        fromDate={sp.fromDate ?? null}
      />
    </>
  );
}
