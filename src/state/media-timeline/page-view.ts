/**
 * Media Hub page model: one page of the league timeline plus the rails
 * around it (filters, latest scores, trending tags, buzz).
 */

import type { GameState } from "@/state/game-state";
import { toFranchiseBusinessView } from "@/state/franchise-selectors";
import { canOpenGameBoxScore } from "@/state/selectors/box-score";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import { buildLeagueCast } from "./accounts";
import {
  buildLeagueTimeline,
  parseTimelineFilter,
} from "./build-league-timeline";
import { composeTimeline } from "./compose-post";
import { computeEngagement, engagementLabel, formatCount } from "./engagement";
import {
  relativeGameDayLabel,
  toTimelinePostViews,
  type TimelineDisplayContext,
  type TimelinePostView,
} from "./post-view";
import { formatGameDate } from "@/presentation/game-date";
import {
  TIMELINE_FILTERS,
  type TimelineFilter,
  type TimelineScore,
  type TimelineTeamRef,
} from "./types";

export const TIMELINE_FILTER_LABELS: Record<TimelineFilter, string> = {
  "for-you": "For you",
  "your-team": "Your team",
  league: "League",
  scores: "Scores",
  moves: "Moves",
  injuries: "Injuries",
  awards: "Awards",
};

const EMPTY_MESSAGES: Record<TimelineFilter, string> = {
  "for-you": "Nothing new around the league yet.",
  "your-team": "No posts about your team yet.",
  league: "Nothing from around the league yet.",
  scores: "No standout games yet.",
  moves: "No trades or signings yet.",
  injuries: "No injuries reported.",
  awards: "No awards handed out yet.",
};

/** Old `?tab=` values from the previous Media Hub. */
const LEGACY_TABS: Record<string, TimelineFilter> = {
  latest: "for-you",
  social: "for-you",
  team: "your-team",
  transactions: "moves",
  games: "scores",
  injuries: "injuries",
  league: "league",
};

/** Old Latest-tab chips that shared the `?filter=` param. */
const LEGACY_FILTERS: Record<string, TimelineFilter> = {
  all: "for-you",
  game: "scores",
  player: "for-you",
  trends: "for-you",
};

export function parseMediaPageFilter(params: {
  filter?: string | null;
  tab?: string | null;
}): TimelineFilter {
  const { filter, tab } = params;
  if (filter && (TIMELINE_FILTERS as readonly string[]).includes(filter)) {
    return filter as TimelineFilter;
  }
  if (tab && LEGACY_TABS[tab]) return LEGACY_TABS[tab];
  if (filter && LEGACY_FILTERS[filter]) return LEGACY_FILTERS[filter];
  return parseTimelineFilter(filter);
}

export type MediaFilterOption = {
  filter: TimelineFilter;
  label: string;
  href: string;
  active: boolean;
  /** Unread count, shown on "For you" only. */
  badge: number | null;
};

export type MediaScoreSide = {
  abbreviation: string;
  branding: TeamBrandingView | null;
  score: number;
};

export type MediaScoreView = {
  gameId: string;
  date: string;
  away: MediaScoreSide;
  home: MediaScoreSide;
  overtime: boolean;
  href: string | null;
};

export type MediaTrendView = { tag: string; count: number; href: string };

export type MediaTimelinePageView = {
  saveId: string;
  filter: TimelineFilter;
  tag: string | null;
  filters: MediaFilterOption[];
  /** First page of "For you" only; never repeated in `posts`. */
  topStory: TimelinePostView | null;
  posts: TimelinePostView[];
  context: TimelineDisplayContext;
  isFirstPage: boolean;
  loadMoreHref: string | null;
  /** Shown when the filtered feed is empty (never for a fresh save). */
  emptyMessage: string | null;
  scores: MediaScoreView[];
  scoresDateLabel: string | null;
  trending: MediaTrendView[];
  unreadCount: number;
  buzz: { mediaAttention: number; href: string };
  /** Current view without the page cursor, for form redirects. */
  returnPath: string;
};

export type MediaTimelinePageOptions = {
  filter?: string | null;
  tab?: string | null;
  tag?: string | null;
  before?: string | null;
};

export function mediaPageHref(
  saveId: string,
  params: {
    filter?: TimelineFilter;
    tag?: string | null;
    before?: string | null;
  } = {},
): string {
  const search = new URLSearchParams();
  if (params.filter && params.filter !== "for-you") {
    search.set("filter", params.filter);
  }
  if (params.tag) search.set("tag", params.tag);
  if (params.before) search.set("before", params.before);
  const qs = search.toString();
  return `/dashboard/${saveId}/media${qs ? `?${qs}` : ""}`;
}

