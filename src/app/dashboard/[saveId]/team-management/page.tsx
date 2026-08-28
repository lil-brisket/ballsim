import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";
import { StatusBadge } from "@/components/owner/StatusBadge";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function TeamManagementOverviewPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadTeamManagementView(saveId);
  if (!view) {
    notFound();
  }

  const { overview } = view;
  const base = `/dashboard/${saveId}/team-management`;

  return (
    <>
      <PageHeader
        title="Team Management"
        subtitle="Front-office hub for lineup, rotation, coaching, and roster health"
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Planned minutes"
          value={`${overview.totalPlanned} / ${overview.targetMinutes}`}
        />
        <StatCard label="Rotation depth" value={`${overview.rotationDepth}`} />
        <StatCard label="Injured" value={`${overview.injuredCount}`} />
        <StatCard
          label="Coaching"
          value={
            <span className="inline-flex items-center gap-2">
              {overview.coachingLabel}
              {overview.coachingCustomized ? (
                <StatusBadge label="Customized" tone="warning" />
              ) : null}
            </span>
          }
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Starting five">
          {overview.starters.length === 0 ? (
            <EmptyState message="No starting lineup configured yet." />
          ) : (
            <ul className="space-y-2">
              {overview.starters.map((starter) => (
                <li
                  key={starter.slot}
                  className="flex items-center justify-between rounded-md border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-amber-400">{starter.slot}</span>
                  <span className="text-zinc-100">{starter.name}</span>
                  <span className="text-zinc-500">{starter.overall}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`${base}/lineups`}
            className="mt-3 inline-block text-sm text-amber-400 hover:underline"
          >
            Manage lineups →
          </Link>
        </Section>

        <Section title="Recent transactions">
          {overview.recentTransactions.length === 0 ? (
            <EmptyState message="No season transactions yet." />
          ) : (
            <ul className="space-y-2 text-sm">
              {overview.recentTransactions.map((entry) => (
                <li key={entry.id} className="border-b border-zinc-800 pb-2">
                  <span className="font-mono text-xs text-zinc-500">
                    {entry.occurredOn}
                  </span>
                  <p className="text-zinc-100">{entry.description}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`${base}/transactions`}
            className="mt-3 inline-block text-sm text-amber-400 hover:underline"
          >
            View all transactions →
          </Link>
        </Section>
      </div>

      {overview.injuredCount > 0 ? (
        <Section title="Injuries affecting the roster">
          <p className="text-sm text-zinc-400">
            {overview.injuredCount} player
            {overview.injuredCount === 1 ? "" : "s"} currently injured. Review
            availability before locking a lineup.
          </p>
          <Link
            href={`${base}/injuries`}
            className="mt-2 inline-block text-sm text-amber-400 hover:underline"
          >
            Open injury report →
          </Link>
        </Section>
      ) : null}
    </>
  );
}
