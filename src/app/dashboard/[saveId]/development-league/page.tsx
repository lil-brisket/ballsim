import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDevelopmentLeagueHubView } from "@/application/game-service";
import {
  DlEligibleRow,
  DlProspectRow,
} from "@/components/development-league/DlProspectRow";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function DevelopmentLeaguePage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadDevelopmentLeagueHubView(saveId);
  if (!view) {
    notFound();
  }
  const returnPath = `/dashboard/${saveId}/development-league`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Franchise Development League"
        subtitle={`${view.teamName} · developmental pipeline`}
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={`/dashboard/${saveId}/development`}
              className="text-amber-400 hover:underline"
            >
              Player Development
            </Link>
            <Link
              href={`/dashboard/${saveId}/roster`}
              className="text-amber-400 hover:underline"
            >
              Roster
            </Link>
          </div>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap items-baseline gap-4 border-b border-zinc-800 pb-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
            Record
          </p>
          <p className="font-medium text-zinc-100">
            {view.record
              ? `${view.record.wins}–${view.record.losses}`
              : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-emerald-300">
            {view.summary.ready} Ready
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-200">
            {view.summary.developing} Developing
          </span>
          <span className="rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-amber-300">
            {view.summary.nearReady} Near Ready
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-400">
            {view.summary.notReady} Not Ready
          </span>
        </div>
      </div>

      {/* 1. Ready for recall */}
      <Section title="Ready for recall">
        {view.recallCandidates.length === 0 ? (
          <EmptyState message="No players are currently ready for recall." />
        ) : (
          <ProspectTable
            saveId={saveId}
            rows={view.recallCandidates}
            returnPath={returnPath}
          />
        )}
      </Section>

      {/* 2. Currently developing */}
      <Section title="Currently developing">
        {view.developingProspects.length === 0 ? (
          <EmptyState message="No other players currently assigned." />
        ) : (
          <ProspectTable
            saveId={saveId}
            rows={view.developingProspects}
            returnPath={returnPath}
          />
        )}
      </Section>

      {/* 3. Notable performance */}
      <Section title="Notable performance">
        {view.notablePerformance.length === 0 ? (
          <EmptyState message="No standout DL scoring lines available yet." />
        ) : (
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {view.notablePerformance.map((p) => (
              <li key={p.playerId} className="flex justify-between gap-4">
                <span>{p.name}</span>
                <span className="font-mono text-zinc-400">
                  {p.ppg !== null ? `${p.ppg.toFixed(1)} PPG` : "—"}
                  {p.mpg !== null ? ` · ${p.mpg} MPG` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Recent results */}
      <Section title="Recent results">
        {view.recentResults.length === 0 ? (
          <EmptyState message="No completed Development League games yet." />
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-sm">
            {view.recentResults.map((g) => (
              <li
                key={g.gameId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-zinc-300"
              >
                <span className="text-zinc-500">{g.date}</span>
                <span>
                  {g.home ? "vs" : "@"} {g.opponentAbbreviation}
                </span>
                <span
                  className={
                    g.won ? "font-medium text-emerald-300" : "text-zinc-400"
                  }
                >
                  {g.teamScore}–{g.opponentScore} {g.won ? "W" : "L"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 4. Eligible to assign */}
      <Section title="Eligible to assign">
        {view.eligibleToAssign.length === 0 ? (
          <EmptyState message="No eligible players available to assign." />
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
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {view.eligibleToAssign.map((row) => (
                  <DlEligibleRow
                    key={row.playerId}
                    saveId={saveId}
                    row={row}
                    returnPath={returnPath}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function ProspectTable(props: {
  saveId: string;
  rows: import("@/state/development-league-selectors").DlProspectRowView[];
  returnPath: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">OVR</th>
            <th className="px-3 py-2">POT</th>
            <th className="px-3 py-2">DL Season</th>
            <th className="px-3 py-2">MPG</th>
            <th className="px-3 py-2">PPG</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Context</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <DlProspectRow
              key={row.playerId}
              saveId={props.saveId}
              row={row}
              returnPath={props.returnPath}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
