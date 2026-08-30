/**
 * Post-game injury exposure processing.
 * In-game acute and post-game overuse are distinct event types;
 * a player who suffers acute is excluded from overuse for that game.
 */

import type { DomainEvent } from "@/domain/events";
import type { Game } from "@/domain/entities/game";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  createGameAcuteExposure,
  createGameOveruseExposure,
} from "@/systems/injury/injury-exposure";
import { processExposureEvent } from "@/systems/injury/injury-service";

function recentMpg(state: GameState, playerId: PlayerId): number {
  // Lightweight: use rotation target when available
  for (const team of Object.values(state.world.teams)) {
    const entry = team.rosterManagement.rotation.find(
      (r) => r.playerId === playerId,
    );
    if (entry != null) {
      return entry.targetMinutes;
    }
  }
  return 20;
}

function isBackToBack(
  state: GameState,
  teamId: TeamId,
  date: string,
): boolean {
  let previous: string | null = null;
  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") continue;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    if (game.date >= date) continue;
    if (previous == null || game.date > previous) {
      previous = game.date;
    }
  }
  if (previous == null) return false;
  const prevMs = Date.parse(`${previous}T12:00:00Z`);
  const curMs = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(prevMs) || !Number.isFinite(curMs)) return false;
  return Math.round((curMs - prevMs) / 86_400_000) === 1;
}

/**
 * Process acute then overuse exposures for all players who appeared in a final game.
 */
export function processPostGameInjuryExposures(
  state: GameState,
  game: Game,
  rng: Rng,
): { state: GameState; events: DomainEvent[] } {
  if (game.status !== "final") {
    return { state, events: [] };
  }

  let current = state;
  const events: DomainEvent[] = [];
  const homeB2B = isBackToBack(state, game.homeTeamId, game.date);
  const awayB2B = isBackToBack(state, game.awayTeamId, game.date);

  for (const row of game.playerStats) {
    if (row.minutes <= 0) continue;
    const player = current.world.players[row.playerId];
    if (player == null) continue;

    const teamId = row.teamId as TeamId;
    const isHome = teamId === game.homeTeamId;
    const fatigue = Math.min(1, row.minutes / 42);
    const recent = recentMpg(current, row.playerId);

    const acute = processExposureEvent(
      current,
      createGameAcuteExposure({
        playerId: row.playerId,
        teamId,
        date: game.date,
        minutesPlayed: row.minutes,
        fatigue,
        recentWorkloadMpg: recent,
        isBackToBack: isHome ? homeB2B : awayB2B,
      }),
      rng,
    );
    current = acute.state;
    events.push(...acute.events);

    const injuredThisGame = acute.events.some((e) => e.type === "PlayerInjured");

    const overuse = processExposureEvent(
      current,
      createGameOveruseExposure({
        playerId: row.playerId,
        teamId,
        date: game.date,
        minutesPlayed: row.minutes,
        fatigue,
        recentWorkloadMpg: recent,
        isBackToBack: isHome ? homeB2B : awayB2B,
        alreadyInjuredThisGame: injuredThisGame,
      }),
      rng,
    );
    current = overuse.state;
    events.push(...overuse.events);
  }

  return { state: current, events };
}
