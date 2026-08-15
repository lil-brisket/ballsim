import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { MEDIA_EVENT_BUMPS, MEDIA_WEEKLY_DECAY } from "@/systems/media-config";

function clampMedia(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function teamIdFromEvent(event: DomainEvent): TeamId | null {
  const payload = event.payload;
  if (typeof payload.teamId === "string" && payload.teamId.length > 0) {
    return payload.teamId as TeamId;
  }
  if (event.type === "GameCompleted") {
    if (typeof payload.homeTeamId === "string") {
      return payload.homeTeamId as TeamId;
    }
  }
  return null;
}

/**
 * Applies event-driven media attention bumps only — never generates news.
 */
export function applyMediaFromDomainEvents(
  state: GameState,
  events: readonly DomainEvent[],
): SystemResult {
  if (events.length === 0) {
    return systemResult(state);
  }

  const bumps = new Map<TeamId, number>();
  for (const event of events) {
    const bump = MEDIA_EVENT_BUMPS[event.type as keyof typeof MEDIA_EVENT_BUMPS];
    if (bump === undefined) {
      continue;
    }
    const teamId = teamIdFromEvent(event);
    if (!teamId) {
      continue;
    }
    bumps.set(teamId, (bumps.get(teamId) ?? 0) + bump);
  }

  if (bumps.size === 0) {
    return systemResult(state);
  }

  let franchiseOps = state.business.franchiseOps;
  for (const [teamId, bump] of [...bumps.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const ops = franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    franchiseOps = {
      ...franchiseOps,
      [teamId]: {
        ...ops,
        mediaAttention: clampMedia(ops.mediaAttention + bump),
      },
    };
  }

  return systemResult({
    ...state,
    business: { ...state.business, franchiseOps },
  });
}

export function processWeeklyMediaDecay(state: GameState): SystemResult {
  let franchiseOps = state.business.franchiseOps;
  let changed = false;

  for (const teamId of Object.keys(state.world.teams).sort()) {
    const ops = franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    const next = clampMedia(
      Math.round(
        ops.mediaAttention + (50 - ops.mediaAttention) * MEDIA_WEEKLY_DECAY,
      ),
    );
    if (next !== ops.mediaAttention) {
      franchiseOps = {
        ...franchiseOps,
        [teamId]: { ...ops, mediaAttention: next },
      };
      changed = true;
    }
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    business: { ...state.business, franchiseOps },
  });
}
