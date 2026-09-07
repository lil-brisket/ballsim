import Link from "next/link";
import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";
import {
  toFacilitiesView,
  toFranchiseBusinessView,
  toFranchiseHistoryView,
  toSponsorshipsView,
} from "@/state/franchise-selectors";
import { explainFranchiseValue } from "@/state/franchise-value";
import { getActiveOwnerTeamId } from "@/state/owner-context";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Franchise overview launcher — summary cards deep-link to existing subsystems.
 * Does not embed facility/business/history pages.
 */
export default async function FranchiseOverviewPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) {
    notFound();
  }
  const state = loaded.state;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const business = toFranchiseBusinessView(state);
  const value = explainFranchiseValue(state, teamId);
  const facilities = toFacilitiesView(state);
  const sponsorships = toSponsorshipsView(state);
  const history = toFranchiseHistoryView(state);
  const base = `/dashboard/${saveId}`;
  const arena = facilities.find((f) => f.category === "arena");
  const activeSponsorships = sponsorships.filter(
    (s) => s.status === "active",
  ).length;

  return (
    <>
      <PageHeader
        title="Franchise"
        subtitle={
          team
            ? `${team.city} ${team.name} · long-term ownership systems`
            : "Long-term ownership systems"
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Franchise value"
          value={<MoneyDisplay amount={value.total} />}
        />
        <StatCard label="Market size" value={`${business.marketSize}`} />
        <StatCard label="Fan sentiment" value={`${business.fanSentiment}`} />
        <StatCard label="Awareness" value={`${business.awareness}`} />
      </section>

      <Section title="Operations">
        <div className="grid gap-3 sm:grid-cols-2">
          <HubCard
            title="Arena"
            description={
              arena
                ? `Level ${arena.level} — capacity and gate demand`
                : "Arena capacity and upgrades"
            }
            href={`${base}/facilities`}
            cta="Manage Facilities"
          />
          <HubCard
            title="Facilities"
            description={`${facilities.length} facility categories for development and operations`}
            href={`${base}/facilities`}
            cta="Manage Facilities"
          />
        </div>
      </Section>

      <Section title="Identity & commercial">
        <div className="grid gap-3 sm:grid-cols-2">
          <HubCard
            title="Brand & marketing"
            description={`Reputation ${business.reputation} · ticket pricing and campaigns`}
            href={`${base}/business`}
            cta="Manage Branding"
          />
          <HubCard
            title="Sponsorships"
            description={
              activeSponsorships > 0
                ? `${activeSponsorships} active deal${activeSponsorships === 1 ? "" : "s"}`
                : "No active sponsorship — optional revenue"
            }
            href={`${base}/sponsorships`}
            cta="Review Sponsorships"
          />
        </div>
      </Section>

      <Section title="Finances & history">
        <div className="grid gap-3 sm:grid-cols-2">
          <HubCard
            title="Finances"
            description="Payroll, cash, and season P&L"
            href={`${base}/finances`}
            cta="View Finances"
          />
          <HubCard
            title="History"
            description={
              history.seasons.length > 0
                ? `${history.seasons.length} season${history.seasons.length === 1 ? "" : "s"} recorded`
                : "Franchise season archive"
            }
            href={`${base}/history`}
            cta="View History"
          />
        </div>
      </Section>

      <p className="text-sm text-zinc-500">
        Major franchise moves such as relocation are available from the Offseason
        Hub when eligible — not as permanent destinations.
      </p>
    </>
  );
}

function HubCard(props: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={props.href}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 transition-colors hover:border-amber-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
        {props.title}
      </p>
      <p className="mt-1 text-sm text-zinc-300">{props.description}</p>
      <p className="mt-3 text-sm font-medium text-amber-400">{props.cta}</p>
    </Link>
  );
}
