/**
 * Polymorphic references to authoritative game-state sources.
 * Used by Calendar, Media, Notifications, and Simulation Highlights
 * so all surfaces share one stable identity for the same underlying fact.
 */

import type {
  DomainEventId,
  GameId,
  OwnerDecisionId,
} from "@/domain/ids";
import type { LeagueMilestoneKey } from "@/systems/league-rules/calendar-events";

export type ImportanceLevel = "critical" | "high" | "medium" | "low";

export const IMPORTANCE_LEVELS: readonly ImportanceLevel[] = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const IMPORTANCE_RANK: Record<ImportanceLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export type EventSourceRef =
  | { type: "domain_event"; id: DomainEventId }
  | { type: "game"; id: GameId }
  | { type: "award"; id: string }
  | { type: "playoff_series"; id: string }
  | { type: "milestone"; key: LeagueMilestoneKey }
  | { type: "owner_decision"; id: OwnerDecisionId };

/**
 * Flattened deterministic dedupe key.
 * Examples: "game:game_123", "domain_event:evt_abc", "award:mvp_2026"
 */
export function toSourceKey(ref: EventSourceRef): string {
  switch (ref.type) {
    case "domain_event":
      return `domain_event:${ref.id}`;
    case "game":
      return `game:${ref.id}`;
    case "award":
      return `award:${ref.id}`;
    case "playoff_series":
      return `playoff_series:${ref.id}`;
    case "milestone":
      return `milestone:${ref.key}`;
    case "owner_decision":
      return `owner_decision:${ref.id}`;
  }
}

export function importanceAtLeast(
  level: ImportanceLevel,
  minimum: ImportanceLevel,
): boolean {
  return IMPORTANCE_RANK[level] >= IMPORTANCE_RANK[minimum];
}
