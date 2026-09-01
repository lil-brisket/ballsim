/**
 * Post-process DomainEvents into compact simulation summary highlights.
 */

import type { ImportanceLevel } from "@/domain/entities/event-source";
import {
  IMPORTANCE_RANK,
  importanceAtLeast,
} from "@/domain/entities/event-source";
import type { DomainEvent } from "@/domain/events";
import type { GameState } from "@/state/game-state";
import { getDomainEventPolicy } from "@/systems/event-registry";
import { generateHeadline } from "@/systems/media-hub/generate-headline";

export type SimulationHighlight = {
  date: string;
  headline: string;
  importance: ImportanceLevel;
  eventType: string;
  sourceEventId: string;
};

const MAX_PER_DAY = 5;

/**
 * Build chronological highlights from events produced during an advance.
 * Filters via Event Registry highlight policy; caps per day.
 */
export function buildSimulationHighlights(
  state: GameState,
  events: readonly DomainEvent[],
  options: { minImportance?: ImportanceLevel; maxPerDay?: number } = {},
): SimulationHighlight[] {
  const minImportance = options.minImportance ?? "medium";
  const maxPerDay = options.maxPerDay ?? MAX_PER_DAY;

  const candidates: SimulationHighlight[] = [];

  for (const event of events) {
    const policy = getDomainEventPolicy(event.type);
    if (!policy.highlight.show) continue;
    if (!importanceAtLeast(policy.media.importance, minImportance)) continue;
    if (!importanceAtLeast(policy.highlight.minImportance, minImportance)) {
      continue;
    }

    const { headline } = generateHeadline(event, state);
    candidates.push({
      date: event.occurredOn,
      headline,
      importance: policy.media.importance,
      eventType: event.type,
      sourceEventId: event.id,
    });
  }

  candidates.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance];
  });

  const byDate = new Map<string, number>();
  const result: SimulationHighlight[] = [];
  for (const item of candidates) {
    const count = byDate.get(item.date) ?? 0;
    if (count >= maxPerDay) continue;
    byDate.set(item.date, count + 1);
    result.push(item);
  }

  return result;
}
