/**
 * Time-based scouting progression: assignments, day advance, region coverage.
 */

import type { DraftClass, TeamDraftState } from "@/domain/entities/draft";
import { createEmptyTeamDraftState } from "@/domain/entities/draft";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import type { ScoutingRegion } from "@/domain/entities/scouting-types";
import { resolveScoutingRegion } from "@/domain/entities/scouting-regions";
import type { GameState } from "@/state/game-state";
import {
  buildScoutEvaluationContext,
  evaluateProspectForTeam,
} from "@/systems/scouting/scouting-accuracy";
import {
  scoutQualityMultiplier,
  scoutSpeedMultiplier,
} from "@/systems/staff-effects/scout-effects";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft/draft-order";

const MAX_ASSIGNMENTS_PER_TEAM = 3;
const REGION_COVERAGE_STEP = 0.12;
const REGION_COVERAGE_MAX = 1.75;

export function getActiveOrPrepDraft(state: GameState): DraftClass | null {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draft = state.world.drafts[draftClassIdFor(draftYear)];
  if (!draft) return null;
  if (draft.status === "complete") return null;
  return draft;
}

export function assignScoutToProspect(
  state: GameState,
  teamId: TeamId,
  prospectPlayerId: PlayerId,
): GameState {
  const draft = getActiveOrPrepDraft(state);
  if (!draft) return state;
  const prospect = draft.prospects[prospectPlayerId];
  if (!prospect || prospect.status !== "eligible") return state;

  const existing =
    draft.teamDraftState[teamId] ?? createEmptyTeamDraftState();
  const filtered = existing.scoutAssignments.filter(
    (a) => a.prospectPlayerId !== prospectPlayerId,
  );
  if (filtered.length >= MAX_ASSIGNMENTS_PER_TEAM) {
    filtered.shift();
  }
  const exposurePerDay =
    0.85 * scoutSpeedMultiplier(state, teamId) * scoutQualityMultiplier(state, teamId);
  const nextTeamState: TeamDraftState = {
    ...existing,
    scoutAssignments: [
      ...filtered,
      {
        prospectPlayerId,
        assignedOn: state.world.calendar.currentDate,
        exposurePerDay,
      },
    ],
  };

  return withTeamDraftState(state, draft.id, teamId, nextTeamState);
}

/**
 * Improve domestic or international coverage for a team.
 */
export function scoutRegionCoverage(
  state: GameState,
  teamId: TeamId,
  region: ScoutingRegion,
): GameState {
  const draft = getActiveOrPrepDraft(state);
  if (!draft) return state;
  const existing =
    draft.teamDraftState[teamId] ?? createEmptyTeamDraftState();
  const nextCoverage = { ...existing.regionCoverage };
  nextCoverage[region] = Math.min(
    REGION_COVERAGE_MAX,
    nextCoverage[region] + REGION_COVERAGE_STEP,
  );
  return withTeamDraftState(state, draft.id, teamId, {
    ...existing,
    regionCoverage: nextCoverage,
  });
}

/**
 * Advance exposure for all teams' scout assignments by one day.
 * Re-evaluates estimates for assigned prospects (consumes RNG).
 */
export function advanceScoutAssignments(
  state: GameState,
  rng: Rng,
): GameState {
  const draft = getActiveOrPrepDraft(state);
  if (!draft) return state;

  let nextDraft = draft;
  const classSize = Object.keys(draft.prospects).length;
  const teamIds = Object.keys(draft.teamDraftState).sort();

  // Also advance for teams that have assignments but ensure all teams exist
  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    const teamState =
      nextDraft.teamDraftState[teamId] ?? createEmptyTeamDraftState();
    if (teamState.scoutAssignments.length === 0) {
      if (!nextDraft.teamDraftState[teamId]) {
        nextDraft = {
          ...nextDraft,
          teamDraftState: {
            ...nextDraft.teamDraftState,
            [teamId]: teamState,
          },
        };
      }
      continue;
    }

    let scouting = [...teamState.scouting];
    for (const assignment of teamState.scoutAssignments) {
      const prospect = nextDraft.prospects[assignment.prospectPlayerId];
      if (!prospect || prospect.status !== "eligible") continue;
      const existingIdx = scouting.findIndex(
        (s) => s.prospectPlayerId === assignment.prospectPlayerId,
      );
      const priorExposure =
        existingIdx >= 0 ? scouting[existingIdx]!.exposure : 0;
      const exposure = priorExposure + assignment.exposurePerDay;
      const ctx = buildScoutEvaluationContext(
        state,
        teamId,
        prospect,
        exposure,
        teamState.regionCoverage,
        classSize,
      );
      const updated = evaluateProspectForTeam(state, prospect, ctx, rng);
      // Preserve movement if projected midpoint changed meaningfully
      if (existingIdx >= 0) {
        const prev = scouting[existingIdx]!;
        const prevMid = Math.round(
          (prev.projectedRank.min + prev.projectedRank.max) / 2,
        );
        const nextMid = Math.round(
          (updated.projectedRank.min + updated.projectedRank.max) / 2,
        );
        if (prevMid !== nextMid) {
          updated.movement = {
            previousProjectedPick: prevMid,
            currentProjectedPick: nextMid,
            delta: prevMid - nextMid,
            reasons: ["Additional scouting"],
          };
        }
        scouting[existingIdx] = updated;
      } else {
        scouting.push(updated);
      }
    }

    nextDraft = {
      ...nextDraft,
      teamDraftState: {
        ...nextDraft.teamDraftState,
        [teamId]: { ...teamState, scouting },
      },
    };
  }

  if (nextDraft === draft) return state;
  return {
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [draft.id]: nextDraft,
      },
    },
  };
}

export function getScoutingCoverageSummary(
  state: GameState,
  teamId: TeamId,
): {
  domestic: number;
  international: number;
  discovered: number;
  needsMoreScouting: number;
  assignments: number;
} {
  const draft = getActiveOrPrepDraft(state);
  if (!draft) {
    return {
      domestic: 1,
      international: 1,
      discovered: 0,
      needsMoreScouting: 0,
      assignments: 0,
    };
  }
  const teamState =
    draft.teamDraftState[teamId] ?? createEmptyTeamDraftState();
  const leagueArea = state.settings.league.area ?? "north_america";
  let discovered = 0;
  let needsMoreScouting = 0;
  for (const estimate of teamState.scouting) {
    if (estimate.knowledgeLevel !== "unknown") discovered += 1;
    if (
      estimate.knowledgeLevel === "basic" ||
      estimate.knowledgeLevel === "developing"
    ) {
      needsMoreScouting += 1;
    }
  }
  // Touch region resolver for domestic/intl split awareness
  void resolveScoutingRegion;
  void leagueArea;
  return {
    domestic: teamState.regionCoverage.domestic,
    international: teamState.regionCoverage.international,
    discovered,
    needsMoreScouting,
    assignments: teamState.scoutAssignments.length,
  };
}

function withTeamDraftState(
  state: GameState,
  draftId: string,
  teamId: TeamId,
  teamState: TeamDraftState,
): GameState {
  const draft = state.world.drafts[draftId];
  if (!draft) return state;
  return {
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [draftId]: {
          ...draft,
          teamDraftState: {
            ...draft.teamDraftState,
            [teamId]: teamState,
          },
        },
      },
    },
  };
}
