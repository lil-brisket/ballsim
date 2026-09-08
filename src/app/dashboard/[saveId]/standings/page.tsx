import { notFound } from "next/navigation";
import { takeOverFranchiseAction } from "@/application/actions";
import { loadStandingsPageView } from "@/application/game-service";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { formatStreak } from "@/state/standings-selectors";
import { cn } from "@/components/ui/styles";

type StandingsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

function playoffLabelText(label: string): string | null {
  switch (label) {
    case "clinched":
      return "Clinched";
    case "playoff":
      return "Playoff";
    case "play_in":
      return "Play-in";
    case "bubble":
      return "Bubble";
    default:
      return null;
  }
}

export default async function StandingsPage({
  params,
  searchParams,
}: StandingsPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadStandingsPageView(saveId);
  if (!view) {
    notFound();
  }

  const ownedIds = new Set(view.ownedTeamIds);
  const subtitle =
    view.mode === "offseason"
      ? `${view.seasonYear} Final Standings${
          view.championTeamId ? " · Season complete" : ""
        }`
      : view.mode === "playoffs"
        ? `${view.seasonYear} Playoffs · ${view.playoffStatus}`
        : `${view.seasonYear} ${view.seasonPhase}`;

  return (
    <>
      <PageHeader title="Standings" subtitle={subtitle} />
      {error ? <ErrorState message={error} /> : null}

      {view.mode === "playoffs" ? (
        <p className="mb-3 rounded-md border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-300">
          Playoffs in progress — regular-season cutoff markers are historical
          context only.
        </p>
      ) : null}

      {view.groups.length === 0 ? (
        <EmptyState message="No standings available." />
      ) : (
        <div className="space-y-8">
          {view.groups.map((group) => (
            <section key={group.conferenceId} aria-label={group.conferenceName}>
              <h2 className="mb-2 text-sm font-medium text-zinc-200">
                {group.conferenceName}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Team</th>
                      <th className="px-3 py-2 font-medium">W</th>
                      <th className="px-3 py-2 font-medium">L</th>
                      <th className="px-3 py-2 font-medium">PCT</th>
                      <th className="px-3 py-2 font-medium">GB</th>
                      <th className="px-3 py-2 font-medium">Str</th>
                      <th className="px-3 py-2 font-medium"> </th>
                      <th className="px-3 py-2 font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      const cutoff =
                        view.mode === "regular" &&
                        row.conferenceRank === group.cutoffRank;
                      const label = playoffLabelText(row.playoffLabel);
                      return (
                        <tr
                          key={row.teamId}
                          className={cn(
                            "border-t border-zinc-800",
                            row.isUserTeam &&
                              "bg-amber-950/30 font-medium text-amber-300",
                            cutoff && "border-t border-dashed border-amber-700/60",
                          )}
                        >
                          <td className="px-3 py-2 font-mono text-zinc-500">
                            {row.conferenceRank}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-2">
                              <TeamEntityLink
                                saveId={saveId}
                                teamId={row.teamId}
                                className="inline-flex items-center gap-2 hover:text-amber-400"
                              >
                                <TeamIdentityInline
                                  city={row.city}
                                  name={row.name}
                                  abbreviation={row.abbreviation}
                                  branding={row.branding}
                                  size="sm"
                                />
                              </TeamEntityLink>
                              {row.isUserTeam ? (
                                <span className="text-amber-400">— you</span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{row.wins}</td>
                          <td className="px-3 py-2 font-mono">{row.losses}</td>
                          <td className="px-3 py-2 font-mono text-zinc-400">
                            {row.winPercentage.toFixed(3).replace(/^0/, "")}
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-400">
                            {row.gamesBackConference === 0
                              ? "—"
                              : row.gamesBackConference}
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-500">
                            {formatStreak(row.streak)}
                          </td>
                          <td className="px-3 py-2 text-xs text-zinc-500">
                            {label}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {!ownedIds.has(row.teamId) ? (
                              <form action={takeOverFranchiseAction}>
                                <input
                                  type="hidden"
                                  name="saveId"
                                  value={saveId}
                                />
                                <input
                                  type="hidden"
                                  name="teamId"
                                  value={row.teamId}
                                />
                                <button
                                  type="submit"
                                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-amber-600 hover:text-amber-300"
                                >
                                  Take Over
                                </button>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {view.mode === "regular" && group.cutoffRank > 0 ? (
                <p className="mt-1 text-xs text-zinc-600">
                  Playoff cutoff at rank {group.cutoffRank} (from league field
                  size {view.fieldSize || "—"})
                </p>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
