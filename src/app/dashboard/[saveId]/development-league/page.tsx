import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSave } from "@/application/game-service";
import {
  assignToDevelopmentLeagueAction,
  recallFromDevelopmentLeagueAction,
} from "@/application/actions";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { toDevelopmentLeagueDashboardView } from "@/state/development-league-selectors";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

function readinessLabel(value: string): string {
  switch (value) {
    case "ready":
      return "Ready";
    case "near_ready":
      return "Near Ready";
    case "developing":
      return "Developing";
    default:
      return "Not Ready";
  }
}

export default async function DevelopmentLeaguePage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    notFound();
  }
  const view = toDevelopmentLeagueDashboardView(loaded.state);

  return (
    <>
      <PageHeader
        title="Development League"
        subtitle={`${view.prospects.length} prospects developing for your franchise`}
        actions={
          <Link
            href={`/dashboard/${saveId}/roster`}
            className="text-sm text-amber-400 hover:underline"
          >
            Top-league roster
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-200">
          {view.summary.developing} Developing
        </span>
        <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-emerald-300">
          {view.summary.ready} Ready
        </span>
        <span className="rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-amber-300">
          {view.summary.nearReady} Near Ready
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-400">
          {view.summary.notReady} Not Ready
        </span>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">
          Your Prospects
        </h2>
        {view.prospects.length === 0 ? (
          <EmptyState message="No players currently assigned to the Development League." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">OVR</th>
                  <th className="px-3 py-2">POT</th>
                  <th className="px-3 py-2">DL Season</th>
                  <th className="px-3 py-2">MPG</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Why?</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.prospects.map((row) => (
                  <tr
                    key={row.playerId}
                    className="border-t border-zinc-800 text-zinc-200"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/${saveId}/players/${row.playerId}`}
                        className="text-amber-400 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.overall}</td>
                    <td className="px-3 py-2">{row.potential}</td>
                    <td className="px-3 py-2">
                      {row.dlSeason}/3 ({row.seasonsRemaining} left)
                    </td>
                    <td className="px-3 py-2">{row.mpg ?? "—"}</td>
                    <td className="px-3 py-2">
                      {readinessLabel(row.readiness)}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      <ul className="list-disc pl-4">
                        {row.whyBullets.slice(0, 3).map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2">
                      <form action={recallFromDevelopmentLeagueAction}>
                        <input type="hidden" name="saveId" value={saveId} />
                        <input
                          type="hidden"
                          name="playerId"
                          value={row.playerId}
                        />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={`/dashboard/${saveId}/development-league`}
                        />
                        <button
                          type="submit"
                          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-100 hover:border-amber-500"
                        >
                          Recall
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">
          Eligible to Assign
        </h2>
        {view.eligibleToAssign.length === 0 ? (
          <EmptyState message="No eligible draft prospects available to assign." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">OVR</th>
                  <th className="px-3 py-2">POT</th>
                  <th className="px-3 py-2">Proj. MPG</th>
                  <th className="px-3 py-2">Recommendation</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.eligibleToAssign.map((row) => (
                  <tr
                    key={row.playerId}
                    className="border-t border-zinc-800 text-zinc-200"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/${saveId}/players/${row.playerId}`}
                        className="text-amber-400 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.overall}</td>
                    <td className="px-3 py-2">{row.potential}</td>
                    <td className="px-3 py-2">{row.projectedMpg}</td>
                    <td className="px-3 py-2">
                      {row.strongCandidate
                        ? "Strong DL candidate"
                        : "Optional"}
                    </td>
                    <td className="px-3 py-2">
                      <form action={assignToDevelopmentLeagueAction}>
                        <input type="hidden" name="saveId" value={saveId} />
                        <input
                          type="hidden"
                          name="playerId"
                          value={row.playerId}
                        />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={`/dashboard/${saveId}/development-league`}
                        />
                        <button
                          type="submit"
                          className="rounded border border-amber-600 bg-amber-950/40 px-2 py-1 text-xs text-amber-200 hover:bg-amber-900/50"
                        >
                          Send to DL
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
