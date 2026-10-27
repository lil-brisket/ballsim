import type { Metadata } from "next";
import { rowLinkClass } from "@/components/league/row-link-class";
import { buttonClass } from "@/components/ui/Button";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { notFound } from "next/navigation";
import {
  assignScoutAction,
  interviewProspectAction,
  scoutRegionAction,
} from "@/application/actions";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";
import { resolveScoutingRegion } from "@/domain/entities/scouting-regions";
import { toScoutingReportView } from "@/systems/scouting/scouting-reports";
import { ProspectCard } from "@/components/draft/ProspectCard";
import { getRequestSaveStore } from "@/application/request-save-store";
import { toScoutingHubView } from "@/state/scouting-hub-selectors";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";

export const metadata: Metadata = { title: "Scouting" };

type Props = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; prospect?: string }>;
};

export default async function ScoutingPage({ params, searchParams }: Props) {
  const { saveId } = await params;
  const { error, prospect: focusProspect } = await searchParams;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) notFound();
  const state = loaded.state;
  const hub = toScoutingHubView(state);
  const teamId = state.user.activeOwnerTeamId;
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draft = state.world.drafts[draftClassIdFor(draftYear)];
  const returnPath = `/dashboard/${saveId}/scouting`;
  const leagueArea = state.settings.league.area ?? "north_america";

  return (
    <div className="space-y-4">
      <PageHeader title="Scouting" />
      {error ? <ErrorState message={error} /> : null}

      {!hub.active || !draft ? (
        <EmptyState
          message={
            hub.inactiveReason ??
            "Scouting is available during draft preparation and the draft."
          }
        />
      ) : (
        <>
          <Section title="Coverage">
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <CoverageStat
                label="Domestic"
                value={`${Math.round(hub.coverage.domestic * 100)}%`}
              />
              <CoverageStat
                label="International"
                value={`${Math.round(hub.coverage.international * 100)}%`}
              />
              <CoverageStat
                label="Discovered"
                value={String(hub.coverage.discovered)}
              />
              <CoverageStat
                label="Need more scouting"
                value={String(hub.coverage.needsMoreScouting)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <form action={scoutRegionAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="region" value="domestic" />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className={buttonClass({ variant: "secondary" })}
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
                  className={buttonClass({ variant: "secondary" })}
                >
                  Scout international region
                </button>
              </form>
            </div>
            <p className="mt-2 text-sm text-faint">
              Active assignments: {hub.coverage.assignments}. Exposure improves
              when you advance days on the Calendar during draft prep.
            </p>
          </Section>

          <Section title="Prospects needing attention">
            {hub.needsAttention.length === 0 ? (
              <EmptyState message="No prospects currently need more scouting." />
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {hub.needsAttention.slice(0, 12).map((row) => (
                  <li
                    key={row.playerId}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                  >
                    <div>
                      <PlayerEntityLink
                        saveId={saveId}
                        playerId={row.playerId}
                        className={rowLinkClass}
                      >
                        {row.firstName} {row.lastName}
                      </PlayerEntityLink>
                      <p className="text-sm text-faint">
                        {row.position} · Age {row.age} · {row.region} ·{" "}
                        {row.knowledgeLevel}
                      </p>
                    </div>
                    <StatusBadge label="Needs attention" tone="warning" />
                  </li>
                ))}
              </ul>
            )}
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
                          ? "rounded-lg ring-1 ring-team-ink/60"
                          : undefined
                      }
                    >
                      <ProspectCard
                        saveId={saveId}
                        playerId={prospect.playerId}
                        portrait={selectPlayerPortrait(
                          state,
                          prospect.playerId,
                        )}
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
                            className={cn(
                              linkClass,
                              touchTargetTextClass,
                              focusRingClass,
                              "text-sm",
                            )}
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
                            className={cn(
                              touchTargetTextClass,
                              focusRingClass,
                              "text-sm text-muted hover:underline",
                            )}
                          >
                            {interview ? "Re-interview" : "Interview"}
                          </button>
                        </form>
                      </div>
                      {interview ? (
                        <ul className="space-y-1 px-3 pb-3 text-sm italic text-faint">
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
    </div>
  );
}

function CoverageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="text-sm text-muted">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
