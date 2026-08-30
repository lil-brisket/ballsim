/**
 * AI return-to-play helpers — rolling minutes baseline, not rotation snapshots.
 */

import type { Player } from "@/domain/entities/player";
import type { GameState } from "@/state/game-state";
import type { PlayerId, TeamId } from "@/domain/ids";
import { getEffectivePlayerValue, getWorkloadRestrictions } from "@/systems/injury/injury-effects";

const ROLLING_GAMES = 8;

/**
 * Pre-injury / RTP baseline from rolling game minutes + season average + role target.
 * Do NOT use a single previous rotation entry as permanent baseline.
 */
export function computeReturnToPlayBaseline(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): number {
  const team = state.world.teams[teamId];
  const roleTarget =
    team?.rosterManagement.rotation.find((e) => e.playerId === playerId)
      ?.targetMinutes ?? 20;

  const minutes: number[] = [];
  let seasonTotal = 0;
  let seasonGames = 0;

  const games = Object.values(state.competition.games)
    .filter(
      (game) =>
        game.status === "final" &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const game of games) {
    const row = game.playerStats.find((s) => s.playerId === playerId);
    if (row == null) continue;
    seasonTotal += row.minutes;
    seasonGames += 1;
    if (minutes.length < ROLLING_GAMES) {
      minutes.push(row.minutes);
    }
  }

  const rollingAvg =
    minutes.length > 0
      ? minutes.reduce((a, b) => a + b, 0) / minutes.length
      : roleTarget;
  const seasonAvg = seasonGames > 0 ? seasonTotal / seasonGames : roleTarget;

  return Math.round(rollingAvg * 0.5 + seasonAvg * 0.3 + roleTarget * 0.2);
}

/**
 * Gradual RTP target given games since becoming available/recovery.
 */
export function computeReturnToPlayTargetMinutes(
  state: GameState,
  player: Player,
  teamId: TeamId,
  gamesSinceClearance: number,
): number {
  const baseline = computeReturnToPlayBaseline(state, player.id, teamId);
  const workload = getWorkloadRestrictions(player);

  if (workload.maximumWorkloadMpg === 0) {
    return 0;
  }

  const hardCap =
    workload.maximumWorkloadMpg ??
    workload.minutesRestriction ??
    baseline;
  const softTarget = workload.recommendedWorkloadMpg ?? hardCap;

  // Ramp over ~5 games after clearance
  const ramp = Math.min(1, Math.max(0.35, (gamesSinceClearance + 1) / 5));
  let target = Math.round(baseline * ramp);

  // Reinjury-aware pull toward soft target
  if (workload.reinjuryRisk > 0.1) {
    target = Math.round(target * (1 - workload.reinjuryRisk * 0.35));
  }

  target = Math.min(target, softTarget, hardCap);
  return Math.max(0, target);
}

/** Effective value for AI lineup ranking. */
export function rankPlayerForAiMinutes(player: Player): number {
  return getEffectivePlayerValue(player);
}
