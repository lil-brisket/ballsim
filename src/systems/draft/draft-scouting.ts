/**
 * Generate per-team EstimatedProspectData for an entire draft class.
 * Every team (user + AI) gets its own scouting perspective.
 */

import type {
  DraftProspect,
  DraftScoutReport,
  TeamDraftState,
} from "@/domain/entities/draft";
import { createEmptyTeamDraftState } from "@/domain/entities/draft";
import type { TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { teamIdsSorted } from "@/systems/draft/draft-order";
import {
  buildScoutEvaluationContext,
  evaluateProspectForTeam,
} from "@/systems/scouting/scouting-accuracy";
import {
  createDraftScoutReport,
} from "@/domain/entities/draft";
import { PLAYER_ATTRIBUTE_KEYS, type PlayerAttributes } from "@/domain/entities/player";
import { ratingRangeMidpoint } from "@/domain/entities/scouting-types";
import { scoutNoiseScale } from "@/systems/staff-effects";
import {
  DRAFT_SCOUT_ATTRIBUTE_NOISE,
  DRAFT_SCOUT_RANK_NOISE,
} from "@/systems/draft-config";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";

/** Initial raw exposure so new draft class starts at "basic" for average scouts. */
export const INITIAL_SCOUT_EXPOSURE = 1;

/**
 * Build TeamDraftState.scouting for every team × prospect.
 */
export function generateAllTeamScouting(
  state: GameState,
  rng: Rng,
  prospects: Record<string, DraftProspect>,
): Record<string, TeamDraftState> {
  const teamIds = teamIdsSorted(state);
  const prospectList = Object.values(prospects).sort((a, b) =>
    a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0,
  );
  const classSize = prospectList.length;
  if (classSize < 1) {
    throw new Error("Cannot generate scouting: no prospects.");
  }
  if (teamIds.length < 1) {
    throw new Error("Cannot generate scouting: no teams.");
  }

  const teamDraftState: Record<string, TeamDraftState> = {};
  for (const teamId of teamIds) {
    const base = createEmptyTeamDraftState();
    for (const prospect of prospectList) {
      const ctx = buildScoutEvaluationContext(
        state,
        teamId,
        prospect,
        INITIAL_SCOUT_EXPOSURE,
        base.regionCoverage,
        classSize,
      );
      base.scouting.push(evaluateProspectForTeam(state, prospect, ctx, rng));
    }
    teamDraftState[teamId] = base;
  }
  return teamDraftState;
}

/**
 * Legacy flat DraftScoutReport[] for backward-compatible tests / migration bridge.
 * Derived from team estimates midpoints — not a second evaluation path for AI/UI.
 */
export function generateDraftScouting(
  state: GameState,
  rng: Rng,
  prospects: Record<string, DraftProspect>,
): DraftScoutReport[] {
  const teamIds = teamIdsSorted(state);
  const prospectList = Object.values(prospects).sort((a, b) =>
    a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0,
  );
  const classSize = prospectList.length;
  if (classSize < 1) {
    throw new Error("Cannot generate scouting: no prospects.");
  }
  if (teamIds.length < 1) {
    throw new Error("Cannot generate scouting: no teams.");
  }

  const reports: DraftScoutReport[] = [];
  for (const teamId of teamIds) {
    const noiseScale = scoutNoiseScale(state, teamId);
    for (const prospect of prospectList) {
      reports.push(
        createLegacyScoutReport(teamId, prospect, classSize, rng, noiseScale),
      );
    }
  }
  return reports;
}

function createLegacyScoutReport(
  teamId: TeamId,
  prospect: DraftProspect,
  classSize: number,
  rng: Rng,
  noiseScale: number,
): DraftScoutReport {
  const attrNoise = Math.max(
    1,
    Math.round(DRAFT_SCOUT_ATTRIBUTE_NOISE * noiseScale),
  );
  const rankNoise = Math.max(
    1,
    Math.round(DRAFT_SCOUT_RANK_NOISE * noiseScale),
  );

  const estimatedAttributes = {} as PlayerAttributes;
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const trueValue = prospect.player.attributes[key];
    const offset = rng.nextInt(-attrNoise, attrNoise);
    estimatedAttributes[key] = clampRating(trueValue + offset);
  }

  const potentialOffset = rng.nextInt(-attrNoise, attrNoise);
  const estimatedPotentialOverall = clampRating(
    prospect.player.potential.overall + potentialOffset,
  );

  const rankOffset = rng.nextInt(-rankNoise, rankNoise);
  const projectedRank = Math.min(
    classSize,
    Math.max(1, prospect.ranking + rankOffset),
  );

  return createDraftScoutReport({
    teamId,
    prospectPlayerId: prospect.playerId,
    estimatedAttributes,
    estimatedPotentialOverall,
    projectedRank,
  });
}

function clampRating(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, value));
}

/** Lookup helper — team-scoped estimate for a prospect. */
export function findTeamProspectEstimate(
  teamState: TeamDraftState | undefined,
  prospectPlayerId: string,
) {
  if (!teamState) return undefined;
  return teamState.scouting.find(
    (report) => report.prospectPlayerId === prospectPlayerId,
  );
}

export function estimatedOverallMidpoint(
  teamState: TeamDraftState | undefined,
  prospectPlayerId: string,
): number | null {
  const estimate = findTeamProspectEstimate(teamState, prospectPlayerId);
  if (!estimate || estimate.knowledgeLevel === "unknown") return null;
  return ratingRangeMidpoint(estimate.estimatedOverall);
}
