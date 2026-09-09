import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDevelopmentHubView } from "@/application/game-service";
import { DevelopmentRow } from "@/components/development/DevelopmentRow";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function DevelopmentHubPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadDevelopmentHubView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Player Development"
        subtitle="Which players are changing — and what to watch"
        actions={
          <Link
            href={`/dashboard/${saveId}/development-league`}
            className="text-sm text-amber-400 hover:underline"
          >
            Franchise Development League
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-800 pb-3">
        <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Developing
            </dt>
            <dd className="font-medium text-zinc-100">
              {view.stageCounts.developing}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Prime
            </dt>
            <dd className="font-medium text-zinc-100">
              {view.stageCounts.prime}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Declining
            </dt>
            <dd className="font-medium text-zinc-100">
              {view.stageCounts.declining}
            </dd>
          </div>
        </dl>
        <div className="max-w-xs text-right text-xs text-zinc-500">
          <p className="uppercase tracking-wide text-zinc-600">
            Development Staff Context
          </p>
          {view.staffContext.trainerName && view.staffContext.trainerId ? (
            <p className="mt-0.5 text-zinc-300">
              <StaffEntityLink
                saveId={saveId}
                staffId={view.staffContext.trainerId}
              >
                {view.staffContext.trainerName}
              </StaffEntityLink>
              {view.staffContext.trainerOverall !== null
                ? ` · OVR ${view.staffContext.trainerOverall}`
                : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-zinc-600">No trainer on staff</p>
          )}
          <p className="mt-1 text-[0.65rem] text-zinc-600">
            Organizational context only — not a causal development claim.
          </p>
        </div>
      </div>

      <ManagementDecisionPanel
        title="Development Decisions"
        items={view.decisions}
        saveId={saveId}
        currentDate={view.currentDate}
        emptyMessage="No development-related decisions right now."
      />

      <Section title="Players to watch">
        {view.notableImprovers.length === 0 ? (
          <EmptyState message="No season-over-season improvement data available yet." />
        ) : (
          <ul className="space-y-1.5 text-sm">
            {view.notableImprovers.map((p) => (
              <li
                key={p.playerId}
                className="flex flex-wrap items-center justify-between gap-2 text-zinc-300"
              >
                <PlayerEntityLink saveId={saveId} playerId={p.playerId}>
                  {p.playerName}
                </PlayerEntityLink>
                <span className="font-mono text-emerald-300">
                  {p.changeDelta !== null && p.changeDelta > 0
                    ? `+${p.changeDelta}`
                    : p.changeDelta}
                  {p.changeLabel ? (
                    <span className="ml-2 text-xs text-zinc-600">
                      {p.changeLabel}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Roster development">
        {view.rows.length === 0 ? (
          <EmptyState message="No players on the roster." />
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              headers={["Player", "Stage", "OVR", "Change", "POT", "DL"]}
            >
              {view.rows.map((row) => (
                <DevelopmentRow
                  key={row.playerId}
                  saveId={saveId}
                  row={row}
                />
              ))}
            </DataTable>
          </div>
        )}
      </Section>
    </div>
  );
}
