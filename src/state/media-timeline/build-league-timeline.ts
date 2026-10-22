import { addCalendarDays } from "@/domain/calendar-date";
import type { MediaReadState } from "@/domain/entities/media-item";
import type { TeamId } from "@/domain/ids";
import { computeRelevanceScore } from "@/systems/media-hub/relevance";
import type { GameState, OwnedFranchiseState } from "@/state/game-state";
import { detectAwards } from "./detect-awards";
import { detectGames } from "./detect-games";
import { detectPerformances } from "./detect-performances";
import { detectPlayoffs } from "./detect-playoffs";
import { detectStreaks } from "./detect-streaks";
import type { DetectorInput } from "./detector-input";
import { postsFromMediaItems, sourceMediaItemIds } from "./from-media-items";
import { buildPlayoffSeriesIndex } from "./playoff-series";
import { createRefResolver } from "./refs";
import { buildSeasonContext } from "./season-context";
import {
  TIMELINE_FILTERS,
  type LeagueTimeline,
  type TimelineFilter,
  type TimelinePost,
  type TimelineScore,
  type TimelineTrend,
} from "./types";

export const TIMELINE_LIMITS = {
  /** League-wide posts kept per day; exempt posts are never capped. */
  dailyLeagueCap: 6,
  /** Posts can be unread only within this many days of the current date. */
  unreadWindowDays: 7,
  /** Top story looks back this many game days. */
  topStoryGameDays: 3,
  /** Trending counts tags over this many game days. */
  trendingGameDays: 7,
  trendingCount: 5,
  pageSize: 20,
} as const;

export type BuildLeagueTimelineOptions = {
  /** Defaults to the active owned franchise. */
  viewerTeamId?: string;
  filter?: TimelineFilter;
  /** Cursor from a previous page (`nextCursor`). */
  before?: string | null;
  limit?: number;
  /** Only posts carrying this tag (team abbreviation or award name). */
  tag?: string | null;
  /** Leave one post out of the feed (the top story shown above it). */
  excludePostId?: string | null;
};

type FullTimeline = {
  posts: TimelinePost[];
  topStory: TimelinePost | null;
  scores: TimelineScore[];
  trending: TimelineTrend[];
  unreadCount: number;
};

const cache = new WeakMap<GameState, Map<string, FullTimeline>>();

export function parseTimelineFilter(
  value: string | null | undefined,
): TimelineFilter {
  return (TIMELINE_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as TimelineFilter)
    : "for-you";
}

export function buildLeagueTimeline(
  state: GameState,
  options: BuildLeagueTimelineOptions = {},
): LeagueTimeline {
  const viewerTeamId = options.viewerTeamId ?? state.user.activeOwnerTeamId;
  const full = getFullTimeline(state, viewerTeamId);
  const filter = options.filter ?? "for-you";
  const limit = Math.max(1, options.limit ?? TIMELINE_LIMITS.pageSize);
  const tag = options.tag ?? null;
  const excluded = options.excludePostId ?? null;
  const filtered = full.posts.filter(
    (post) =>
      post.id !== excluded &&
      (tag === null || post.tags.includes(tag)) &&
      matchesFilter(post, filter, viewerTeamId),
  );
  const start = cursorStart(filtered, options.before ?? null);
  const page = filtered.slice(start, start + limit);
  const last = page[page.length - 1];
  return {
    posts: page,
    nextCursor:
      last && start + limit < filtered.length
        ? `${last.occurredOn}|${last.id}`
        : null,
    topStory: full.topStory,
    scores: full.scores,
    trending: full.trending,
    unreadCount: full.unreadCount,
  };
}

/** Ids of every unread post, for "Mark all read". */
export function listUnreadTimelinePostIds(
  state: GameState,
  viewerTeamId: string = state.user.activeOwnerTeamId,
): string[] {
  return getFullTimeline(state, viewerTeamId)
    .posts.filter((post) => post.unread)
    .map((post) => post.id);
}

function getFullTimeline(state: GameState, viewerTeamId: string): FullTimeline {
  let byViewer = cache.get(state);
  if (!byViewer) {
    byViewer = new Map();
    cache.set(state, byViewer);
  }
  const cached = byViewer.get(viewerTeamId);
  if (cached) return cached;
  const built = buildFullTimeline(state, viewerTeamId);
  byViewer.set(viewerTeamId, built);
  return built;
}

function buildFullTimeline(
  state: GameState,
  viewerTeamId: string,
): FullTimeline {
  const currentDate = state.world.calendar.currentDate;
  const ctx = buildSeasonContext(state);
  const input: DetectorInput = {
    state,
    ctx,
    refs: createRefResolver(state),
    series: buildPlayoffSeriesIndex(state),
    viewerTeamId,
  };
  const franchise = state.user.ownedFranchises[viewerTeamId] ?? null;

  const derived = [
    ...detectGames(input),
    ...detectPerformances(input),
    ...detectStreaks(input),
    ...detectAwards(input),
    ...detectPlayoffs(input),
  ];
  const relevanceByTeams = new Map<string, number>();
  for (const post of derived) {
    const key = [...post.teamIds].sort().join("|");
    let relevance = relevanceByTeams.get(key);
    if (relevance === undefined) {
      relevance = computeRelevanceScore(
        state,
        post.teamIds as TeamId[],
        undefined,
        { viewerTeamId: viewerTeamId as TeamId },
      );
      relevanceByTeams.set(key, relevance);
    }
    post.relevance = relevance;
  }

  const all = [
    ...derived,
    ...(franchise ? postsFromMediaItems(input, franchise) : []),
  ].filter((post) => post.occurredOn <= currentDate);

  const pastGameDays = ctx.gameDays.filter((day) => day <= currentDate);
  const sorted = sortPosts(all);
  // Chosen before the cap so relevance can't push the night's story out.
  const topStory = pickTopStory(sorted, pastGameDays);
  const posts = capPerDay(sorted, viewerTeamId, topStory?.id ?? null);

  const unreadFrom = addCalendarDays(
    currentDate,
    -TIMELINE_LIMITS.unreadWindowDays,
  );
  let unreadCount = 0;
  if (franchise) {
    for (const post of posts) {
      post.unread =
        post.occurredOn > unreadFrom &&
        !isRead(post, franchise, franchise.mediaReadState);
      if (post.unread) unreadCount += 1;
    }
  }

  return {
    posts,
    topStory,
    scores: latestScores(input, pastGameDays),
    trending: trendingTags(posts, pastGameDays),
    unreadCount,
  };
}

