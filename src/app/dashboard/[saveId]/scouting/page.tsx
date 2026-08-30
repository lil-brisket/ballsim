import { notFound } from "next/navigation";
import {
  assignScoutAction,
  interviewProspectAction,
  scoutRegionAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";
import { getScoutingCoverageSummary } from "@/systems/scouting";
import { resolveScoutingRegion } from "@/domain/entities/scouting-regions";
import { toScoutingReportView } from "@/systems/scouting/scouting-reports";
import { ProspectCard } from "@/components/draft/ProspectCard";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";

type Props = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; prospect?: string }>;
};

export default async function ScoutingPage({ params, searchParams }: Props) {
  const { saveId } = await params;
  const { error, prospect: focusProspect } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) notFound();

  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) notFound();
  const state = loaded.state;
  const teamId = state.user.activeOwnerTeamId;
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draft = state.world.drafts[draftClassIdFor(draftYear)];
  const coverage = getScoutingCoverageSummary(state, teamId);
  const returnPath = `/dashboard/${saveId}/scouting`;
  const leagueArea = state.settings.league.area ?? "north_america";

  return (
    <>
      <PageHeader
        title="Scouting"
        subtitle="Assign scouts, build coverage, and deepen prospect reports"
      />
      {error ? <ErrorState message={error} /> : null}

      {!draft || draft.status === "complete" ? (
        <EmptyState message="Scouting is available during draft preparation and the draft." />
      ) : (
        <>
          <Section title="Coverage">
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <CoverageStat
                label="Domestic"
                value={`${Math.round(coverage.domestic * 100)}%`}
              />
              <CoverageStat
                label="International"
                value={`${Math.round(coverage.international * 100)}%`}
              />
              <CoverageStat label="Discovered" value={String(coverage.discovered)} />
              <CoverageStat
                label="Need more scouting"
                value={String(coverage.needsMoreScouting)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <form action={scoutRegionAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="region" value="domestic" />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-amber-300 hover:bg-zinc-900"
                >
                  Scout domestic region
                </button>
              </form>
              <form action={scoutRegionAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="region" value="international" />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-amber-300 hover:bg-zinc-900"
                >
                  Scout international region
                </button>
              </form>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Active assignments: {coverage.assignments}. Exposure improves when
              you advance days during draft prep.
            </p>
          </Section>

          <Section title="Prospect pool">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.values(draft.prospects)
                .filter((p) => p.status === "eligible")
                .slice(0, 36)
                .map((prospect) => {
                  const estimate = draft.teamDraftState[teamId]?.scouting.find(
                    (s) => s.prospectPlayerId === prospect.playerId,
                  );
                  const report = toScoutingReportView(estimate);
                  const region = resolveScoutingRegion(
                    leagueArea,
                    prospect.player.nationality,
                  );
                  const interview =
                    draft.teamDraftState[teamId]?.interviews[prospect.playerId];
                  const focused = focusProspect === prospect.playerId;
                  return (
                    <div
                      key={prospect.playerId}
                      className={
                        focused
                          ? "rounded-lg ring-1 ring-amber-600/60"
                          : undefined
                      }
                    >
                      <ProspectCard
                        playerId={prospect.playerId}
                        firstName={prospect.player.firstName}
                        lastName={prospect.player.lastName}
                        position={
                          estimate?.positionEstimate ?? prospect.player.position
                        }
                        age={prospect.player.age}
                        nationality={`${prospect.player.nationality} (${region})`}
                        scoutGrade={report.scoutGrade}
                        estimatedOverallMin={
                          report.estimatedOverall?.min ?? null
                        }
                        estimatedOverallMax={
                          report.estimatedOverall?.max ?? null
                        }
                        confidence={report.confidence}
                        strengths={report.strengths.map((s) => s.label)}
                        weaknesses={report.weaknesses.map((w) => w.label)}
                      />
                      <div className="mt-1 flex flex-wrap gap-2 px-1 pb-2">
                        <form action={assignScoutAction}>
                          <input type="hidden" name="saveId" value={saveId} />
                          <input
                            type="hidden"
                            name="prospectPlayerId"
                            value={prospect.playerId}
                          />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={returnPath}
                          />
                          <button
                            type="submit"
                            className="text-xs text-amber-400 hover:underline"
                          >
                            Assign scout
                          </button>
                        </form>
                        <form action={interviewProspectAction}>
                          <input type="hidden" name="saveId" value={saveId} />
                          <input
                            type="hidden"
                            name="prospectPlayerId"
                            value={prospect.playerId}
                          />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={returnPath}
                          />
                          <button
                            type="submit"
                            className="text-xs text-zinc-400 hover:underline"
                          >
                            {interview ? "Re-interview" : "Interview"}
                          </button>
                        </form>
                      </div>
                      {interview ? (
                        <ul className="space-y-1 px-3 pb-3 text-xs italic text-zinc-500">
                          {interview.answers.slice(0, 2).map((a) => (
                            <li key={a.topic}>&ldquo;{a.quote}&rdquo;</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </Section>
        </>
      )}
    </>
  );
}

function CoverageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </div>
      <div className="text-zinc-100">{value}</div>
    </div>
  );
}
