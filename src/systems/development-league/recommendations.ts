/**
 * Soft recommendations, readiness labels, and "Why?" explanations.
 * Separate from hard eligibility gates.
 */

import type { DevelopmentReadiness } from "@/domain/entities/development-league";
import type { Player } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isDevelopmentLeagueEligible } from "@/systems/development-league/eligibility";
import {
  getDevelopmentLeagueRosterPlayers,
  getTopLeagueRosterPlayers,
  isPlayerDlAssigned,
} from "@/systems/development-league/franchise-membership";
import { recommendRosterManagement } from "@/systems/roster-management";

export type DlAssignmentScore = {
  score: number;
  projectedTopLeagueMpg: number;
  potentialGap: number;
  overall: number;
  strongCandidate: boolean;
  reasons: string[];
};

export function estimateProjectedTopLeagueMinutes(
  player: Player,
  teamId: TeamId,
  state: GameState,
): number {
  const team = state.world.teams[teamId];
  if (team == null) return 0;
  try {
    const recommended = recommendRosterManagement(state, teamId);
    const entry = recommended.rotation.find((r) => r.playerId === player.id);
    if (entry != null) {
      return entry.targetMinutes;
    }
  } catch {
    // fall through to heuristic
  }
  const roster = getTopLeagueRosterPlayers(teamId, state);
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const samePos = roster
    .filter((p) => p.position === player.position)
    .sort(
      (a, b) =>
        calculatePlayerOverall(b.position, b.attributes) -
        calculatePlayerOverall(a.position, a.attributes),
    );
  const rankInPos = samePos.findIndex((p) => p.id === player.id);
  if (rankInPos === 0) return Math.min(32, 18 + overall / 10);
  if (rankInPos === 1) return Math.min(24, 10 + overall / 12);
  if (rankInPos === 2) return Math.min(14, 4 + overall / 15);
  // Not on top roster yet — estimate from peer depth
  const peersAtPos = samePos.length;
  if (peersAtPos >= 3) return Math.max(0, 8 - peersAtPos * 2);
  if (overall < 68) return 4;
  if (overall < 74) return 12;
  return 20;
}

export function getDlAssignmentRecommendation(
  player: Player,
  teamId: TeamId,
  state: GameState,
): DlAssignmentScore {
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const potentialGap = Math.max(0, player.potential.overall - overall);
  const projectedMpg = estimateProjectedTopLeagueMinutes(player, teamId, state);
  const reasons: string[] = [];
  let score = 0;

  if (projectedMpg <= 8) {
    score += 40;
    reasons.push(`Projected for only ${Math.round(projectedMpg)} top-league MPG`);
  } else if (projectedMpg <= 15) {
    score += 20;
    reasons.push(`Projected ${Math.round(projectedMpg)} top-league MPG`);
  } else {
    score -= 25;
    reasons.push(
      `Projected ${Math.round(projectedMpg)} top-league MPG — meaningful minutes available`,
    );
  }

  if (potentialGap >= 12) {
    score += 25;
    reasons.push(`High potential gap (+${potentialGap})`);
  } else if (potentialGap >= 6) {
    score += 12;
    reasons.push(`Moderate potential gap (+${potentialGap})`);
  }

  if (overall < 65) {
    score += 15;
    reasons.push(`Currently ${overall} OVR`);
  } else if (overall < 72) {
    score += 5;
  } else {
    score -= 20;
    reasons.push(`Already ${overall} OVR — closer to top-league ready`);
  }

  if (player.age <= 22) {
    score += 10;
  } else if (player.age >= 25) {
    score -= 10;
  }

  const eligible = isDevelopmentLeagueEligible(player, teamId, state);
  if (!eligible) {
    score = Math.min(score, 0);
  }

  return {
    score,
    projectedTopLeagueMpg: projectedMpg,
    potentialGap,
    overall,
    strongCandidate: eligible && score >= 40,
    reasons,
  };
}

export function getDevelopmentReadiness(
  player: Player,
  teamId: TeamId,
  state: GameState,
): DevelopmentReadiness {
  if (!isPlayerDlAssigned(player)) {
    const rec = getDlAssignmentRecommendation(player, teamId, state);
    if (rec.projectedTopLeagueMpg >= 18 && rec.overall >= 70) return "ready";
    if (rec.strongCandidate) return "not_ready";
    return "developing";
  }
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const potentialGap = Math.max(0, player.potential.overall - overall);
  const projected = estimateProjectedTopLeagueMinutes(player, teamId, state);
  if (overall >= 72 && projected >= 12) return "ready";
  if (overall >= 68 && potentialGap <= 8) return "near_ready";
  if (overall >= 65) return "developing";
  return "not_ready";
}

export function getDlAssignmentExplanation(
  player: Player,
  teamId: TeamId,
  state: GameState,
): string[] {
  const rec = getDlAssignmentRecommendation(player, teamId, state);
  const bullets: string[] = [
    `Currently ${rec.overall} OVR`,
    `Projected for only ${Math.round(rec.projectedTopLeagueMpg)} top-league MPG`,
    `High potential: ${player.potential.overall}`,
  ];
  if (isPlayerDlAssigned(player)) {
    bullets.push(
      `DL projected role: ${player.developmentLeague?.role ?? "development"}`,
    );
  } else if (rec.strongCandidate) {
    bullets.push("Significant development opportunity in the Development League");
  }
  return bullets;
}

export function getPromotionExplanation(
  player: Player,
  teamId: TeamId,
  state: GameState,
): string[] {
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const projected = estimateProjectedTopLeagueMinutes(player, teamId, state);
  const readiness = getDevelopmentReadiness(player, teamId, state);
  return [
    `Current OVR: ${overall} (potential ${player.potential.overall})`,
    `Projected top-league role: ~${Math.round(projected)} MPG`,
    `Development status: ${readiness.replace("_", " ")}`,
    `DL seasons used: ${player.developmentLeague?.seasonsUsed ?? 0}/3`,
  ];
}

export type DraftDlRecommendation = {
  playerId: string;
  name: string;
  overall: number;
  potential: number;
  projectedMpg: number;
  strongCandidate: boolean;
  recommendation: "keep" | "development_league";
  reasons: string[];
};

export function buildPostDraftDlRecommendations(
  state: GameState,
  teamId: TeamId,
  draftedPlayerIds: readonly string[],
): {
  totalDrafted: number;
  strongCandidates: number;
  players: DraftDlRecommendation[];
} {
  const players: DraftDlRecommendation[] = [];
  let strongCandidates = 0;
  for (const playerId of draftedPlayerIds) {
    const player = state.world.players[playerId];
    if (player == null) continue;
    const rec = getDlAssignmentRecommendation(player, teamId, state);
    const recommendation =
      rec.strongCandidate ? "development_league" : "keep";
    if (rec.strongCandidate) strongCandidates += 1;
    players.push({
      playerId,
      name: `${player.firstName} ${player.lastName}`,
      overall: rec.overall,
      potential: player.potential.overall,
      projectedMpg: rec.projectedTopLeagueMpg,
      strongCandidate: rec.strongCandidate,
      recommendation,
      reasons: rec.reasons,
    });
  }
  return {
    totalDrafted: players.length,
    strongCandidates,
    players,
  };
}

export function listFranchiseDlProspects(teamId: TeamId, state: GameState) {
  return getDevelopmentLeagueRosterPlayers(teamId, state);
}