export function toMediaTimelinePageView(
  state: GameState,
  saveId: string,
  options: MediaTimelinePageOptions = {},
): MediaTimelinePageView {
  const filter = parseMediaPageFilter(options);
  const tag = options.tag?.trim() ? options.tag.trim() : null;
  const before = options.before?.trim() ? options.before.trim() : null;
  const isFirstPage = before === null;

  const unfiltered = buildLeagueTimeline(state, { limit: 1 });
  const showTopStory = isFirstPage && filter === "for-you" && tag === null;
  const topStory = showTopStory ? unfiltered.topStory : null;
  const page = buildLeagueTimeline(state, {
    filter,
    tag,
    before,
    // Shown above the feed, so leave it out of the list (all pages).
    excludePostId:
      filter === "for-you" && tag === null
        ? (unfiltered.topStory?.id ?? null)
        : null,
  });
  const pagePosts = page.posts;

  const composed = composeTimeline(
    state,
    topStory ? [topStory, ...pagePosts] : pagePosts,
  );
  const views = toTimelinePostViews(state, saveId, composed);
  const topStoryView = topStory ? (views.posts[0] ?? null) : null;
  let posts = topStoryView ? views.posts.slice(1) : views.posts;

  const timelineIsEmpty = unfiltered.posts.length === 0;
  if (timelineIsEmpty && isFirstPage && filter === "for-you" && !tag) {
    posts = [welcomePost(state)];
  }

  const filters = TIMELINE_FILTERS.map((option) => ({
    filter: option,
    label: TIMELINE_FILTER_LABELS[option],
    href: mediaPageHref(saveId, { filter: option }),
    active: option === filter && tag === null,
    badge:
      option === "for-you" && unfiltered.unreadCount > 0
        ? unfiltered.unreadCount
        : null,
  }));

  const scores = unfiltered.scores.map((score) =>
    toScoreView(state, saveId, score),
  );

  return {
    saveId,
    filter,
    tag,
    filters,
    topStory: topStoryView,
    posts,
    context: views.context,
    isFirstPage,
    loadMoreHref: page.nextCursor
      ? mediaPageHref(saveId, { filter, tag, before: page.nextCursor })
      : null,
    emptyMessage:
      posts.length === 0 && topStoryView === null
        ? tag
          ? `No recent posts tagged ${tag}.`
          : EMPTY_MESSAGES[filter]
        : null,
    scores,
    scoresDateLabel: scores[0] ? formatGameDate(scores[0].date) : null,
    trending: unfiltered.trending.map((trend) => ({
      ...trend,
      href: mediaPageHref(saveId, { tag: trend.tag }),
    })),
    unreadCount: unfiltered.unreadCount,
    buzz: {
      mediaAttention: toFranchiseBusinessView(state).mediaAttention,
      href: `/dashboard/${saveId}/business`,
    },
    returnPath: mediaPageHref(saveId, { filter, tag }),
  };
}

function sideView(team: TimelineTeamRef, score: number): MediaScoreSide {
  return {
    abbreviation: team.abbreviation,
    branding: toBrandingView(team.branding),
    score,
  };
}

function toScoreView(
  state: GameState,
  saveId: string,
  score: TimelineScore,
): MediaScoreView {
  return {
    gameId: score.gameId,
    date: score.date,
    away: sideView(score.away, score.score.away),
    home: sideView(score.home, score.score.home),
    overtime: score.overtimePeriods > 0,
    href: canOpenGameBoxScore(state, score.gameId)
      ? `/dashboard/${saveId}/games/${score.gameId}`
      : null,
  };
}

/** A fresh save gets one league-office post instead of an empty box. */
function welcomePost(state: GameState): TimelinePostView {
  const cast = buildLeagueCast(state);
  const currentDate = state.world.calendar.currentDate;
  const id = "welcome";
  const engagement = computeEngagement(
    String(state.meta.saveId),
    { id, notability: 40, relevance: 0 },
    0,
  );
  return {
    id,
    kind: "league",
    occurredOn: currentDate,
    dateLabel: formatGameDate(currentDate),
    relativeLabel: relativeGameDayLabel(currentDate, currentDate),
    unread: false,
    author: cast.league,
    text: `Welcome to the ${state.world.league.name}. Scores, standout performances, trades and awards will show up here as the season unfolds.`,
    replies: [],
    engagement,
    engagementDisplay: {
      replies: formatCount(engagement.replies),
      reposts: formatCount(engagement.reposts),
      likes: formatCount(engagement.likes),
    },
    engagementLabel: engagementLabel(engagement),
    attachment: { type: "league", headline: "", summary: "" },
    boxScoreHref: null,
  };
}
