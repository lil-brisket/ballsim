import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

function clampSentiment(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampAwareness(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampReputation(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

/**
 * Applies fan sentiment, awareness, and reputation bumps from
 * GameDayPromotionSettled events. Media attention is handled separately via
 * MEDIA_EVENT_BUMPS + applyMediaFromDomainEvents — do not bump media here.
 */
export function applyPromotionDownstreamEffects(
  state: GameState,
  events: readonly DomainEvent[],
): SystemResult {
  const relevant = events.filter((e) => e.type === "GameDayPromotionSettled");
  if (relevant.length === 0) {
    return systemResult(state);
  }

  let franchiseOps = state.business.franchiseOps;
  let teams = state.world.teams;
  let changed = false;

  for (const event of relevant) {
    const teamId = event.payload.teamId as TeamId | undefined;
    if (!teamId || typeof teamId !== "string") continue;
    const effects = event.payload.effects as
      | {
          awareness?: number;
          sentiment?: number;
          reputation?: number;
        }
      | undefined;
    if (!effects) continue;

    const fanResponse = event.payload.fanResponse as string | undefined;
    const scale =
      fanResponse === "very_positive"
        ? 1.25
        : fanResponse === "positive"
          ? 1
          : fanResponse === "neutral"
            ? 0.5
            : 0.25;

    const ops = franchiseOps[teamId];
    if (ops) {
      const sentimentBump = Math.round((effects.sentiment ?? 0) * scale);
      const awarenessBump = Math.round((effects.awareness ?? 0) * scale);
      if (sentimentBump !== 0 || awarenessBump !== 0) {
        franchiseOps = {
          ...franchiseOps,
          [teamId]: {
            ...ops,
            fanSentiment: clampSentiment(ops.fanSentiment + sentimentBump),
            marketing: {
              ...ops.marketing,
              awareness: clampAwareness(ops.marketing.awareness + awarenessBump),
            },
          },
        };
        changed = true;
      }
    }

    const team = teams[teamId];
    const reputationBump = Math.round((effects.reputation ?? 0) * scale);
    if (team && reputationBump !== 0) {
      teams = {
        ...teams,
        [teamId]: {
          ...team,
          reputation: clampReputation(team.reputation + reputationBump),
        },
      };
      changed = true;
    }
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    world: { ...state.world, teams },
    business: { ...state.business, franchiseOps },
  });
}
