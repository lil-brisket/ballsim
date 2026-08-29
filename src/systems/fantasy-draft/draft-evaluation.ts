import type { Player, PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  resolveFranchisePreferences,
  type EffectivePreferences,
} from "@/systems/franchise-ai-preferences";
import { boundedPreferenceDelta } from "@/systems/franchise-ai-preferences-config";

/**
 * Round-aware fantasy draft evaluation.
 * Early: talent > fit. Middle: balance. Late: roster needs > raw talent.
 */

export function fantasyDraftPositionCounts(
  state: GameState,
  teamId: TeamId,
): Map<PlayerPosition, number> {
  const counts = new Map<PlayerPosition, number>();
  for (const position of PLAYER_POSITIONS) {
    counts.set(position, 0);
  }
  const team = state.world.teams[teamId];
  if (!team) {
    return counts;
  }
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  return counts;
}

export function evaluatePlayerForTeam(
  state: GameState,
  teamId: TeamId,
  player: Player,
  round: number,
  picksPerTeam: number,
): number {
  const prefs = resolveFranchisePreferences(state, teamId)?.preferences;
  const base = draftTalentScore(player, prefs);
  const counts = fantasyDraftPositionCounts(state, teamId);
  return applyRosterNeedModifiers(base, counts, player.position, round, picksPerTeam);
}

export function applyRosterNeedModifiers(
  score: number,
  positionCounts: Map<PlayerPosition, number>,
  position: PlayerPosition,
  round: number,
  picksPerTeam: number,
): number {
  const count = positionCounts.get(position) ?? 0;
  const progress = picksPerTeam <= 1 ? 1 : (round - 1) / (picksPerTeam - 1);

  // Early (0): need weight low. Late (1): need weight high.
  const needWeight = 0.15 + progress * 0.85;
  const talentWeight = 1 - needWeight * 0.5;

  let needBonus = 0;
  if (count === 0) {
    needBonus = 40 * needWeight;
  } else if (count === 1) {
    needBonus = 15 * needWeight;
  } else if (count >= 3) {
    needBonus = -20 * needWeight;
  }

  return score * Math.max(0.35, talentWeight) + needBonus;
}

export function rankCandidates(
  state: GameState,
  teamId: TeamId,
  availablePlayers: readonly Player[],
  round: number,
  picksPerTeam: number,
): PlayerId[] {
  const prefs = resolveFranchisePreferences(state, teamId)?.preferences;
  const counts = fantasyDraftPositionCounts(state, teamId);
  const scored = availablePlayers.map((player) => {
    const base = draftTalentScore(player, prefs);
    const score = applyRosterNeedModifiers(
      base,
      counts,
      player.position,
      round,
      picksPerTeam,
    );
    return { playerId: player.id, score };
  });
  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  });
  return scored.map((entry) => entry.playerId);
}

export function selectPlayerForTeam(
  state: GameState,
  teamId: TeamId,
  availablePlayers: readonly Player[],
  round: number,
  picksPerTeam: number,
): PlayerId | undefined {
  const ranked = rankCandidates(
    state,
    teamId,
    availablePlayers,
    round,
    picksPerTeam,
  );
  return ranked[0];
}

/** Shared talent score used by fantasy draft and annual draft AI. */
export function draftTalentScore(
  player: Player,
  prefs: EffectivePreferences | undefined,
): number {
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const potential = player.potential.overall;
  const upside = Math.max(0, potential - overall);
  if (!prefs) {
    return overall;
  }
  const overallWeight =
    0.45 +
    boundedPreferenceDelta(prefs.winNowPressure, 0.2) +
    boundedPreferenceDelta(prefs.establishedPlayerValue, 0.1);
  const potentialWeight =
    0.35 +
    boundedPreferenceDelta(prefs.youthValue, 0.15) +
    boundedPreferenceDelta(prefs.developmentPriority, 0.1);
  const upsideWeight =
    0.2 + boundedPreferenceDelta(prefs.riskAppetite, 0.15);
  return (
    overall * Math.max(0.2, overallWeight) +
    potential * Math.max(0.15, potentialWeight) +
    upside * Math.max(0.05, upsideWeight)
  );
}
