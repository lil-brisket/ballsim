import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFinanceHubView } from "@/application/game-service";
import { FacilityUpgradeList } from "@/components/finances/FacilityUpgradeList";
import { FinancesViews } from "@/components/finances/FinancesViews";
import { ErrorState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { StatCard } from "@/components/ui/StatCard";

export const metadata: Metadata = { title: "Arena & Facilities" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Finances › Arena & Facilities — upgrades are capital spends. */
export default async function FinancesFacilitiesPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadFinanceHubView(saveId);
  if (!view) {
    notFound();
  }
  const { business, finances } = view;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finances"
        subtitle={`${view.teamName} · Season ${view.seasonYear}`}
      />
      <FinancesViews saveId={saveId} active="facilities" />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Business funds"
          value={<MoneyDisplay amount={finances.businessFunds} />}
          density="compact"
        />
        <StatCard
          label="Arena capacity"
          value={business.arenaCapacity.toLocaleString()}
          density="compact"
        />
        <StatCard
          label="Weekly facility OPEX"
          value={
            <MoneyDisplay
              amount={business.cashRunway.outflowBreakdown.facilities}
            />
          }
          density="compact"
        />
      </section>

      <Section title="Facility upgrades">
        <FacilityUpgradeList
          saveId={saveId}
          rows={view.facilities}
          returnPath={`/dashboard/${saveId}/finances/facilities`}
        />
      </Section>

      <Section title="How facilities help">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Arena level raises maximum attendance (capacity).</li>
          <li>
            Practice, training, and medical improve the distribution of player
            development in the offseason — they do not guarantee overall gains.
          </li>
          <li>
            Youth facilities slightly help developing players. Fan facilities do
            not yet change sentiment in this build.
          </li>
          <li>
            Upgrades cost cash up front and raise weekly operating expense.
          </li>
        </ul>
      </Section>
    </div>
  );
}
