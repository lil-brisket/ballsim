/**
 * Deterministic fictional social / analyst reactions for Media Hub.
 */

import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { SocialAuthorType, SocialPost } from "@/domain/entities/social-post";
import type { DomainEvent } from "@/domain/events";
import type { MediaItemId } from "@/domain/ids";
import { asSocialPostId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { socialBoundsForImportance } from "@/systems/event-registry";
import {
  generateHeadline,
  relatedIdsFromEvent,
} from "@/systems/media-hub/generate-headline";

const AUTHOR_CYCLE: readonly SocialAuthorType[] = [
  "analyst",
  "fan",
  "team",
  "league",
] as const;

const AUTHOR_LABELS: Record<SocialAuthorType, string> = {
  analyst: "League Insider",
  fan: "Fan Voice",
  team: "Team Account",
  player: "Player Account",
  league: "League Official",
};

function postCountForImportance(importance: ImportanceLevel): number {
  const bounds = socialBoundsForImportance(importance);
  if (bounds.maxPosts <= 0) {
    return 0;
  }
  if (bounds.minPosts > 0) {
    return bounds.minPosts;
  }
  // medium/high with min 0: emit one post when the tier allows social.
  return 1;
}

function contentForAuthor(
  authorType: SocialAuthorType,
  headline: string,
  index: number,
): string {
  switch (authorType) {
    case "analyst":
      return index === 0
        ? `Analysis: ${headline}`
        : `Taking a closer look — ${headline}`;
    case "fan":
      return index === 0
        ? `Can't stop talking about this: ${headline}`
        : `This changes everything. ${headline}`;
    case "team":
      return index === 0
        ? `Official word: ${headline}`
        : `From the front office — ${headline}`;
    case "league":
      return index === 0
        ? `League update: ${headline}`
        : `Confirmed by the league — ${headline}`;
    case "player":
      return `From the locker room: ${headline}`;
  }
}

export type GenerateSocialPostsInput = {
  event: DomainEvent;
  state: GameState;
  sourceKey: string;
  importance: ImportanceLevel;
  relatedMediaId?: MediaItemId;
};

/**
 * Generate 0–N deterministic SocialPosts for an event.
 * IDs are derived from sourceKey + index.
 */
export function generateSocialPosts(
  input: GenerateSocialPostsInput,
): SocialPost[] {
  const count = postCountForImportance(input.importance);
  if (count <= 0) {
    return [];
  }

  const { headline } = generateHeadline(input.event, input.state);
  const related = relatedIdsFromEvent(input.event);
  const posts: SocialPost[] = [];

  for (let index = 0; index < count; index += 1) {
    const authorType = AUTHOR_CYCLE[index % AUTHOR_CYCLE.length]!;
    let authorLabel = AUTHOR_LABELS[authorType];
    if (authorType === "team" && related.teamIds[0]) {
      const team = input.state.world.teams[related.teamIds[0]];
      if (team) {
        authorLabel = `${team.city} ${team.name}`;
      }
    }

    posts.push({
      id: asSocialPostId(`social_${input.sourceKey}_${index}`),
      occurredOn: input.event.occurredOn,
      authorType,
      authorLabel,
      content: contentForAuthor(authorType, headline, index),
      relatedMediaId: input.relatedMediaId,
      relatedSource: {
        type: "domain_event",
        id: input.event.id,
      },
      importance: input.importance,
    });
  }

  return posts;
}
