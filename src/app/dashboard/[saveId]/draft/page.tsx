import type { Metadata } from "next";
import { rowLinkClass } from "@/components/league/row-link-class";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { notFound } from "next/navigation";
import {
  addDraftBoardAction,
  draftProspectAction,
  removeDraftBoardAction,
  toggleDraftBoardPriorityAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { DraftClassDecisionPanel } from "@/components/draft/DraftClassDecisionPanel";
import { DraftBoardPanel } from "@/components/draft/DraftBoardPanel";
import { DraftHeaderStrip } from "@/components/draft/DraftHeaderStrip";
import { DraftPickSummary } from "@/components/draft/DraftPickSummary";
import { PostDraftDevelopmentReview } from "@/components/draft/PostDraftDevelopmentReview";
import { ProspectCard } from "@/components/draft/ProspectCard";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { draftClassIdFor } from "@/domain/entities/draft";
import { getActivePhaseId } from "@/systems/phase-engine/resolve-current-phase";
import { getRequestSaveStore } from "@/application/request-save-store";
import { toDraftHubView } from "@/state/draft-hub-selectors";
import { toDraftLotteryView } from "@/state/draft-lottery-selectors";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import {
  calculateTeamDraftNeeds,
  draftYearForSeason,
  ensureMockDrafts,
  getDraftRecommendations,
} from "@/systems/draft";
import { buildPostDraftDlRecommendations } from "@/systems/development-league/recommendations";
import { prospectFunFact } from "@/systems/draft/prospect-fun-facts";
import { toScoutingReportView } from "@/systems/scouting/scouting-reports";

export const metadata: Metadata = { title: "Draft" };

type DraftPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; resumeTo?: string }>;
};

