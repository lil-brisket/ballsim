/**
 * Media feed presentation cache — not authoritative history.
 * Authoritative facts remain in seasonEventLog / games / awards.
 */

import type { EventSourceRef, ImportanceLevel } from "@/domain/entities/event-source";
import type {
  GameId,
  MediaItemId,
  PlayerId,
  TeamId,
} from "@/domain/ids";

export type MediaStoryType =
  | "game"
  | "transaction"
  | "injury"
  | "league"
  | "player";

/** Top-level Media Hub tabs (MVP). */
export type MediaHubTab =
  | "latest"
  | "team"
  | "transactions"
  | "league"
  | "social";

/** Optional chips under the Latest tab only. */
export type MediaLatestFilter = "all" | "game" | "player" | "trends";

export type MediaItemStatus = "confirmed";

export type MediaItem = {
  id: MediaItemId;
  source: EventSourceRef;
  sourceKey: string;
  /** Optional thread id for related developments (trade → debut → big game). */
  storyGroupId?: string;
  occurredOn: string;
  storyType: MediaStoryType;
  importance: ImportanceLevel;
  /** 0–100 personalization score for the owning franchise. */
  relevanceScore: number;
  headline: string;
  summary: string;
  status: MediaItemStatus;
  teamIds?: TeamId[];
  playerIds?: PlayerId[];
  gameId?: GameId;
  href: string;
};

/** Bounded presentation cache size (MVP). History lives in event logs. */
export const MEDIA_FEED_MAX = 500;

export type MediaFeedState = {
  items: MediaItem[];
};

export type MediaReadEntry = {
  readAt?: string;
  dismissedAt?: string;
};

export type MediaReadState = Record<string, MediaReadEntry>;

export function createEmptyMediaFeed(): MediaFeedState {
  return { items: [] };
}

export function createEmptyMediaReadState(): MediaReadState {
  return {};
}

export function isMediaUnread(
  item: MediaItem,
  readState: MediaReadState,
): boolean {
  const entry = readState[item.id];
  return !entry?.readAt && !entry?.dismissedAt;
}
