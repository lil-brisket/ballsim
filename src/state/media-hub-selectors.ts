/**
 * Media Hub view model — tab-filtered stories, overview metrics, featured id.
 * Presentation only: reuses pickFeaturedStoryId and isMediaUnread as-is.
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import { IMPORTANCE_RANK } from "@/domain/entities/event-source";
import {
  isMediaUnread,
  type MediaHubTab,
  type MediaItem,
  type MediaLatestFilter,
  type MediaStoryType,
} from "@/domain/entities/media-item";
import type {
  SocialAuthorType,
  SocialPost,
} from "@/domain/entities/social-post";
import type { TeamId } from "@/domain/ids";
import {
  mediaPresentationTier,
  pickFeaturedStoryId,
} from "@/components/media-hub/media-importance-tiers";
import type { GameState } from "@/state/game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import { toFranchiseBusinessView } from "@/state/franchise-selectors";
import { resolveTeamHref } from "@/state/resolve-team-href";
import { canOpenGameBoxScore, isPlayerInOwnerScope } from "@/state/selectors";

const STORY_TYPES: readonly MediaStoryType[] = [
  "game",
  "transaction",
  "injury",
  "league",
  "player",
];

const EMPTY_STORY_TYPE_COUNTS: Record<MediaStoryType, number> = {
  game: 0,
  transaction: 0,
  injury: 0,
  league: 0,
  player: 0,
};

export type MediaStoryEntityView = {
  id: string;
  name: string;
  canOpen?: boolean;
  href?: string;
  abbreviation?: string;
};

export type MediaStoryView = {
  id: string;
  headline: string;
  summary: string;
  occurredOn: string;
  storyType: MediaStoryType;
  importance: ImportanceLevel;
  relevanceScore: number;
  unread: boolean;
  gameId?: string;
  canOpenGame: boolean;
  players: MediaStoryEntityView[];
  teams: MediaStoryEntityView[];
  reactionCount: number;
};

export type SocialPostView = {
  id: string;
  occurredOn: string;
  authorType: SocialAuthorType;
  authorLabel: string;
  content: string;
  importance: ImportanceLevel;
  relatedMediaId?: string;
  relatedHeadline?: string;
};

export type MediaFranchiseAttentionView = {
  mediaAttention: number;
  awareness: number;
  fanSentiment: number;
  reputation: number;
  demandWeighted: number | null;
};

export type MediaHubView = {
  saveId: string;
  tab: MediaHubTab;
  latestFilter: MediaLatestFilter;
  items: MediaStoryView[];
  socialPosts: SocialPostView[];
  unreadCount: number;
  franchiseAttention: MediaFranchiseAttentionView;
  featuredStoryId: string | null;
  featuredStory: MediaStoryView | null;
  totalStories: number;
  majorStoryCount: number;
  recentStoryCount: number;
  storyTypeCounts: Record<MediaStoryType, number>;
};

export type MediaPageView = MediaHubView;

function toMediaStoryView(
  state: GameState,
  saveId: string,
  item: MediaItem,
): MediaStoryView {
  const readState = getActiveOwnedFranchise(state).mediaReadState ?? {};
  const players = (item.playerIds ?? []).map((playerId) => {
    const player = state.world.players[playerId];
    const name = player
      ? `${player.firstName} ${player.lastName}`
      : String(playerId);
    return {
      id: playerId,
      name,
      canOpen: isPlayerInOwnerScope(state, playerId),
    };
  });
  const teams = (item.teamIds ?? []).map((teamId) => {
    const team = state.world.teams[teamId];
    return {
      id: teamId,
      name: team ? `${team.city} ${team.name}` : String(teamId),
      abbreviation: team?.abbreviation,
      href: resolveTeamHref(state, teamId, saveId),
    };
  });
  const gameId = item.gameId ? String(item.gameId) : undefined;
  return {
    id: item.id,
    headline: item.headline,
    summary: item.summary,
    occurredOn: item.occurredOn,
    storyType: item.storyType,
    importance: item.importance,
    relevanceScore: item.relevanceScore,
    unread: isMediaUnread(item, readState),
    gameId,
    canOpenGame: gameId ? canOpenGameBoxScore(state, gameId) : false,
    players,
    teams,
    reactionCount: 0,
  };
}

function toSocialPostView(
  post: SocialPost,
  headlineByMediaId?: Map<string, string>,
): SocialPostView {
  const relatedMediaId = post.relatedMediaId
    ? String(post.relatedMediaId)
    : undefined;
  return {
    id: post.id,
    occurredOn: post.occurredOn,
    authorType: post.authorType,
    authorLabel: post.authorLabel,
    content: post.content,
    importance: post.importance,
    relatedMediaId,
    relatedHeadline: relatedMediaId
      ? headlineByMediaId?.get(relatedMediaId)
      : undefined,
  };
}

function matchesLatestFilter(
  item: MediaItem,
  filter: MediaLatestFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "game") {
    return item.storyType === "game";
  }
  if (filter === "player") {
    return item.storyType === "player" || item.storyType === "injury";
  }
  // trends: high-signal league/player developments
  return (
    item.importance === "critical" ||
    item.importance === "high" ||
    item.storyType === "injury"
  );
}

function filterMediaItemsForTab(
  items: readonly MediaItem[],
  tab: MediaHubTab,
  latestFilter: MediaLatestFilter,
  activeTeamId: TeamId,
): MediaItem[] {
  if (tab === "social") {
    return [];
  }
  if (tab === "transactions") {
    return items.filter((item) => item.storyType === "transaction");
  }
  if (tab === "games") {
    return items.filter((item) => item.storyType === "game");
  }
  if (tab === "injuries") {
    return items.filter((item) => item.storyType === "injury");
  }
  if (tab === "league") {
    return items.filter((item) => item.storyType === "league");
  }
  if (tab === "team") {
    return items.filter(
      (item) =>
        (item.teamIds?.includes(activeTeamId) ?? false) ||
        item.relevanceScore >= 40,
    );
  }
  // latest
  return items.filter((item) => matchesLatestFilter(item, latestFilter));
}

function parseMediaHubTab(raw: string | undefined): MediaHubTab {
  switch (raw) {
    case "team":
    case "transactions":
    case "games":
    case "injuries":
    case "league":
    case "social":
      return raw;
    default:
      return "latest";
  }
}

function parseMediaLatestFilter(raw: string | undefined): MediaLatestFilter {
  switch (raw) {
    case "game":
    case "player":
    case "trends":
      return raw;
    default:
      return "all";
  }
}

function emptyStoryTypeCounts(): Record<MediaStoryType, number> {
  return { ...EMPTY_STORY_TYPE_COUNTS };
}

function countStoryTypes(
  items: readonly MediaItem[],
): Record<MediaStoryType, number> {
  const counts = emptyStoryTypeCounts();
  for (const item of items) {
    counts[item.storyType] += 1;
  }
  return counts;
}

function isRecentStory(occurredOn: string, currentDate: string): boolean {
  const days = calendarDaysBetween(occurredOn, currentDate);
  return days >= 0 && days <= 7;
}

/**
 * League Media Hub page model. Empty feeds return zero counts and null featured.
 */
