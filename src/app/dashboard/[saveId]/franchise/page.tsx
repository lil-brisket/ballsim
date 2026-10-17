import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFranchiseHubView } from "@/application/game-service";
import { FacilitiesSummarySection } from "@/components/franchise/FacilitiesSummarySection";
import { FinanceSnapshotCard } from "@/components/franchise/FinanceSnapshotCard";
import { RelocationSummarySection } from "@/components/franchise/RelocationSummarySection";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { FranchiseHistorySummary } from "@/components/owner/FranchiseHistorySummary";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Gauge } from "@/components/ui/Gauge";
import { StatCard } from "@/components/ui/StatCard";

export const metadata: Metadata = { title: "Franchise" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

function formatDriver(key: string | null): string | null {
  if (!key) {
    return null;
  }
  return key.replaceAll("_", " ");
}

/**
 * Franchise Hub — ownership / GM command center.
 * Deep work lives on subsystem pages; this surface does not submit actions.
 */
export default async function FranchiseOverviewPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadFranchiseHubView(saveId);
  if (!view) {
    notFound();
  }

  const positive = formatDriver(view.valueExplanation.topPositiveDriver);
  const negative = formatDriver(view.valueExplanation.topNegativeDriver);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Franchise"
        subtitle={`${view.teamName} · long-term ownership`}
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <p className="text-sm text-zinc-400">Organization</p>
          <SectionHeading as="h2" title={view.teamName} />
          <p className="text-sm text-zinc-500">
            Owner tenure:{" "}
            {view.ownerTenureYears > 0
              ? `${view.ownerTenureYears} season${view.ownerTenureYears === 1 ? "" : "s"}`
              : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-400">Franchise value</p>
          <p className="text-lg font-medium text-zinc-100">
            <MoneyDisplay amount={view.franchiseValue} />
          </p>
          <p className="text-sm capitalize text-zinc-500">
            {view.valueExplanation.standing.replaceAll("_", " ")}
          </p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Record"
          value={`${view.snapshot.wins}–${view.snapshot.losses}`}
          density="compact"
        />
        <StatCard
          label="Fan sentiment"
          value={
            <Gauge
              label="Fan sentiment"
              hideLabel
              value={view.snapshot.fanSentiment}
            />
          }
          density="compact"
        />
        <StatCard
          label="Health"
          value={view.snapshot.franchiseHealthLabel ?? "—"}
          density="compact"
        />
        <StatCard
          label="Value"
          value={<MoneyDisplay amount={view.snapshot.franchiseValue} />}
          density="compact"
        />
      </section>
      {view.snapshot.franchiseHealthSummary ? (
        <p className="text-sm leading-relaxed text-zinc-500">
          {view.snapshot.franchiseHealthSummary}
        </p>
      ) : null}
      {positive || negative ? (
        <p className="text-sm text-zinc-500">
          {positive ? `Driven by ${positive}` : null}
          {positive && negative ? " · " : null}
          {negative ? `Pressed by ${negative}` : null}
        </p>
      ) : null}

      <Section title="Management">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FinanceSnapshotCard
            snapshot={view.financeSnapshot}
            saveId={saveId}
          />
          <FacilitiesSummarySection
            summary={view.facilitiesSummary}
            saveId={saveId}
          />
          <RelocationSummarySection summary={view.relocationSummary} />
        </div>
      </Section>

      <ManagementDecisionPanel
        title="Franchise Decisions"
        items={view.decisions}
        saveId={saveId}
        currentDate={view.currentDate}
        emptyMessage="No franchise-level decisions need attention right now."
      />

      <Section title="Objectives">
        {view.objectives.length === 0 ? (
          <EmptyState message="No active ownership objectives." />
        ) : (
          <ul className="space-y-3">
            {view.objectives.map((obj) => {
              const hasProgress =
                obj.progress !== null && obj.target !== null && obj.target > 0;
              return (
                <li
                  key={obj.id}
                  className="rounded-lg border border-zinc-800 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      {obj.description}
                    </p>
                    <StatusBadge label={obj.status} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {obj.role.replaceAll("_", " ")}
                    {obj.horizonYears != null
                      ? ` · ${obj.horizonYears}y horizon`
                      : ""}
                    {obj.seasonYear ? ` · ${obj.seasonYear}` : ""}
                  </p>
                  {hasProgress ? (
                    <div className="mt-2">
                      <ProgressBar
                        value={obj.progress!}
                        max={obj.target!}
                        label="Progress"
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Franchise History">
        {view.history.seasons.length === 0 ? (
          <EmptyState message="No franchise history recorded yet." />
        ) : (
          <FranchiseHistorySummary view={view.history} />
        )}
      </Section>
    </div>
  );
}
