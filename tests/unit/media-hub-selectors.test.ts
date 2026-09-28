import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { MediaItem, MediaStoryType } from "@/domain/entities/media-item";
import { asMediaItemId, asSocialPostId } from "@/domain/ids";
import { pickFeaturedStoryId } from "@/components/media-hub/media-importance-tiers";
import { createTestGameState } from "../factories/game-state";
import { toFranchiseBusinessView } from "@/state/franchise-selectors";
import { withOwnedFranchise } from "@/state/owner-context";
import { toMediaHubView } from "@/state/media-hub-selectors";
import type { GameState } from "@/state/game-state";
import type { SocialPost } from "@/domain/entities/social-post";

function mediaItem(input: {
  id: string;
  storyType: MediaStoryType;
  importance: ImportanceLevel;
  occurredOn: string;
  relevanceScore?: number;
  headline?: string;
}): MediaItem {
  return {
    id: asMediaItemId(input.id),
    source: { type: "award", id: input.id },
    sourceKey: `test:${input.id}`,
    occurredOn: input.occurredOn,
    storyType: input.storyType,
    importance: input.importance,
    relevanceScore: input.relevanceScore ?? 50,
    headline: input.headline ?? input.id,
    summary: "summary",
    status: "confirmed",
    href: "/media",
  };
}

function withFeed(
  state: GameState,
  items: MediaItem[],
  posts: SocialPost[] = [],
  readIds: string[] = [],
): GameState {
  const currentDate = state.world.calendar.currentDate;
  const readState = Object.fromEntries(
    readIds.map((id) => [id, { readAt: currentDate }]),
  );
  return withOwnedFranchise(
    state,
    state.user.activeOwnerTeamId,
    (franchise) => ({
      ...franchise,
      mediaFeed: { items },
      socialFeed: { posts },
      mediaReadState: readState,
    }),
  );
}

