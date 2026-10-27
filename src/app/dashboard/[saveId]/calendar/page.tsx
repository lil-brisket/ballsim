import type { Metadata } from "next";
import { formatGameDate } from "@/presentation/game-date";
import { notFound } from "next/navigation";
import {
  advanceLeaguePhaseAction,
  dismissPhaseTaskAction,
  switchActiveOwnerTeamAction,
} from "@/application/actions";
import { loadCalendarPageView } from "@/application/game-service";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { PhaseDashboard } from "@/components/phase/PhaseDashboard";
import { ErrorState } from "@/components/ui/EmptyState";
import { cn, focusRingClass } from "@/components/ui/styles";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScheduleViewSwitch } from "@/components/calendar/ScheduleViewSwitch";
import { parseCalendarDate } from "@/domain/calendar-date";

export const metadata: Metadata = { title: "Calendar" };

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
    resumeTo?: string;
    autoResume?: string;
  }>;
};

/**
 * Owner Mode Calendar — primary time-navigation surface.
 * Month grid + Date Inspector + compact league context.
 * Tapping a future date confirms a simulate-to-date jump.
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
    resumeTo: sp.resumeTo,
  });
  if (!view) {
    notFound();
  }

  const highlightCount = sp.highlights ? Number(sp.highlights) : 0;

  return (
    <>
      <PageHeader
        title="Schedule"
        actions={<ScheduleViewSwitch saveId={saveId} active="calendar" />}
        subtitle={`${view.dashboard.controlledTeam.city} ${view.dashboard.controlledTeam.name} · ${formatGameDate(view.currentDate, { weekday: true })}`}
      />

      {sp.error ? <ErrorState message={sp.error} /> : null}

      <CalendarWorkspace
        view={view}
        saveId={saveId}
        showSimSummary={showSimSummary}
        daysAdvanced={Number.isFinite(daysAdvanced) ? daysAdvanced : 0}
        highlightCount={Number.isFinite(highlightCount) ? highlightCount : 0}
        fromDate={sp.fromDate ?? null}
        resumeTo={sp.resumeTo ?? view.resumeTo}
        autoResume={sp.autoResume === "1"}
      />

      <details className="mt-8 rounded-xl border border-line bg-surface-raised/30 px-4 py-3">
        <summary
          className={cn(
            "flex min-h-11 cursor-pointer items-center text-sm text-muted",
            focusRingClass,
          )}
        >
          Season phase details
        </summary>
        <div className="mt-4">
          <PhaseDashboard
            view={view.phaseDashboard}
            saveId={saveId}
            returnPath={`/dashboard/${saveId}/calendar`}
            currentDate={view.currentDate}
            seasonYear={view.dashboard.seasonYear}
            advanceAction={advanceLeaguePhaseAction}
            dismissAction={dismissPhaseTaskAction}
            switchTeamAction={switchActiveOwnerTeamAction}
          />
        </div>
      </details>
    </>
  );
}
