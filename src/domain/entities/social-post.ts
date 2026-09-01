/**
 * Lightweight fictional social / analyst reactions.
 * Separate from MediaItem so posts can reference games, players, or stories.
 */

import type { EventSourceRef, ImportanceLevel } from "@/domain/entities/event-source";
import type { MediaItemId, SocialPostId } from "@/domain/ids";

export type SocialAuthorType =
  | "analyst"
  | "fan"
  | "team"
  | "player"
  | "league";

export type SocialPost = {
  id: SocialPostId;
  occurredOn: string;
  authorType: SocialAuthorType;
  authorLabel: string;
  content: string;
  relatedMediaId?: MediaItemId;
  relatedSource?: EventSourceRef;
  importance: ImportanceLevel;
};

/** Bounded social presentation cache. */
export const SOCIAL_FEED_MAX = 300;

export type SocialFeedState = {
  posts: SocialPost[];
};

export function createEmptySocialFeed(): SocialFeedState {
  return { posts: [] };
}