describe("toMediaHubView", () => {
  it("returns zero counts and null featured on an empty feed", () => {
    const state = createTestGameState({ saveId: "media_hub_empty" });
    const view = toMediaHubView(state, {});
    expect(view.unreadCount).toBe(0);
    expect(view.totalStories).toBe(0);
    expect(view.majorStoryCount).toBe(0);
    expect(view.recentStoryCount).toBe(0);
    expect(view.storyTypeCounts).toEqual({
      game: 0,
      transaction: 0,
      injury: 0,
      league: 0,
      player: 0,
    });
    expect(view.featuredStoryId).toBeNull();
    expect(view.featuredStory).toBeNull();
    expect(view.items).toEqual([]);
  });

  it("counts unread and major stories from the full franchise feed", () => {
    const state = createTestGameState({ saveId: "media_hub_counts" });
    const today = state.world.calendar.currentDate;
    const items = [
      mediaItem({
        id: "maj",
        storyType: "game",
        importance: "high",
        occurredOn: today,
      }),
      mediaItem({
        id: "crit",
        storyType: "player",
        importance: "critical",
        occurredOn: today,
      }),
      mediaItem({
        id: "low",
        storyType: "league",
        importance: "low",
        occurredOn: today,
      }),
    ];
    const view = toMediaHubView(withFeed(state, items, [], ["low"]), {});
    expect(view.totalStories).toBe(3);
    expect(view.majorStoryCount).toBe(2);
    expect(view.unreadCount).toBe(2);
    expect(view.storyTypeCounts.game).toBe(1);
    expect(view.storyTypeCounts.player).toBe(1);
    expect(view.storyTypeCounts.league).toBe(1);
  });

  it("sets featuredStoryId to pickFeaturedStoryId of the current tab items", () => {
    const state = createTestGameState({ saveId: "media_hub_featured" });
    const today = state.world.calendar.currentDate;
    const items = [
      mediaItem({
        id: "low_rel",
        storyType: "game",
        importance: "low",
        relevanceScore: 99,
        occurredOn: today,
      }),
      mediaItem({
        id: "high_story",
        storyType: "game",
        importance: "high",
        relevanceScore: 10,
        occurredOn: today,
      }),
    ];
    const view = toMediaHubView(withFeed(state, items), {});
    const expected = pickFeaturedStoryId(
      items.map((item) => ({
        id: item.id,
        importance: item.importance,
        relevanceScore: item.relevanceScore,
        occurredOn: item.occurredOn,
      })),
    );
    expect(view.featuredStoryId).toBe(expected);
    expect(view.featuredStory?.id).toBe("high_story");
  });

  it("returns null featured when no major-tier story exists", () => {
    const state = createTestGameState({ saveId: "media_hub_no_major" });
    const today = state.world.calendar.currentDate;
    const items = [
      mediaItem({
        id: "med",
        storyType: "league",
        importance: "medium",
        occurredOn: today,
      }),
    ];
    const view = toMediaHubView(withFeed(state, items), {});
    expect(pickFeaturedStoryId(items)).toBeNull();
    expect(view.featuredStoryId).toBeNull();
    expect(view.featuredStory).toBeNull();
  });

  it("passes franchiseAttention through from toFranchiseBusinessView", () => {
    const state = createTestGameState({ saveId: "media_hub_attention" });
    const biz = toFranchiseBusinessView(state);
    const view = toMediaHubView(state, {});
    expect(view.franchiseAttention.mediaAttention).toBe(biz.mediaAttention);
    expect(view.franchiseAttention.awareness).toBe(biz.awareness);
    expect(view.franchiseAttention.fanSentiment).toBe(biz.fanSentiment);
    expect(view.franchiseAttention.reputation).toBe(biz.reputation);
  });

  it("passes tab and filter params through unchanged", () => {
    const state = createTestGameState({ saveId: "media_hub_params" });
    const view = toMediaHubView(state, { tab: "games", filter: "player" });
    expect(view.tab).toBe("games");
    expect(view.latestFilter).toBe("player");
  });

  it("maps unknown tab and filter to latest and all", () => {
    const state = createTestGameState({ saveId: "media_hub_unknown" });
    const view = toMediaHubView(state, { tab: "nope", filter: "nope" });
    expect(view.tab).toBe("latest");
    expect(view.latestFilter).toBe("all");
  });

  it("counts recent stories inclusively within seven calendar days and excludes future dates", () => {
    const state = createTestGameState({ saveId: "media_hub_recent" });
    const today = state.world.calendar.currentDate;
    const items = [
      mediaItem({
        id: "today",
        storyType: "game",
        importance: "medium",
        occurredOn: today,
      }),
      mediaItem({
        id: "week",
        storyType: "player",
        importance: "medium",
        occurredOn: addCalendarDays(today, -7),
      }),
      mediaItem({
        id: "old",
        storyType: "injury",
        importance: "medium",
        occurredOn: addCalendarDays(today, -8),
      }),
      mediaItem({
        id: "future",
        storyType: "transaction",
        importance: "medium",
        occurredOn: addCalendarDays(today, 1),
      }),
    ];
    const view = toMediaHubView(withFeed(state, items), {});
    expect(view.recentStoryCount).toBe(2);
  });

  it("keeps franchise-wide overview metrics on the social tab", () => {
    const state = createTestGameState({ saveId: "media_hub_social" });
    const today = state.world.calendar.currentDate;
    const items = [
      mediaItem({
        id: "maj",
        storyType: "game",
        importance: "high",
        occurredOn: today,
      }),
      mediaItem({
        id: "low",
        storyType: "league",
        importance: "low",
        occurredOn: today,
      }),
    ];
    const posts: SocialPost[] = [
      {
        id: asSocialPostId("post_1"),
        occurredOn: today,
        authorType: "fan",
        authorLabel: "Fan",
        content: "reaction",
        relatedMediaId: asMediaItemId("maj"),
        importance: "medium",
      },
    ];
    const view = toMediaHubView(withFeed(state, items, posts), {
      tab: "social",
    });
    expect(view.tab).toBe("social");
    expect(view.items).toEqual([]);
    expect(view.featuredStoryId).toBeNull();
    expect(view.featuredStory).toBeNull();
    expect(view.totalStories).toBe(2);
    expect(view.majorStoryCount).toBe(1);
    expect(view.unreadCount).toBe(2);
    expect(view.socialPosts).toHaveLength(1);
    expect(view.socialPosts[0]?.relatedHeadline).toBe("maj");
  });
});
