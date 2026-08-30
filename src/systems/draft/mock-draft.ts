/**
 * League mock draft + team-specific views.
 * Each AI pick uses that team's scouting estimates — never true ratings.
 */

import type {
  DraftClass,
  LeagueMockDraft,
  LeagueMockDraftSlot,
  TeamMockDraftView,
} from "@/domain/entities/draft";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculateTeamDraftNeeds } from "@/systems/draft/draft-needs";
import { findTeamProspectEstimate } from "@/systems/draft/draft-scouting";
import { ratingRangeMidpoint } from "@/domain/entities/scouting-types";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";

export function buildMockDraftCacheKey(draft: DraftClass): string {
  const selected = draft.selections.map((s) => s.playerId).join(",");
  const orderOwners = draft.order.map((s) => s.ownerTeamId).join(",");
  return `${draft.id}|${draft.status}|${selected}|${orderOwners}|${Object.keys(draft.prospects).length}`;
}

/**
 * Score a prospect for a team using ONLY that team's scouting estimate.
 */
export function scoreProspectFromEstimate(
  state: GameState,
  draft: DraftClass,
  teamId: TeamId,
  prospectPlayerId: PlayerId,
): number {
  const estimate = findTeamProspectEstimate(
    draft.teamDraftState[teamId],
    prospectPlayerId,
  );
  if (!estimate || estimate.knowledgeLevel === "unknown") {
    return -1000;
  }
  const needs = calculateTeamDraftNeeds(state, teamId);
  const need =
    needs.byPosition.find((n) => n.position === estimate.positionEstimate)
      ?.level ?? "none";
  const needBonus =
    need === "critical"
      ? 24
      : need === "major"
        ? 16
        : need === "moderate"
          ? 8
          : need === "minor"
            ? 3
            : 0;
  const prefs = resolveFranchisePreferences(state, teamId)?.preferences;
  const overall = ratingRangeMidpoint(estimate.estimatedOverall);
  const potential = ratingRangeMidpoint(estimate.estimatedPotential);
  const upside = Math.max(0, potential - overall);
  // Development-oriented franchises weight potential/upside more heavily.
  const youthValue = prefs?.youthValue ?? 0.5;
  const developmentPriority = prefs?.developmentPriority ?? 0.5;
  const overallWeight = 0.55 - youthValue * 0.25;
  const potentialWeight = 0.35 + youthValue * 0.2;
  const upsideWeight = 0.1 + youthValue * 0.15 + developmentPriority * 0.1;
  const confidence =
    estimate.confidence === "high" ? 4 : estimate.confidence === "medium" ? 2 : 0;
  return (
    overall * overallWeight +
    potential * potentialWeight +
    upside * upsideWeight +
    needBonus +
    confidence
  );
}

export function selectProspectFromTeamScouting(
  state: GameState,
  draft: DraftClass,
  teamId: TeamId,
  eligibleIds: Set<string>,
): PlayerId | undefined {
  let bestId: PlayerId | undefined;
  let bestScore = -Infinity;
  for (const prospect of Object.values(draft.prospects)) {
    if (prospect.status !== "eligible") continue;
    if (!eligibleIds.has(prospect.playerId)) continue;
    const score = scoreProspectFromEstimate(
      state,
      draft,
      teamId,
      prospect.playerId,
    );
    if (
      score > bestScore ||
      (score === bestScore &&
        bestId !== undefined &&
        prospect.playerId < bestId)
    ) {
      bestScore = score;
      bestId = prospect.playerId;
    }
  }
  return bestId;
}

/**
 * Simulate remaining draft order using each team's own estimates.
 */
export function computeLeagueMockDraft(
  state: GameState,
  draft: DraftClass,
  generatedOn: string,
): LeagueMockDraft {
  const cacheKey = buildMockDraftCacheKey(draft);
  const remaining = new Set(
    Object.values(draft.prospects)
      .filter((p) => p.status === "eligible")
      .map((p) => p.playerId as string),
  );
  const slots: LeagueMockDraftSlot[] = [];

  for (const slot of draft.order) {
    if (slot.status === "used" && slot.selectedPlayerId) {
      slots.push({
        overallPick: slot.overallPick,
        teamId: slot.ownerTeamId,
        prospectPlayerId: slot.selectedPlayerId,
      });
      remaining.delete(slot.selectedPlayerId);
      continue;
    }
    const pick = selectProspectFromTeamScouting(
      state,
      draft,
      slot.ownerTeamId,
      remaining,
    );
    if (!pick) break;
    slots.push({
      overallPick: slot.overallPick,
      teamId: slot.ownerTeamId,
      prospectPlayerId: pick,
    });
    remaining.delete(pick);
  }

  return { cacheKey, generatedOn, slots };
}

