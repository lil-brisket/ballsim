import { notFound } from "next/navigation";
import {
  addDraftBoardAction,
  draftProspectAction,
  removeDraftBoardAction,
  toggleDraftBoardPriorityAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { DraftBoardPanel } from "@/components/draft/DraftBoardPanel";
import { PostDraftDevelopmentReview } from "@/components/draft/PostDraftDevelopmentReview";
import { ProspectCard } from "@/components/draft/ProspectCard";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { draftClassIdFor } from "@/domain/entities/draft";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import {
  calculateTeamDraftNeeds,
  draftYearForSeason,
  ensureMockDrafts,
  getDraftRecommendations,
} from "@/systems/draft";
import { buildPostDraftDlRecommendations } from "@/systems/development-league/recommendations";
import { prospectFunFact } from "@/systems/draft/prospect-fun-facts";
import { toScoutingReportView } from "@/systems/scouting/scouting-reports";

type DraftPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function DraftPage({
  params,
  searchParams,
}: DraftPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/draft`;
  const board = view.draftBoard;
  const loaded = await prismaSaveGameStore.load(saveId);
  const state = loaded?.state;
  const teamId = state?.user.activeOwnerTeamId;
  const draftYear = state
    ? draftYearForSeason(state.competition.season.year)
    : null;
  const draft =
    state && draftYear
      ? state.world.drafts[draftClassIdFor(draftYear)]
      : undefined;

  let recommendations: ReturnType<typeof getDraftRecommendations> = [];
  let needs: ReturnType<typeof calculateTeamDraftNeeds> | null = null;
  let boardEntries: Array<{
    prospectPlayerId: string;
    name: string;
    position: string;
    rank: number;
    priority: boolean;
    notes: string;
    scoutGrade: string | null;
  }> = [];
  let mockByProspect = new Map<
    string,
    { projected: number; previous: number | null; availability: string }
  >();

  if (state && draft && teamId) {
    const ensured = ensureMockDrafts(state, draft);
    const liveDraft = ensured.draft;
    recommendations = getDraftRecommendations(state, liveDraft, teamId, 3);
    needs = calculateTeamDraftNeeds(state, teamId);
    const teamState = liveDraft.teamDraftState[teamId];
    const leagueArea = state.settings.league.area ?? "north_america";
    boardEntries = (teamState?.board ?? []).map((entry) => {
      const prospect = liveDraft.prospects[entry.prospectPlayerId];
      const estimate = teamState?.scouting.find(
        (s) => s.prospectPlayerId === entry.prospectPlayerId,
      );
      return {
        prospectPlayerId: entry.prospectPlayerId,
        name: prospect
          ? `${prospect.player.firstName} ${prospect.player.lastName}`
          : entry.prospectPlayerId,
        position: estimate?.positionEstimate ?? prospect?.player.position ?? "?",
        rank: entry.rank,
        priority: entry.priority,
        notes: entry.notes,
        scoutGrade: estimate?.scoutGrade ?? null,
      };
    });
    for (const row of teamState?.teamMockDraftView?.projectedPicks ?? []) {
      mockByProspect.set(row.prospectPlayerId, {
        projected: row.projectedOverallPick,
        previous: row.previousProjectedOverallPick,
        availability: row.availabilityLabel,
      });
    }
    void leagueArea;
  }

  return (
    <>
      <PageHeader
        title="Draft"
        subtitle={
          board
            ? `${board.status}${board.onClockOverall !== null ? ` · pick ${board.onClockOverall}` : ""}`
            : "Draft board available during offseason draft stage"
        }
      />
      {error ? <ErrorState message={error} /> : null}

      {!board || !state || !draft || !teamId ? (
        <EmptyState message="Draft is not active. Finish free agency or advance into the draft stage." />
      ) : (
        <>
          {draft.status === "complete" ? (
            <div className="mb-6">
              <PostDraftDevelopmentReview
                saveId={saveId}
                returnPath={returnPath}
                review={buildPostDraftDlRecommendations(
                  state,
                  teamId,
                  draft.pickResults
                    .filter((p) => p.teamId === teamId)
                    .map((p) => p.playerId),
                )}
              />
            </div>
          ) : null}
          {board.userOnClock ? (
            <p className="mb-4 rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
              Your team is on the clock. Select a prospect below.
            </p>
          ) : (
            <p className="mb-4 text-sm text-zinc-500">
              Waiting for other teams (or advance after AI fills).
            </p>
          )}

          <div className="grid gap-6 xl:grid-cols-[240px_1fr_280px]">
            <aside className="space-y-4">
              <Section title="Draft order">
                <ul className="max-h-[28rem] space-y-1 overflow-y-auto text-xs">
                  {board.order.map((slot) => (
                    <li
                      key={slot.draftPickId}
                      className={`flex items-center gap-2 rounded px-2 py-1 ${
                        slot.isUserPick ? "bg-amber-950/30" : ""
                      }`}
                    >
                      <span className="font-mono text-zinc-400">
                        #{slot.overallPick}
                      </span>
                      {slot.ownerBranding ? (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded border border-zinc-700"
                          style={{
                            backgroundColor: slot.ownerBranding.primaryColor,
                          }}
                        >
                          <TeamLogoMark
                            branding={slot.ownerBranding}
                            size="sm"
                            decorative
                          />
                        </span>
                      ) : null}
                      <span className="text-zinc-300">
                        {slot.ownerAbbreviation}
                      </span>
                      <StatusBadge label={slot.status} />
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Selections">
                {board.selections.length === 0 ? (
                  <p className="text-xs text-zinc-500">None yet.</p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-zinc-300">
                    {board.selections.map((selection) => (
                      <li key={`${selection.overallPick}-${selection.playerId}`}>
                        #{selection.overallPick} {selection.teamAbbreviation}:{" "}
                        {selection.playerName}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </aside>

            <main className="space-y-4">
              <Section title="Prospect pool">
                {!board.userOnClock ? (
                  <EmptyState message="Selection unlocks when you are on the clock. You can still scout and build your board." />
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  {board.eligibleProspects.slice(0, 24).map((prospect) => {
                    const full = draft.prospects[prospect.playerId];
                    const estimate = draft.teamDraftState[teamId]?.scouting.find(
                      (s) => s.prospectPlayerId === prospect.playerId,
                    );
                    const report = toScoutingReportView(estimate);
                    const mock = mockByProspect.get(prospect.playerId);
                    const funFact = full
                      ? prospectFunFact(
                          full,
                          state.settings.league.area ?? "north_america",
                        )
                      : null;
                    const onBoard = boardEntries.some(
                      (e) => e.prospectPlayerId === prospect.playerId,
                    );
                    return (
                      <div key={prospect.playerId}>
                        <ProspectCard
                          playerId={prospect.playerId}
                          firstName={prospect.firstName}
                          lastName={prospect.lastName}
                          position={prospect.position}
                          age={full?.player.age}
                          nationality={full?.player.nationality}
                          scoutGrade={prospect.scoutGrade}
                          estimatedOverallMin={prospect.estimatedOverallMin}
                          estimatedOverallMax={prospect.estimatedOverallMax}
                          confidence={prospect.confidence}
                          projectedPick={mock?.projected}
                          previousProjectedPick={mock?.previous}
                          funFact={funFact}
                          strengths={report.strengths.map((s) => s.label)}
                          weaknesses={report.weaknesses.map((w) => w.label)}
                          onBoard={onBoard}
                        />
                        <div className="mt-1 flex flex-wrap gap-2 px-1">
                          {board.userOnClock ? (
                            <form action={draftProspectAction}>
                              <input
                                type="hidden"
                                name="saveId"
                                value={saveId}
                              />
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
                                className="text-xs font-medium text-amber-400 hover:underline"
                              >
                                Draft
                              </button>
                            </form>
                          ) : null}
                          <form action={addDraftBoardAction}>
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
                              {onBoard ? "On board" : "Add to board"}
                            </button>
                          </form>
                        </div>
                        {mock?.availability ? (
                          <p className="px-1 text-[10px] text-zinc-600">
                            {mock.availability}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Section>
            </main>

            <aside className="space-y-4">
              <Section title="Team needs">
                {needs ? (
                  <ul className="space-y-1 text-xs">
                    {needs.byPosition
                      .filter((n) => n.level !== "none")
                      .map((n) => (
                        <li
                          key={n.position}
                          className="flex justify-between text-zinc-300"
                        >
                          <span>{n.position}</span>
                          <span className="capitalize text-amber-400/90">
                            {n.level}
                          </span>
                        </li>
                      ))}
                    {needs.priorityPositions.length === 0 ? (
                      <li className="text-zinc-500">No major positional needs.</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">Unavailable.</p>
                )}
              </Section>

              <Section title="Recommended">
                {recommendations.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Scout prospects to unlock recommendations.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {recommendations.map((rec, index) => (
                      <li
                        key={rec.prospectPlayerId}
                        className="rounded-md border border-zinc-800 p-2"
                      >
                        <div className="font-medium text-zinc-100">
                          {index === 0 ? "Top pick · " : ""}
                          {rec.playerName}
                        </div>
                        <p className="text-xs text-zinc-500">
                          {rec.position} · Grade {rec.scoutGrade} · Fit{" "}
                          {rec.teamFit} · Need {rec.teamNeed}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-zinc-400">
                          {rec.reasons.slice(0, 2).map((r) => (
                            <li key={r}>• {r}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Draft board">
                <DraftBoardPanel
                  saveId={saveId}
                  entries={boardEntries}
                  removeAction={removeDraftBoardAction}
                  togglePriorityAction={toggleDraftBoardPriorityAction}
                />
              </Section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
