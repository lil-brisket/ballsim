/**
 * Draft recommendations for the active (or specified) franchise.
 * Uses team scouting estimates only — never true player ratings.
 */

import type { DraftClass } from "@/domain/entities/draft";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  calculateTeamDraftNeeds,
  needLevelScore,
  type DraftNeedLevel,
} from "@/systems/draft/draft-needs";
import { findTeamProspectEstimate } from "@/systems/draft/draft-scouting";
import { ratingRangeMidpoint } from "@/domain/entities/scouting-types";
import type { EstimatedProspectData } from "@/domain/entities/scouting-types";

export type DraftRecommendation = {
  prospectPlayerId: PlayerId;
  playerName: string;
  position: string;
  teamFit: "excellent" | "good" | "fair" | "poor";
  scoutConfidence: string;
  scoutGrade: string;
  currentTalentLabel: string;
  potentialLabel: string;
  teamNeed: DraftNeedLevel;
  reasons: string[];
  score: number;
};

export function getDraftRecommendations(
  state: GameState,
  draft: DraftClass,
  teamId: TeamId = state.user.activeOwnerTeamId,
  limit = 3,
): DraftRecommendation[] {
  const needs = calculateTeamDraftNeeds(state, teamId);
  const teamState = draft.teamDraftState[teamId];
  const eligible = Object.values(draft.prospects).filter(
    (p) => p.status === "eligible",
  );

  const scored: DraftRecommendation[] = [];
  for (const prospect of eligible) {
    const estimate = findTeamProspectEstimate(teamState, prospect.playerId);
    if (!estimate || estimate.knowledgeLevel === "unknown") continue;

    const position = estimate.positionEstimate;
    const need =
      needs.byPosition.find((n) => n.position === position)?.level ?? "none";
    const overallMid = ratingRangeMidpoint(estimate.estimatedOverall);
    const potentialMid = ratingRangeMidpoint(estimate.estimatedPotential);
    const needBonus = needLevelScore(need) * 8;
    const confidenceBonus =
      estimate.confidence === "high"
        ? 6
        : estimate.confidence === "medium"
          ? 3
          : 0;
    const riskPenalty =
      estimate.confidence === "low"
        ? 5
        : estimate.estimatedOverall.max - estimate.estimatedOverall.min > 16
          ? 4
          : 0;

    const score =
      overallMid * 0.4 +
      potentialMid * 0.45 +
      needBonus +
      confidenceBonus -
      riskPenalty;

    const reasons: string[] = [];
    if (need === "critical" || need === "major") {
      reasons.push(`Addresses a ${need} roster weakness at ${position}`);
    }
    if (estimate.confidence === "high") {
      reasons.push("High scout confidence");
    }
    if (potentialMid >= overallMid + 8) {
      reasons.push("Strong development upside");
    }
    if (estimate.scoutGrade.startsWith("A")) {
      reasons.push("Top scout grade");
    }
    if (reasons.length === 0) {
      reasons.push("Best available talent for board");
    }

    scored.push({
      prospectPlayerId: prospect.playerId,
      playerName: `${prospect.player.firstName} ${prospect.player.lastName}`,
      position,
      teamFit: fitLabel(need, estimate),
      scoutConfidence: estimate.confidence,
      scoutGrade: estimate.scoutGrade,
      currentTalentLabel: gradeBand(overallMid),
      potentialLabel: gradeBand(potentialMid),
      teamNeed: need,
      reasons,
      score,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.prospectPlayerId < b.prospectPlayerId
      ? -1
      : a.prospectPlayerId > b.prospectPlayerId
        ? 1
        : 0;
  });
  return scored.slice(0, limit);
}

function fitLabel(
  need: DraftNeedLevel,
  estimate: EstimatedProspectData,
): DraftRecommendation["teamFit"] {
  if (need === "critical" || need === "major") {
    return estimate.confidence === "low" ? "good" : "excellent";
  }
  if (need === "moderate") return "good";
  if (need === "minor") return "fair";
  return estimate.scoutGrade.startsWith("A") ? "good" : "fair";
}

function gradeBand(mid: number): string {
  if (mid >= 88) return "A";
  if (mid >= 84) return "A-";
  if (mid >= 80) return "B+";
  if (mid >= 76) return "B";
  if (mid >= 72) return "B-";
  if (mid >= 68) return "C+";
  if (mid >= 64) return "C";
  return "C-";
}