export function toMediaHubView(
  state: GameState,
  opts: { tab?: string; filter?: string } = {},
): MediaHubView {
  const saveId = state.meta.saveId;
  const franchise = getActiveOwnedFranchise(state);
  const mediaFeed = franchise.mediaFeed ?? { items: [] };
  const socialFeed = franchise.socialFeed ?? { posts: [] };
  const readState = franchise.mediaReadState ?? {};
  const tab = parseMediaHubTab(opts.tab);
  const latestFilter = parseMediaLatestFilter(opts.filter);
  const activeTeamId = state.user.activeOwnerTeamId;
  const currentDate = state.world.calendar.currentDate;

  const franchiseItems = mediaFeed.items;
  const filteredItems = filterMediaItemsForTab(
    franchiseItems,
    tab,
    latestFilter,
    activeTeamId,
  );
  const featuredCandidateItems = filteredItems;

  // Stable ordering: importance → relevance → date → id
  const sortedItems = [...filteredItems].sort((a, b) => {
    const imp = IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance];
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

  const unreadCount = franchiseItems.filter((item) =>
    isMediaUnread(item, readState),
  ).length;

  const biz = toFranchiseBusinessView(state);
  const mediaContributor = biz.forecast.demandContributors.find(
    (c) => c.key === "mediaAttention",
  );

  const reactionCountByMedia = new Map<string, number>();
  for (const post of socialFeed.posts) {
    if (post.relatedMediaId) {
      const key = String(post.relatedMediaId);
      reactionCountByMedia.set(key, (reactionCountByMedia.get(key) ?? 0) + 1);
    }
  }

  const headlineByMediaId = new Map(
    franchiseItems.map((item) => [item.id, item.headline] as const),
  );

  const items = sortedItems.map((item) => {
    const view = toMediaStoryView(state, saveId, item);
    return {
      ...view,
      reactionCount: reactionCountByMedia.get(item.id) ?? 0,
    };
  });

  const featuredStoryId = pickFeaturedStoryId(
    featuredCandidateItems.map((item) => ({
      id: item.id,
      importance: item.importance,
      relevanceScore: item.relevanceScore,
      occurredOn: item.occurredOn,
    })),
  );
  const featuredStory = featuredStoryId
    ? (items.find((item) => item.id === featuredStoryId) ?? null)
    : null;

  return {
    saveId,
    tab,
    latestFilter,
    items,
    socialPosts:
      tab === "social"
        ? socialFeed.posts.map((post) =>
            toSocialPostView(post, headlineByMediaId),
          )
        : [],
    unreadCount,
    franchiseAttention: {
      mediaAttention: biz.mediaAttention,
      awareness: biz.awareness,
      fanSentiment: biz.fanSentiment,
      reputation: biz.reputation,
      demandWeighted: mediaContributor ? mediaContributor.weighted : null,
    },
    featuredStoryId,
    featuredStory,
    totalStories: franchiseItems.length,
    majorStoryCount: franchiseItems.filter(
      (item) => mediaPresentationTier(item.importance) === "major",
    ).length,
    recentStoryCount: franchiseItems.filter((item) =>
      isRecentStory(item.occurredOn, currentDate),
    ).length,
    storyTypeCounts: countStoryTypes(franchiseItems),
  };
}

export const MEDIA_HUB_STORY_TYPE_ORDER = STORY_TYPES;