function rankScore(post: TimelinePost): number {
  return post.notability + post.relevance;
}

/** Newest day first; inside a day by notability + relevance, then id. */
function sortPosts(posts: TimelinePost[]): TimelinePost[] {
  return posts.sort(
    (a, b) =>
      (a.occurredOn === b.occurredOn
        ? 0
        : a.occurredOn > b.occurredOn
          ? -1
          : 1) ||
      rankScore(b) - rankScore(a) ||
      a.id.localeCompare(b.id),
  );
}

export function isCapExempt(post: TimelinePost, viewerTeamId: string): boolean {
  return (
    post.kind === "award" ||
    post.kind === "playoff" ||
    post.importance === "critical" ||
    post.teamIds.includes(viewerTeamId)
  );
}

/** Keep at most `dailyLeagueCap` non-exempt posts per day (input is sorted). */
function capPerDay(
  posts: TimelinePost[],
  viewerTeamId: string,
  topStoryId: string | null,
): TimelinePost[] {
  const kept: TimelinePost[] = [];
  let day: string | null = null;
  let leagueCount = 0;
  for (const post of posts) {
    if (post.occurredOn !== day) {
      day = post.occurredOn;
      leagueCount = 0;
    }
    if (post.id === topStoryId || isCapExempt(post, viewerTeamId)) {
      kept.push(post);
      continue;
    }
    if (leagueCount < TIMELINE_LIMITS.dailyLeagueCap) {
      kept.push(post);
      leagueCount += 1;
    }
  }
  return kept;
}

function isRead(
  post: TimelinePost,
  franchise: OwnedFranchiseState,
  readState: MediaReadState,
): boolean {
  const ids = [post.id, ...sourceMediaItemIds(post, franchise)];
  return ids.some((id) => {
    const entry = readState[id];
    return Boolean(entry?.readAt || entry?.dismissedAt);
  });
}

export function matchesFilter(
  post: TimelinePost,
  filter: TimelineFilter,
  viewerTeamId: string,
): boolean {
  switch (filter) {
    case "for-you":
      return true;
    case "your-team":
      return post.teamIds.includes(viewerTeamId);
    case "league":
      return !post.teamIds.includes(viewerTeamId);
    case "scores":
      return (
        post.kind === "game" ||
        post.kind === "performance" ||
        post.kind === "streak" ||
        post.kind === "playoff"
      );
    case "moves":
      return (
        post.kind === "trade" ||
        post.kind === "signing" ||
        post.kind === "transaction"
      );
    case "injuries":
      return post.kind === "injury";
    case "awards":
      return post.kind === "award";
  }
}

/** Position after the cursor post; falls back to the cursor's date. */
function cursorStart(posts: TimelinePost[], cursor: string | null): number {
  if (!cursor) return 0;
  const separator = cursor.indexOf("|");
  if (separator < 0) return 0;
  const date = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  const index = posts.findIndex((post) => post.id === id);
  if (index >= 0) return index + 1;
  const next = posts.findIndex((post) => post.occurredOn < date);
  return next < 0 ? posts.length : next;
}

function pickTopStory(
  posts: TimelinePost[],
  pastGameDays: string[],
): TimelinePost | null {
  const recentDays = pastGameDays.slice(-TIMELINE_LIMITS.topStoryGameDays);
  const from =
    recentDays[0] ??
    // No games yet (preseason/offseason): look at the latest posts instead.
    [...new Set(posts.map((post) => post.occurredOn))]
      .slice(0, TIMELINE_LIMITS.topStoryGameDays)
      .pop();
  if (from === undefined) return null;
  let best: TimelinePost | null = null;
  for (const post of posts) {
    if (post.occurredOn < from) break;
    if (
      !best ||
      post.notability > best.notability ||
      (post.notability === best.notability && post.relevance > best.relevance)
    ) {
      best = post;
    }
  }
  return best;
}

function latestScores(
  input: DetectorInput,
  pastGameDays: string[],
): TimelineScore[] {
  const day = pastGameDays[pastGameDays.length - 1];
  if (!day) return [];
  return input.ctx.games
    .filter((game) => game.date === day)
    .map((game) => ({
      gameId: game.id,
      date: game.date,
      home: input.refs.team(game.homeTeamId, game.homeTeamSnapshot),
      away: input.refs.team(game.awayTeamId, game.awayTeamSnapshot),
      score: { ...game.score },
      overtimePeriods: Math.max(0, game.periodScores.length - 4),
    }));
}

function trendingTags(
  posts: TimelinePost[],
  pastGameDays: string[],
): TimelineTrend[] {
  const from = pastGameDays.slice(-TIMELINE_LIMITS.trendingGameDays)[0];
  if (from === undefined) return [];
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.occurredOn < from) break;
    for (const tag of new Set(post.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, TIMELINE_LIMITS.trendingCount);
}