export default async function DraftPage({
  params,
  searchParams,
}: DraftPageProps) {
  const { saveId } = await params;
  const { error, resumeTo } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/draft`;
  const pickReturnPath = resumeTo
    ? `/dashboard/${saveId}/calendar?resumeTo=${encodeURIComponent(resumeTo)}`
    : returnPath;
  const board = view.draftBoard;
  const loaded = await getRequestSaveStore().load(saveId);
  const state = loaded?.state;
  const hub = state ? toDraftHubView(state) : null;
  const hasLottery = state ? toDraftLotteryView(state) !== null : false;
  const teamId = state?.user.activeOwnerTeamId;
  const draftYear = state
    ? draftYearForSeason(state.competition.season.year)
    : null;
  const draft =
    state && draftYear
      ? state.world.drafts[draftClassIdFor(draftYear)]
      : undefined;
  const awaitingDraftClassDecision = Boolean(
    state &&
    draftYear &&
    !draft &&
    (getActivePhaseId(state) === "offseason.draft_preparation" ||
      getActivePhaseId(state) === "offseason.draft") &&
    state.user.pendingDraftClassDecisions[String(draftYear)]?.resolved !== true,
  );

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
  const mockByProspect = new Map<
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
        position:
          estimate?.positionEstimate ?? prospect?.player.position ?? "?",
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
            : (hub?.inactiveReason ??
              "Draft board available during offseason draft stage")
        }
        actions={
          hasLottery ? (
            <Link
              href={`/dashboard/${saveId}/draft/lottery`}
              className={buttonClass({ variant: "secondary" })}
            >
              Lottery night
            </Link>
          ) : undefined
        }
      />
      {error ? <ErrorState message={error} /> : null}

      {hub ? <DraftHeaderStrip view={hub} /> : null}

      {awaitingDraftClassDecision && state && draftYear ? (
        <DraftClassDecisionPanel
          saveId={saveId}
          draftYear={draftYear}
          seasonYear={state.competition.season.year}
          returnPath={returnPath}
        />
      ) : null}

      {awaitingDraftClassDecision ? null : !board ||
        !state ||
        !draft ||
        !teamId ? (
        <EmptyState
          message={
            hub?.inactiveReason ??
            "Draft is not active. Use the Calendar to advance into the draft stage."
          }
        />
      ) : (
        <>
          <Section title="Pick order">
            <DraftPickSummary saveId={saveId} picks={hub?.picks ?? []} />
          </Section>
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
            <p className="mb-4 rounded-md border border-team-ink/50 bg-team/15 px-4 py-3 text-sm text-ink">
              Your team is on the clock. Select a prospect below.
            </p>
          ) : (
            <p className="mb-4 text-sm text-faint">
              Waiting for other teams (or advance after AI fills).
            </p>
          )}

          <div className="grid gap-6 xl:grid-cols-[240px_1fr_280px]">
            <aside className="space-y-4">
              <Section title="Draft order">
                <ul className="max-h-[28rem] space-y-1 overflow-y-auto text-sm">
                  {board.order.map((slot) => (
                    <li
                      key={slot.draftPickId}
                      className={`flex items-center gap-2 rounded px-2 py-1 ${
                        slot.isUserPick ? "bg-team/15" : ""
                      }`}
                    >
                      <span className="tabular-nums text-muted">
                        #{slot.overallPick}
                      </span>
                      {slot.ownerBranding ? (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded border border-line-strong"
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
                      <TeamEntityLink
                        saveId={saveId}
                        teamId={slot.ownerTeamId}
                        className="text-soft hover:underline"
                      >
                        {slot.ownerAbbreviation}
                      </TeamEntityLink>
                      <StatusBadge label={slot.status} />
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Selections">
                {board.selections.length === 0 ? (
                  <p className="text-sm text-faint">None yet.</p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-soft">
                    {board.selections.map((selection) => (
                      <li
                        key={`${selection.overallPick}-${selection.playerId}`}
                      >
                        #{selection.overallPick} {selection.teamAbbreviation}:{" "}
                        <PlayerEntityLink
                          saveId={saveId}
                          playerId={selection.playerId}
                          className={rowLinkClass}
                        >
                          {selection.playerName}
                        </PlayerEntityLink>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </aside>

            <div className="space-y-4">
              <Section title="Prospect pool">
                {!board.userOnClock ? (
                  <EmptyState message="Selection unlocks when you are on the clock. You can still scout and build your board." />
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  {board.eligibleProspects.slice(0, 24).map((prospect) => {
                    const full = draft.prospects[prospect.playerId];
                    const estimate = draft.teamDraftState[
                      teamId
                    ]?.scouting.find(
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
                          saveId={saveId}
                          playerId={prospect.playerId}
                          portrait={selectPlayerPortrait(
                            state,
                            prospect.playerId,
                          )}
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
                                value={pickReturnPath}
                              />
                              {resumeTo ? (
                                <input
                                  type="hidden"
                                  name="resumeTo"
                                  value={resumeTo}
                                />
                              ) : null}
                              <button
                                type="submit"
                                className={cn(
                                  linkClass,
                                  touchTargetTextClass,
                                  focusRingClass,
                                  "text-sm font-medium",
                                )}
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
                              className={cn(
                                touchTargetTextClass,
                                focusRingClass,
                                "text-sm text-muted hover:underline",
                              )}
                            >
                              {onBoard ? "On board" : "Add to board"}
                            </button>
                          </form>
                        </div>
                        {mock?.availability ? (
                          <p className="px-1 text-sm text-muted">
                            {mock.availability}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>

            <aside className="space-y-4">
              <Section title="Team needs">
                {needs ? (
                  <ul className="space-y-1 text-sm">
                    {needs.byPosition
                      .filter((n) => n.level !== "none")
                      .map((n) => (
                        <li
                          key={n.position}
                          className="flex justify-between text-soft"
                        >
                          <span>{n.position}</span>
                          <span className="capitalize text-team-ink/90">
                            {n.level}
                          </span>
                        </li>
                      ))}
                    {needs.priorityPositions.length === 0 ? (
                      <li className="text-faint">No major positional needs.</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="text-sm text-faint">Unavailable.</p>
                )}
              </Section>

              <Section title="Recommended">
                {recommendations.length === 0 ? (
                  <p className="text-sm text-faint">
                    Scout prospects to unlock recommendations.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {recommendations.map((rec, index) => (
                      <li
                        key={rec.prospectPlayerId}
                        className="rounded-md border border-line p-2"
                      >
                        <div className="font-medium text-ink">
                          {index === 0 ? "Top pick · " : ""}
                          {rec.playerName}
                        </div>
                        <p className="text-sm text-faint">
                          {rec.position} · Grade {rec.scoutGrade} · Fit{" "}
                          {rec.teamFit} · Need {rec.teamNeed}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm text-muted">
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
