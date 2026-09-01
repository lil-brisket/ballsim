/**
 * Convert DomainEvents into Media Hub feed items + social posts.
 * Presentation cache only — does not mutate authoritative history.
 */

import type {
  MediaFeedState,
  MediaItem,
  MediaStoryType,
} from "@/domain/entities/media-item";
import { MEDIA_FEED_MAX } from "@/domain/entities/media-item";
import type { SocialFeedState, SocialPost } from "@/domain/entities/social-post";
import { SOCIAL_FEED_MAX } from "@/domain/entities/social-post";
import type { DomainEvent } from "@/domain/events";
import type { GameId, TeamId } from "@/domain/ids";
import { asMediaItemId } from "@/domain/ids";
import { toSourceKey } from "@/domain/entities/event-source";
import type { GameState } from "@/state/game-state";
import { getDomainEventPolicy } from "@/systems/event-registry";
import {
  generateHeadline,
  relatedIdsFromEvent,
} from "@/systems/media-hub/generate-headline";
import { generateSocialPosts } from "@/systems/media-hub/generate-social-posts";
import { computeRelevanceScore } from "@/systems/media-hub/relevance";

export type ProcessMediaOptions = {
  /** Franchise the feed is personalized for. */
  teamId: TeamId;
};

export type ProcessMediaResult = {
  mediaFeed: MediaFeedState;
  socialFeed: SocialFeedState;
  /** Newly created media items this pass (already merged into mediaFeed). */
  items: MediaItem[];
  /** Newly created social posts this pass (already merged into socialFeed). */
  socialPosts: SocialPost[];
};

function storyTypeForEvent(event: DomainEvent): MediaStoryType {
  switch (event.type) {
    case "GameCompleted":
    case "HomeGameDaySettled":
      return "game";
    case "PlayerInjured":
      return "injury";
    case "ContractSigned":
    case "PlayerTraded":
    case "PlayerReleased":
    case "FreeAgentSigned":
    case "FreeAgencyOfferInvalidated":
    case "FreeAgencyOfferWithdrawn":
    case "RfaQualifyingOfferIssued":
    case "RfaOfferSheetExpired":
    case "TradeOfferExpired":
      return "transaction";
    case "PlayerDeveloped":
    case "PlayerDeclined":
    case "PlayerRetired":
    case "PlayerAssignedToDevelopmentLeague":
    case "PlayerRecalledFromDevelopmentLeague":
    case "PlayerGraduatedFromDevelopmentLeague":
      return "player";
    default:
      return "league";
  }
}

function hrefForItem(sourceKey: string): string {
  return `/media/${encodeURIComponent(sourceKey)}`;
}

function prependBoundedMedia(
  existing: MediaItem[],
  additions: MediaItem[],
): MediaItem[] {
  if (additions.length === 0) {
    return existing.slice(0, MEDIA_FEED_MAX);
  }
  const merged = [...additions, ...existing];
  return merged.slice(0, MEDIA_FEED_MAX);
}

function prependBoundedSocial(
  existing: SocialPost[],
  additions: SocialPost[],
): SocialPost[] {
  if (additions.length === 0) {
    return existing.slice(0, SOCIAL_FEED_MAX);
  }
  const merged = [...additions, ...existing];
  return merged.slice(0, SOCIAL_FEED_MAX);
}

/**
 * Process domain events into media + social presentation caches for one franchise.
 */
export function processMediaFromEvents(
  state: GameState,
  events: readonly DomainEvent[],
  options: ProcessMediaOptions,
  existingMedia: MediaFeedState = { items: [] },
  existingSocial: SocialFeedState = { posts: [] },
): ProcessMediaResult {
  const existingKeys = new Set(existingMedia.items.map((item) => item.sourceKey));
  const existingSocialIds = new Set(existingSocial.posts.map((post) => post.id));

  const newItems: MediaItem[] = [];
  const newPosts: SocialPost[] = [];

  for (const event of events) {
    const policy = getDomainEventPolicy(event.type);
    if (!policy.media.generate) {
      continue;
    }

    const source = { type: "domain_event" as const, id: event.id };
    const sourceKey = toSourceKey(source);
    if (existingKeys.has(sourceKey)) {
      continue;
    }
    existingKeys.add(sourceKey);

    const related = relatedIdsFromEvent(event);
    const { headline, summary } = generateHeadline(event, state);
    const mediaId = asMediaItemId(`media_${sourceKey}`);
    const storyGroupId =
      event.type === "PlayerTraded" && related.tradeId
        ? `trade_${related.tradeId}`
        : event.type === "PlayerTraded"
          ? `trade_${[...related.teamIds].sort().join("_")}_${event.occurredOn}`
          : undefined;

    const item: MediaItem = {
      id: mediaId,
      source,
      sourceKey,
      storyGroupId,
      occurredOn: event.occurredOn,
      storyType: storyTypeForEvent(event),
      importance: policy.media.importance,
      relevanceScore: computeRelevanceScore(
        state,
        related.teamIds,
        related.playerIds,
        { viewerTeamId: options.teamId },
      ),
      headline,
      summary,
      status: "confirmed",
      teamIds: related.teamIds.length > 0 ? related.teamIds : undefined,
      playerIds: related.playerIds.length > 0 ? related.playerIds : undefined,
      gameId: related.gameId ? (related.gameId as GameId) : undefined,
      href: hrefForItem(sourceKey),
    };

    newItems.push(item);

    const posts = generateSocialPosts({
      event,
      state,
      sourceKey,
      importance: policy.media.importance,
      relatedMediaId: mediaId,
    });
    for (const post of posts) {
      if (existingSocialIds.has(post.id)) {
        continue;
      }
      existingSocialIds.add(post.id);
      newPosts.push(post);
    }
  }

  // Newest first: events arrive chronologically; reverse new batch so latest leads.
  const orderedItems = [...newItems].reverse();
  const orderedPosts = [...newPosts].reverse();

  return {
    mediaFeed: {
      items: prependBoundedMedia(existingMedia.items, orderedItems),
    },
    socialFeed: {
      posts: prependBoundedSocial(existingSocial.posts, orderedPosts),
    },
    items: orderedItems,
    socialPosts: orderedPosts,
  };
}
