import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
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

  return (
    <>
      <PageHeader
        title="Franchise History"
        subtitle="Per-season snapshots — franchise value is derived, not a live mutable field"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Season records">
        {view.franchiseHistory.seasons.length === 0 ? (
          <EmptyState message="No completed seasons recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Record</th>
                  <th className="px-3 py-2">Playoffs</th>
                  <th className="px-3 py-2">Revenue</th>
                  <th className="px-3 py-2">Sentiment</th>
                  <th className="px-3 py-2">Reputation</th>
                  <th className="px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {[...view.franchiseHistory.seasons].reverse().map((season) => (
                  <tr
                    key={season.seasonId}
                    className="border-b border-zinc-900 text-zinc-200"
                  >
                    <td className="px-3 py-2">{season.seasonYear}</td>
                    <td className="px-3 py-2">
                      {season.wins}-{season.losses}
                    </td>
                    <td className="px-3 py-2">
                      {season.championship
                        ? "Champion"
                        : season.playoffResult.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-2">
                      <MoneyDisplay amount={season.revenue} />
                    </td>
                    <td className="px-3 py-2">{season.fanSentiment}</td>
                    <td className="px-3 py-2">{season.reputation}</td>
                    <td className="px-3 py-2">
                      <MoneyDisplay amount={season.franchiseValue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
