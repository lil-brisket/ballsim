import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import {
  FranchiseHistorySeasonTable,
  FranchiseHistorySummary,
} from "@/components/owner/FranchiseHistorySummary";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function HistoryPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const history = view.franchiseHistory;

  return (
    <>
      <PageHeader
        title="Franchise History"
        subtitle="Per-season snapshots — franchise value is derived, not a live mutable field"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Franchise summary">
        <FranchiseHistorySummary view={history} />
      </Section>

      <Section title="Season records">
        {history.seasons.length === 0 ? (
          <EmptyState message="No completed seasons recorded yet." />
        ) : (
          <FranchiseHistorySeasonTable seasons={history.seasons} />
        )}
      </Section>

      <Section title="Franchise story">
        {view.ownerDashboard.situations.length === 0 &&
        !view.notifications.some((n) => n.type === "narrative") ? (
          <EmptyState message="No narrative developments recorded yet." />
        ) : (
          <ul className="space-y-3">
            {view.ownerDashboard.situations.map((situation) => (
              <li
                key={situation.id}
                className="rounded-lg border border-zinc-800 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {situation.updatedOn} · {situation.category} ·{" "}
                  {situation.status}
                </p>
                <p className="mt-1 font-medium text-zinc-100">
                  {situation.title}
                </p>
                <p className="mt-1 text-sm text-zinc-400">{situation.summary}</p>
              </li>
            ))}
            {view.notifications
              .filter((notification) => notification.type === "narrative")
              .slice(0, 12)
              .map((notification) => (
                <li
                  key={notification.id}
                  className="rounded-lg border border-zinc-900 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {notification.occurredOn} · story
                  </p>
                  <p className="mt-1 font-medium text-zinc-200">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {notification.message}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </Section>
    </>
  );
}
