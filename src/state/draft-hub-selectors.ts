/**
 * Draft Hub presentation — composes toDraftBoardView and draft domain helpers.
 * Never exposes true overall/potential; scouting estimates only.
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toDraftBoardView,
  type DraftBoardView,
} from "@/state/selectors";
import { getExpectedPhaseWindow } from "@/systems/league-rules/league-calendar";
import {
  calculateTeamDraftNeeds,
  draftYearForSeason,
  getDraftRecommendations,
} from "@/systems/draft";
import type { TeamDraftNeeds } from "@/systems/draft/draft-needs";
import type { DraftRecommendation } from "@/systems/draft/draft-recommendations";
import { draftClassIdFor } from "@/domain/entities/draft";
import { isOffseasonPeriod } from "@/state/owner-season-context";

export type DraftPickSummaryRow = {
  draftPickId: string;
  overallPick: number;
  round: number;
  ownerTeamId: string;
  ownerAbbreviation: string;
  status: string;
  selectedPlayerId: string | null;
  selectedPlayerName: string | null;
  isUserPick: boolean;
};

export type DraftProspectRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number | null;
  scoutGrade: string | null;
  estimatedOverallMin: number | null;
  estimatedOverallMax: number | null;
  /** Always null — true OVR is never exposed on draft hub. */
  trueOverall: null;
  confidence: string | null;
  knowledgeLevel: string;
  projectedRankMin: number | null;
  projectedRankMax: number | null;
  status: string;
};

export type DraftHubView = {
  active: boolean;
  inactiveReason: string | null;
  saveId: string;
  draftYear: number | null;
  draftDate: string | null;
  status: string | null;
  userOnClock: boolean;
  onClockOverall: number | null;
  ownedPickCount: number;
  rosterCount: number;
  board: DraftBoardView | null;
  picks: DraftPickSummaryRow[];
  prospects: DraftProspectRow[];
  needs: TeamDraftNeeds | null;
  recommendations: DraftRecommendation[];
  canSelect: boolean;
};

export function toDraftHubView(state: GameState): DraftHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftWindow = getExpectedPhaseWindow(state, "offseason.draft");
  const board = toDraftBoardView(state);
  const draft = state.world.drafts[draftClassIdFor(draftYear)];

  const offseason = isOffseasonPeriod(state);
  const stage = state.competition.season.offseasonStage;
  let inactiveReason: string | null = null;
  if (!offseason) {
    inactiveReason =
      "Draft is available during the offseason draft stage. Use the Calendar to advance.";
  } else if (stage !== "draft" && stage !== "draft_preparation") {
    inactiveReason = `Draft board unlocks during draft preparation / draft (current stage: ${stage.replaceAll("_", " ")}).`;
  } else if (!draft) {
    inactiveReason = "No draft class is loaded for this season.";
  } else if (!board && stage === "draft_preparation") {
    inactiveReason =
      "Draft preparation is underway. Advance to the draft stage on the Calendar to open the board.";
  }

  const picks: DraftPickSummaryRow[] = (board?.order ?? []).map((slot) => {
    const selection = board?.selections.find(
      (s) => s.overallPick === slot.overallPick,
    );
    return {
      draftPickId: slot.draftPickId,
      overallPick: slot.overallPick,
      round: slot.round,
      ownerTeamId: slot.ownerTeamId,
      ownerAbbreviation: slot.ownerAbbreviation,
      status: slot.status,
      selectedPlayerId: slot.selectedPlayerId ?? selection?.playerId ?? null,
      selectedPlayerName: selection?.playerName ?? null,
      isUserPick: slot.isUserPick,
    };
  });

  const prospects: DraftProspectRow[] = (board?.eligibleProspects ?? []).map(
    (p) => {
      const full = draft?.prospects[p.playerId];
      return {
        playerId: p.playerId,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        age: full?.player.age ?? null,
        scoutGrade: p.scoutGrade,
        estimatedOverallMin: p.estimatedOverallMin,
        estimatedOverallMax: p.estimatedOverallMax,
        trueOverall: null,
        confidence: p.confidence,
        knowledgeLevel: p.knowledgeLevel,
        projectedRankMin: p.projectedRankMin,
        projectedRankMax: p.projectedRankMax,
        status: full?.status ?? "available",
      };
    },
  );

  const needs =
    draft && board ? calculateTeamDraftNeeds(state, teamId) : null;
  const recommendations =
    draft && board
      ? getDraftRecommendations(state, draft, teamId, 3)
      : [];

  return {
    active: board !== null,
    inactiveReason: board ? null : inactiveReason,
    saveId,
    draftYear,
    draftDate: draftWindow?.start ?? null,
    status: board?.status ?? draft?.status ?? null,
    userOnClock: board?.userOnClock ?? false,
    onClockOverall: board?.onClockOverall ?? null,
    ownedPickCount: board?.ownedPicks.length ?? 0,
    rosterCount: team?.roster.length ?? 0,
    board,
    picks,
    prospects,
    needs,
    recommendations,
    canSelect: board?.userOnClock === true,
  };
}

/** Assert draft hub never surfaces a true overall number. */
export function draftHubExposesTrueOverall(hub: DraftHubView): boolean {
  return hub.prospects.some((p) => p.trueOverall !== null);
}
