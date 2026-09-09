/**
 * Scouting Hub presentation — who needs attention next.
 * Composes draft teamDraftState scouting data; no invented recommendations.
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";
import { getScoutingCoverageSummary } from "@/systems/scouting";
import { resolveScoutingRegion } from "@/domain/entities/scouting-regions";
import { isOffseasonPeriod } from "@/state/owner-season-context";

export type ScoutingProspectRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  region: string;
  knowledgeLevel: string;
  scoutGrade: string | null;
  estimatedOverallMin: number | null;
  estimatedOverallMax: number | null;
  confidence: string | null;
  hasAssignment: boolean;
  hasInterview: boolean;
  needsAttention: boolean;
  exposure: number;
};

export type ScoutingHubView = {
  active: boolean;
  inactiveReason: string | null;
  saveId: string;
  draftYear: number | null;
  coverage: {
    domestic: number;
    international: number;
    discovered: number;
    needsMoreScouting: number;
    assignments: number;
  };
  needsAttention: ScoutingProspectRow[];
  prospects: ScoutingProspectRow[];
  positions: string[];
};

export function toScoutingHubView(state: GameState): ScoutingHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draft = state.world.drafts[draftClassIdFor(draftYear)];
  const coverage = getScoutingCoverageSummary(state, teamId);
  const leagueArea = state.settings.league.area ?? "north_america";

  const offseason = isOffseasonPeriod(state);
  const stage = state.competition.season.offseasonStage;
  const stageOk =
    stage === "draft" ||
    stage === "draft_preparation" ||
    stage === "free_agency";

  let inactiveReason: string | null = null;
  if (!offseason) {
    inactiveReason =
      "Scouting is available during the offseason. Use the Calendar to advance.";
  } else if (!draft || draft.status === "complete") {
    inactiveReason =
      "Scouting is available during draft preparation and the draft.";
  } else if (!stageOk) {
    inactiveReason = `Scouting unlocks during draft preparation (current stage: ${stage.replaceAll("_", " ")}).`;
  }

  const active =
    Boolean(draft) && draft!.status !== "complete" && (offseason || stageOk);

  const teamState = draft?.teamDraftState[teamId];
  const assignmentIds = new Set(
    (teamState?.scoutAssignments ?? []).map((a) => a.prospectPlayerId),
  );

  const prospects: ScoutingProspectRow[] = Object.values(draft?.prospects ?? {})
    .filter((p) => p.status === "eligible")
    .map((prospect) => {
      const estimate = teamState?.scouting.find(
        (s) => s.prospectPlayerId === prospect.playerId,
      );
      const hasAssignment = assignmentIds.has(prospect.playerId);
      const hasInterview = Boolean(
        teamState?.interviews?.[prospect.playerId],
      );
      const knowledgeLevel = estimate?.knowledgeLevel ?? "unknown";
      const exposure = estimate?.effectiveExposure ?? estimate?.exposure ?? 0;
      const needsAttention =
        !hasAssignment ||
        knowledgeLevel === "unknown" ||
        knowledgeLevel === "basic" ||
        exposure < 0.35;

      return {
        playerId: prospect.playerId,
        firstName: prospect.player.firstName,
        lastName: prospect.player.lastName,
        position: estimate?.positionEstimate ?? prospect.player.position,
        age: prospect.player.age,
        region: resolveScoutingRegion(
          leagueArea,
          prospect.player.nationality,
        ),
        knowledgeLevel,
        scoutGrade: estimate?.scoutGrade ?? null,
        estimatedOverallMin: estimate?.estimatedOverall.min ?? null,
        estimatedOverallMax: estimate?.estimatedOverall.max ?? null,
        confidence: estimate?.confidence ?? null,
        hasAssignment,
        hasInterview,
        needsAttention,
        exposure,
      };
    })
    .sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) {
        return a.needsAttention ? -1 : 1;
      }
      return a.lastName.localeCompare(b.lastName);
    });

  const needsAttention = prospects.filter((p) => p.needsAttention);
  const positions = [...new Set(prospects.map((p) => p.position))].sort();

  return {
    active,
    inactiveReason: active ? null : inactiveReason,
    saveId,
    draftYear,
    coverage,
    needsAttention,
    prospects,
    positions,
  };
}
