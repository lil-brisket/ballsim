import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";

type StandingsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function StandingsPage({
  params,
  searchParams,
}: StandingsPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Standings"
        subtitle={`${view.dashboard.seasonYear} ${view.dashboard.seasonPhase}`}
      />
      {error ? <ErrorState message={error} /> : null}
      {view.standings.length === 0 ? (
        <EmptyState message="No standings available." />
      ) : (
        <DataTable headers={["#", "Team", "W", "L"]}>
          {view.standings.map((row) => (
            <tr
              key={row.teamId}
              className={`border-t border-zinc-800 ${
                row.isUserTeam
                  ? "bg-amber-950/30 font-medium text-amber-300"
                  : ""
              }`}
            >
              <td className="px-3 py-2 text-zinc-500">{row.rank}</td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <TeamIdentityInline
                    city={row.city}
                    name={row.name}
                    abbreviation={row.abbreviation}
                    branding={row.branding}
                    size="sm"
                  />
                  {row.isUserTeam ? (
                    <span className="text-amber-400">— you</span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2">{row.wins}</td>
              <td className="px-3 py-2">{row.losses}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
