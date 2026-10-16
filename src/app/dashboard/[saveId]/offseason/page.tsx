import type { Metadata } from "next";
import { cn, linkClass } from "@/components/ui/styles";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { ActionCenter } from "@/components/action-center/ActionCenter";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { OffseasonHeaderStrip } from "@/components/offseason/OffseasonHeaderStrip";
import { OffseasonTimeline } from "@/components/offseason/OffseasonTimeline";
import { OffseasonStatusChecklist } from "@/components/offseason/OffseasonStatusChecklist";
import { OffseasonQuickLinks } from "@/components/offseason/OffseasonQuickLinks";
import { toOffseasonHubView } from "@/state/offseason-hub-selectors";

export const metadata: Metadata = { title: "Offseason Hub" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Offseason Command Center — decision context for the offseason window.
 * Calendar remains the only time-advancement interface.
 */
export default async function OffseasonCommandCenterPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    notFound();
  }

  const view = toOffseasonHubView(loaded.state);
  const returnPath = `/dashboard/${saveId}/offseason`;
  const calendarHref = `/dashboard/${saveId}/calendar`;

  if (!view.active) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Offseason Command Center"
          subtitle="Available when the season enters the offseason"
        />
        {error ? <ErrorState message={error} /> : null}
        <EmptyState message="The offseason has not begun for this franchise. Use the Calendar to advance through the current season." />
        <Link
          href={calendarHref}
          className={cn(linkClass, "inline-block text-sm font-medium")}
        >
          Open Calendar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offseason Command Center"
        subtitle={`Season ${view.seasonYear} · ${view.offseasonStageLabel}`}
        actions={
          <Link
            href={calendarHref}
            className="rounded-md border border-team-ink/50 bg-team/15 px-3 py-1.5 text-sm text-zinc-50 hover:border-team-ink"
          >
            Open Calendar
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <OffseasonHeaderStrip view={view} />

      <Section title="Timeline">
        <p className="mb-3 text-sm text-zinc-400">
          Upcoming offseason events from the Calendar. Advance time only on the
          Calendar — completing workflows here does not move the date.
        </p>
        <OffseasonTimeline events={view.timeline} />
      </Section>

      <ActionCenter
        view={view.actionCenter}
        saveId={saveId}
        returnPath={returnPath}
      />

      <Section title="Status">
        <OffseasonStatusChecklist items={view.status} />
      </Section>

      <Section title="Destinations">
        <OffseasonQuickLinks links={view.quickLinks} />
      </Section>
    </div>
  );
}
