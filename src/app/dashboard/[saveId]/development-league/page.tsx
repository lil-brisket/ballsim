import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDevelopmentLeagueHubView } from "@/application/game-service";
import {
  DlAssignSection,
  DlPipelineSection,
  DlPipelineSummary,
} from "@/components/development-league/DlPipelineSummary";
import {
  DlEligibleCard,
  DlEligibleRow,
  DlProspectCard,
} from "@/components/development-league/DlProspectCard";
import { DlTeamPerformancePanel } from "@/components/development-league/DlTeamPerformancePanel";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { DataTable } from "@/components/ui/DataTable";
import { cn, densityGap, focusRingClass } from "@/components/ui/styles";

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
    <div className="space-y-6">
      <PageHeader
        title="Development League"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <TeamIdentityInline
              city={view.city}
              name={view.name}
              abbreviation={view.abbreviation}
              branding={view.branding}
            />
            <span className="text-zinc-500">· developmental pipeline</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={`/dashboard/${saveId}/development`}
              className={cn("text-amber-400 hover:underline", focusRingClass)}
            >
              Player Development
            </Link>
            <Link
              href={`/dashboard/${saveId}/roster`}
              className={cn("text-amber-400 hover:underline", focusRingClass)}
            >
              Roster
            </Link>
          </div>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <DlPipelineSummary
        record={view.record}
        assignedCount={view.assignedCount}
        ready={view.summary.ready}
        nearReady={view.summary.nearReady}
        developing={view.summary.developing}
        leagueRank={view.leagueRank}
        streakLabel={view.streakLabel}
      />

      <DlPipelineSection>
        <Section title="Assigned prospects">
          {view.prospects.length === 0 ? (
            <EmptyState message="No prospects assigned" />
          ) : (
            <div className={cn("grid grid-cols-1", densityGap.default)}>
              {view.prospects.map((row) => (
                <DlProspectCard
                  key={row.playerId}
                  saveId={saveId}
                  row={row}
                  returnPath={returnPath}
                />
              ))}
            </div>
          )}
        </Section>
      </DlPipelineSection>

      {view.improvers.length > 0 || view.notablePerformance.length > 0 ? (
        <Section title="Improving & notable">
          {view.improvers.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {view.improvers.map((p) => (
                <li
                  key={p.playerId}
                  className="flex flex-wrap items-center justify-between gap-2 text-zinc-300"
                >
                  <PlayerEntityLink saveId={saveId} playerId={p.playerId}>
                    {p.name}
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
          ) : null}
          {view.notablePerformance.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
              {view.notablePerformance.map((p) => (
                <li
                  key={p.playerId}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <PlayerEntityLink saveId={saveId} playerId={p.playerId}>
                    {p.name}
                  </PlayerEntityLink>
                  <span className="font-mono text-xs">
                    {p.ppg !== null ? `${p.ppg.toFixed(1)} PPG` : "—"}
                    {p.rpg !== null ? ` · ${p.rpg.toFixed(1)} RPG` : ""}
                    {p.apg !== null ? ` · ${p.apg.toFixed(1)} APG` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      <DlTeamPerformancePanel
        saveId={saveId}
        assignedCount={view.assignedCount}
        games={view.recentResults}
      />

      <DlAssignSection>
        <Section title="Assign from roster">
          <p className="text-xs text-zinc-600">
            Assignment is optional. Use this list when a prospect needs Development
            League minutes; day-to-day management is not required here.
          </p>
          {view.eligibleToAssign.length === 0 ? (
            <EmptyState message="No eligible players available to assign." />
          ) : (
            <>
              <ul className={cn("md:hidden", densityGap.compact, "flex flex-col")}>
                {view.eligibleToAssign.map((row) => (
                  <li key={row.playerId}>
                    <DlEligibleCard
                      saveId={saveId}
                      row={row}
                      returnPath={returnPath}
                    />
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <DataTable
                  caption="Eligible players to assign to the Development League"
                  headers={[
                    "Player",
                    "OVR",
                    "POT",
                    "Recommendation",
                    "Action",
                  ]}
                >
                  {view.eligibleToAssign.map((row) => (
                    <DlEligibleRow
                      key={row.playerId}
                      saveId={saveId}
                      row={row}
                      returnPath={returnPath}
                    />
                  ))}
                </DataTable>
              </div>
            </>
          )}
        </Section>
      </DlAssignSection>
    </div>
  );
}
