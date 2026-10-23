/**
 * Team chemistry, 0–100, derived (never stored) from:
 * - continuity: how many of the top eight by planned minutes were on the
 *   team last season (players with no history count as neutral);
 * - morale: their average mood;
 * - leadership: the best leader among them;
 * - recent trades: each player traded in or out in the last
 *   {@link CHEMISTRY_TRADE_WINDOW_DAYS} days costs a little.
 *
 * Its game effect is small and bounded (turnovers in the possession engine,
 * expected points in the box-score engine): see {@link chemistryTurnoverMultiplier}
 * and {@link chemistryPointsDelta}. Neutral chemistry ({@link CHEMISTRY_NEUTRAL})
 * changes nothing. No RNG.
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getPlayerMorale } from "@/systems/player-morale";

export const CHEMISTRY_NEUTRAL = 60;
export const CHEMISTRY_TOP_PLAYERS = 8;
export const CHEMISTRY_TRADE_WINDOW_DAYS = 30;
export const CHEMISTRY_TRADE_PENALTY = 0.06;
export const CHEMISTRY_MAX_TRADE_PENALTY = 0.3;
/** Turnover weight swing at 0 / 100 chemistry (±). */
export const CHEMISTRY_MAX_TURNOVER_SWING = 0.06;
/** Box-score expected-points swing at 0 / 100 chemistry (±). */
export const CHEMISTRY_MAX_POINTS_SWING = 1.0;
/** Typical best leadership among eight players, as a 0–1 share. */
const TYPICAL_TOP_LEADERSHIP = 0.84;
/** Continuity credit for a player with no history (new league). */
const UNKNOWN_CONTINUITY = 0.6;

export type TeamChemistry = {
  value: number;
  continuity: number;
  morale: number;
  leadership: number;
  /** Players traded in or out recently. */
  recentTrades: number;
};

export function teamChemistry(state: GameState, teamId: TeamId): TeamChemistry {
  const cached = cache.get(state)?.get(teamId);
  if (cached) return cached;
  const result = computeChemistry(state, teamId);
  let byTeam = cache.get(state);
  if (!byTeam) {
    byTeam = new Map();
    cache.set(state, byTeam);
  }
  byTeam.set(teamId, result);
  return result;
}

const cache = new WeakMap<GameState, Map<string, TeamChemistry>>();

function computeChemistry(state: GameState, teamId: TeamId): TeamChemistry {
  const team = state.world.teams[teamId];
  const neutral = {
    value: CHEMISTRY_NEUTRAL,
    continuity: UNKNOWN_CONTINUITY,
    morale: 0.6,
    leadership: 0.6,
    recentTrades: 0,
  };
  if (!team) return neutral;
  const rotation = [...(team.rosterManagement?.rotation ?? [])]
    .filter((r) => team.roster.includes(r.playerId))
    .sort(
      (a, b) =>
        b.targetMinutes - a.targetMinutes || (a.playerId < b.playerId ? -1 : 1),
    )
    .slice(0, CHEMISTRY_TOP_PLAYERS)
    .map((r) => r.playerId);
  const core: PlayerId[] =
    rotation.length > 0
      ? rotation
      : team.roster.slice(0, CHEMISTRY_TOP_PLAYERS);
  if (core.length === 0) return neutral;

  const year = state.competition.season.year;
  const lastYear =
    state.competition.season.phase === "offseason" ? year : year - 1;
  let continuity = 0;
  let morale = 0;
  let leadership = 0;
  for (const playerId of core) {
    const seasons = state.business.playerHistory[playerId]?.seasons ?? [];
    const last = seasons.find((s) => s.seasonYear === lastYear);
    continuity +=
      seasons.length === 0
        ? UNKNOWN_CONTINUITY
        : last?.contractSnapshot.teamId === teamId
          ? 1
          : 0;
    morale += getPlayerMorale(state, playerId).value / 100;
    leadership = Math.max(
      leadership,
      (state.world.players[playerId]?.personality.leadership ?? 50) / 100,
    );
  }
  continuity /= core.length;
  morale /= core.length;
  // The best of eight leaders is typically ~84 (personality 40–90): that is
  // neutral, so a typical roster lands at exactly neutral chemistry.
  leadership = Math.max(
    0,
    Math.min(1, 0.6 + (leadership - TYPICAL_TOP_LEADERSHIP) * 1.5),
  );

  const today = state.world.calendar.currentDate;
  let recentTrades = 0;
  for (const event of state.competition.seasonEventLog) {
    if (event.type !== "PlayerTraded") continue;
    if (
      event.payload.fromTeamId !== teamId &&
      event.payload.toTeamId !== teamId
    ) {
      continue;
    }
    if (
      calendarDaysBetween(event.occurredOn, today) <=
      CHEMISTRY_TRADE_WINDOW_DAYS
    ) {
      recentTrades += 1;
    }
  }
  const tradePenalty = Math.min(
    CHEMISTRY_MAX_TRADE_PENALTY,
    recentTrades * CHEMISTRY_TRADE_PENALTY,
  );
  const raw =
    0.45 * continuity + 0.3 * morale + 0.25 * leadership - tradePenalty;
  const value = Math.round(Math.max(0, Math.min(1, raw)) * 100);
  return { value, continuity, morale, leadership, recentTrades };
}

/** −1..+1 around neutral chemistry. */
function chemistryLean(value: number): number {
  return value >= CHEMISTRY_NEUTRAL
    ? (value - CHEMISTRY_NEUTRAL) / (100 - CHEMISTRY_NEUTRAL)
    : (value - CHEMISTRY_NEUTRAL) / CHEMISTRY_NEUTRAL;
}

/** Multiplier on the offense's turnover action weight (good chemistry: fewer). */
export function chemistryTurnoverMultiplier(value: number): number {
  return 1 - chemistryLean(value) * CHEMISTRY_MAX_TURNOVER_SWING;
}

/** Points added to the team's expected score in the box-score engine. */
export function chemistryPointsDelta(value: number): number {
  return chemistryLean(value) * CHEMISTRY_MAX_POINTS_SWING;
}