export function availabilityLabel(
  projectedPick: number,
  userPickNumber: number | null,
  timesAvailableInSim: number,
  simCount: number,
): string {
  if (userPickNumber === null) {
    return timesAvailableInSim >= simCount * 0.7
      ? "Usually available"
      : "Often taken early";
  }
  if (projectedPick > userPickNumber + 3) {
    return `Available in ${timesAvailableInSim}/${simCount} projections`;
  }
  if (projectedPick > userPickNumber) {
    return "Usually available";
  }
  if (projectedPick === userPickNumber) {
    return "Likely gone at your pick";
  }
  return "Often taken before your pick";
}

/**
 * Team view: where each prospect is projected relative to prior snapshot.
 */
export function computeTeamMockDraftView(
  state: GameState,
  draft: DraftClass,
  teamId: TeamId,
  leagueMock: LeagueMockDraft,
  previous: TeamMockDraftView | undefined,
): TeamMockDraftView {
  const userPicks = draft.order.filter(
    (s) => s.ownerTeamId === teamId && s.status === "available",
  );
  const nextUserPick = userPicks[0]?.overallPick ?? null;
  const teamState = draft.teamDraftState[teamId];

  const projectedPicks = Object.values(draft.prospects)
    .filter((p) => p.status === "eligible")
    .map((prospect) => {
      const slot = leagueMock.slots.find(
        (s) => s.prospectPlayerId === prospect.playerId,
      );
      const projectedOverallPick = slot?.overallPick ?? 999;
      const prev =
        previous?.projectedPicks.find(
          (p) => p.prospectPlayerId === prospect.playerId,
        )?.projectedOverallPick ?? null;
      const delta =
        prev !== null ? prev - projectedOverallPick : null;
      const estimate = findTeamProspectEstimate(teamState, prospect.playerId);
      const known = estimate && estimate.knowledgeLevel !== "unknown";
      return {
        prospectPlayerId: prospect.playerId,
        projectedOverallPick: known ? projectedOverallPick : 999,
        previousProjectedOverallPick: prev,
        delta,
        availabilityLabel: known
          ? availabilityLabel(
              projectedOverallPick,
              nextUserPick,
              projectedOverallPick >= (nextUserPick ?? 999) ? 7 : 3,
              10,
            )
          : "Unknown",
      };
    })
    .sort((a, b) => a.projectedOverallPick - b.projectedOverallPick);

  return {
    cacheKey: leagueMock.cacheKey,
    projectedPicks,
  };
}

export function ensureMockDrafts(
  state: GameState,
  draft: DraftClass,
): { state: GameState; draft: DraftClass } {
  const cacheKey = buildMockDraftCacheKey(draft);
  const date = state.world.calendar.currentDate;
  let leagueMock = draft.leagueMockDraft;
  if (!leagueMock || leagueMock.cacheKey !== cacheKey) {
    leagueMock = computeLeagueMockDraft(state, draft, date);
  }

  let teamDraftState = { ...draft.teamDraftState };
  for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
    const existing = teamDraftState[teamId];
    if (!existing) continue;
    if (
      existing.teamMockDraftView &&
      existing.teamMockDraftCacheKey === cacheKey
    ) {
      continue;
    }
    const view = computeTeamMockDraftView(
      state,
      { ...draft, leagueMockDraft: leagueMock },
      teamId,
      leagueMock,
      existing.teamMockDraftView,
    );
    teamDraftState[teamId] = {
      ...existing,
      teamMockDraftCacheKey: cacheKey,
      teamMockDraftView: view,
    };
  }

  const nextDraft: DraftClass = {
    ...draft,
    leagueMockDraft: leagueMock,
    teamDraftState,
  };
  return {
    draft: nextDraft,
    state: {
      ...state,
      world: {
        ...state.world,
        drafts: {
          ...state.world.drafts,
          [draft.id]: nextDraft,
        },
      },
    },
  };
}
