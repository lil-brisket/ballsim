/**
 * What a free agent wants besides money. Each motivation is a 0–1 reading of
 * the team (0.5 neutral), weighted by the player's personality and turned
 * into interest points around the money score. Salary stays the biggest
 * factor: money moves interest by up to 60 points, everything here by less
 * than half of that together.
 *
 * - Winning: team win% (this season once 10 games are played, otherwise
 *   last season) and roster strength, weighted by competitiveness.
 * - Playing time: his rank by overall on that roster (starter, rotation,
 *   bench).
 * - Market: market size (small).
 * - Loyalty: a bonus for his current or most recent team, by loyalty.
 * - Coach: the head coach's leadership and player development.
 *
 * Same evaluation for every team, owner or CPU.
 */

import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { FREE_AGENCY_INTEREST_CONFIG } from "@/systems/free-agency-config";
import { getTopLeagueRosterPlayerIds } from "@/systems/development-league/franchise-membership";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import { moraleFactor } from "@/systems/player-morale";

export type FreeAgentMotivation =
  "winning" | "playingTime" | "market" | "loyalty" | "coach";

export const FREE_AGENT_MOTIVATIONS: readonly FreeAgentMotivation[] = [
  "winning",
  "playingTime",
  "market",
  "loyalty",
  "coach",
];

export type MotivationReading = {
  motivation: FreeAgentMotivation;
  /** How the team rates on it, 0–1 (0.5 neutral). */
  value: number;
  /** How much he cares, from personality (multiplies the points). */
  weight: number;
  /** Interest points it adds or removes. */
  points: number;
};

/**
 * How much each factor matters to this player (multiplies its points):
 * competitive players and veterans chase winning; young players want minutes
 * and a coach who develops them; loyal players stay; leaders like a stage.
 */
export function motivationWeights(
  player: Player,
): Record<FreeAgentMotivation, number> {
  const p = player.personality;
  const young = player.age <= 24;
  const veteran = player.age >= 30;
  return {
    winning: (p.competitiveness / 50) * (veteran ? 1.3 : young ? 0.8 : 1),
    playingTime: young ? 1.4 : player.age >= 31 ? 0.6 : 1,
    market: p.leadership / 50,
    loyalty: p.loyalty / 50,
    coach: (p.workEthic / 50) * (player.age <= 25 ? 1.3 : 1),
  };
}

/** Read every motivation for a player and team. Pure; deterministic. */
export function readFreeAgentMotivations(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): MotivationReading[] {
  const player = state.world.players[playerId];
  if (!player) return [];
  const cfg = FREE_AGENCY_INTEREST_CONFIG.motivations;
  const readings: MotivationReading[] = [];
  const push = (
    motivation: FreeAgentMotivation,
    value: number,
    weight: number,
    maxPoints: number,
    centered = true,
  ) => {
    const v = Math.max(0, Math.min(1, value));
    const raw = centered ? (v - 0.5) * 2 : v;
    readings.push({
      motivation,
      value: v,
      weight,
      points: Math.round(raw * maxPoints * weight * 10) / 10,
    });
  };

  const weights = motivationWeights(player);
  push("winning", teamWinning(state, teamId), weights.winning, cfg.winning);
  push(
    "playingTime",
    projectedRole(state, playerId, teamId),
    weights.playingTime,
    cfg.playingTime,
  );
  const market = state.business.franchiseOps[teamId]?.marketSize ?? 50;
  push("market", market / 100, weights.market, cfg.market);
  const lastTeam = player.teamId ?? lastTeamOf(state, playerId);
  // An unhappy player feels less pull to stay.
  push(
    "loyalty",
    lastTeam === teamId ? moraleFactor(state, playerId) : 0,
    weights.loyalty,
    cfg.loyalty,
    false,
  );
  push("coach", coachQuality(state, teamId), weights.coach, cfg.coach);
  return readings;
}

/** Sum of motivation points for a player and team. */
export function motivationPoints(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): number {
  return readFreeAgentMotivations(state, playerId, teamId).reduce(
    (sum, r) => sum + r.points,
    0,
  );
}

