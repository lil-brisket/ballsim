import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getTradeBlock } from "@/systems/trades/trade-block";
import {
  RETENTION_PRIORITY_WEIGHTS,
  RECENTLY_ACQUIRED_DAYS,
} from "@/systems/trades-config";
import { calculateTradeNeeds } from "@/systems/trades/trade-needs";
import { addCalendarDays } from "@/domain/calendar-date";

/**
 * How strongly a team wants to keep a player (0–100).
 * High retention ≠ high trade value — it means "not shopping".
 */
export function getRetentionPriority(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): number {
  const player = state.world.players[playerId];
  const team = state.world.teams[teamId];
  if (!player || !team || player.teamId !== teamId) {
    return 0;
  }

  let priority = 20;
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const rosterOveralls = team.roster
    .map((id) => state.world.players[id])
    .filter((p) => p !== undefined)
    .map((p) => calculatePlayerOverall(p.position, p.attributes));
  const maxOvr = rosterOveralls.length > 0 ? Math.max(...rosterOveralls) : 0;
  if (overall >= maxOvr && overall >= 78) {
    priority += RETENTION_PRIORITY_WEIGHTS.topOverallOnTeam;
  }

  const potentialGap = player.potential.overall - overall;
  if (player.age <= 23 && potentialGap >= 8) {
    priority += RETENTION_PRIORITY_WEIGHTS.highPotentialYoung;
  }

  if (player.age <= 22 && overall >= 70) {
    priority += RETENTION_PRIORITY_WEIGHTS.recentDraftPickBonus;
  }

  if (wasRecentlyAcquired(state, playerId)) {
    priority += RETENTION_PRIORITY_WEIGHTS.recentlyAcquiredBonus;
  }

  const block = getTradeBlock(state, teamId);
  if (
    block.assets.some(
      (asset) => asset.kind === "player" && asset.playerId === playerId,
    )
  ) {
    priority += RETENTION_PRIORITY_WEIGHTS.onTradeBlockPenalty;
  }

  const needs = calculateTradeNeeds(state, teamId);
  const posNeed = needs.byPosition.find((p) => p.position === player.position);
  if (posNeed?.surplus && player.age >= 30) {
    priority += RETENTION_PRIORITY_WEIGHTS.redundantVetPenalty;
  }

  return Math.max(0, Math.min(100, priority));
}

export function isCoreRetentionPlayer(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): boolean {
  return (
    getRetentionPriority(state, teamId, playerId) >=
    RETENTION_PRIORITY_WEIGHTS.coreThreshold
  );
}

export function shouldNotShopPlayer(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): boolean {
  const block = getTradeBlock(state, teamId);
  if (
    block.assets.some(
      (asset) => asset.kind === "player" && asset.playerId === playerId,
    )
  ) {
    return false;
  }
  return (
    getRetentionPriority(state, teamId, playerId) >=
    RETENTION_PRIORITY_WEIGHTS.doNotShopThreshold
  );
}

function wasRecentlyAcquired(state: GameState, playerId: PlayerId): boolean {
  const today = state.world.calendar.currentDate;
  const cutoff = addCalendarDays(today, -RECENTLY_ACQUIRED_DAYS);
  for (const franchise of Object.values(state.user.ownedFranchises)) {
    for (const event of franchise.eventLog) {
      if (event.type !== "PlayerTraded") continue;
      if (event.occurredOn < cutoff) continue;
      const payload = event.payload as { playerId?: string };
      if (payload.playerId === playerId) {
        return true;
      }
    }
  }
  return false;
}
