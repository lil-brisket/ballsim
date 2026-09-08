/**
 * Media presentation tiers from ImportanceLevel — no new simulation mechanics.
 */

import type { ImportanceLevel } from "@/domain/entities/event-source";
import { IMPORTANCE_RANK } from "@/domain/entities/event-source";

export type MediaPresentationTier = "major" | "normal" | "background";

export function mediaPresentationTier(
  importance: ImportanceLevel,
): MediaPresentationTier {
  if (importance === "critical" || importance === "high") {
    return "major";
  }
  if (importance === "low") {
    return "background";
  }
  return "normal";
}

export type FeaturedCandidate = {
  id: string;
  importance: ImportanceLevel;
  relevanceScore: number;
  occurredOn: string;
};

/**
 * Pick featured story: highest importance, then relevance, then recency.
 */
export function pickFeaturedStoryId(
  items: readonly FeaturedCandidate[],
): string | null {
  if (items.length === 0) {
    return null;
  }
  const sorted = [...items].sort((a, b) => {
    const imp =
      IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance];
    if (imp !== 0) {
      return imp;
    }
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    const d = b.occurredOn.localeCompare(a.occurredOn);
    if (d !== 0) {
      return d;
    }
    return b.id.localeCompare(a.id);
  });
  const top = sorted[0]!;
  // Only feature major-tier stories
  if (mediaPresentationTier(top.importance) !== "major") {
    return null;
  }
  return top.id;
}