/** The two things he weighs most (for "Cares about: ..."). */
export function topMotivations(
  state: GameState,
  playerId: PlayerId,
): FreeAgentMotivation[] {
  const player = state.world.players[playerId];
  if (!player) return [];
  const cfg = FREE_AGENCY_INTEREST_CONFIG.motivations;
  const weights = motivationWeights(player);
  const emphasis: Array<[FreeAgentMotivation, number]> = [
    ["winning", weights.winning * cfg.winning],
    ["playingTime", weights.playingTime * cfg.playingTime],
    ["loyalty", weights.loyalty * cfg.loyalty],
    ["coach", weights.coach * cfg.coach],
    ["market", weights.market * cfg.market],
  ];
  return emphasis
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 2)
    .map(([m]) => m);
}

function teamWinning(state: GameState, teamId: TeamId): number {
  const standing = state.competition.standings.byTeamId[teamId];
  const played = (standing?.wins ?? 0) + (standing?.losses ?? 0);
  let winPct = 0.5;
  if (standing && played >= 10) {
    winPct = standing.wins / played;
  } else {
    const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
    const last = seasons[seasons.length - 1];
    if (last && last.wins + last.losses > 0) {
      winPct = last.wins / (last.wins + last.losses);
    }
  }
  // Roster strength: rank of the team's top-eight average among the league.
  const strengths = (Object.keys(state.world.teams) as TeamId[])
    .map((id) => ({ id, s: topEightStrength(state, id) }))
    .sort((a, b) => a.s - b.s || (a.id < b.id ? -1 : 1));
  const rank = strengths.findIndex((t) => t.id === teamId);
  const strength = strengths.length > 1 ? rank / (strengths.length - 1) : 0.5;
  return (winPct + strength) / 2;
}

const strengthCache = new WeakMap<object, Map<string, number>>();

function topEightStrength(state: GameState, teamId: TeamId): number {
  let byTeam = strengthCache.get(state.world.players);
  if (!byTeam) {
    byTeam = new Map();
    strengthCache.set(state.world.players, byTeam);
  }
  const cached = byTeam.get(teamId);
  if (cached !== undefined) return cached;
  const overalls = getTopLeagueRosterPlayerIds(teamId, state)
    .map((id) => state.world.players[id])
    .filter((p) => p !== undefined)
    .map((p) => calculatePlayerOverall(p!.position, p!.attributes))
    .sort((a, b) => b - a)
    .slice(0, 8);
  const value =
    overalls.length === 0
      ? 0
      : overalls.reduce((a, b) => a + b, 0) / overalls.length;
  byTeam.set(teamId, value);
  return value;
}

/** 1 starter, 0.65 rotation, 0.35 bench, 0.15 end of bench. */
function projectedRole(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): number {
  const player = state.world.players[playerId];
  if (!player) return 0.5;
  const mine = calculatePlayerOverall(player.position, player.attributes);
  const better = getTopLeagueRosterPlayerIds(teamId, state).filter((id) => {
    if (id === playerId) return false;
    const other = state.world.players[id];
    return (
      other !== undefined &&
      calculatePlayerOverall(other.position, other.attributes) > mine
    );
  }).length;
  if (better < 5) return 1;
  if (better < 8) return 0.65;
  if (better < 11) return 0.35;
  return 0.15;
}

function coachQuality(state: GameState, teamId: TeamId): number {
  const coach = findTeamStaffByRole(state, teamId, "head_coach");
  if (!coach) return 0.5;
  const attrs = coach.attributes as Record<string, number>;
  const leadership = attrs.leadership ?? 50;
  const development = attrs.playerDevelopment ?? 50;
  return (leadership + development) / 200;
}

function lastTeamOf(state: GameState, playerId: PlayerId): TeamId | null {
  const seasons = state.business.playerHistory[playerId]?.seasons ?? [];
  const last = seasons[seasons.length - 1];
  return last?.contractSnapshot.teamId ?? null;
}
