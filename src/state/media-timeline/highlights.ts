/**
 * The Media Hub's lead posts for other screens (dashboard, League hub,
 * simulation summary): the top story, then the first posts of "For you" —
 * the same order the Media Hub opens with.
 */

import type { GameState } from "@/state/game-state";
import { buildLeagueTimeline } from "./build-league-timeline";
import { composeTimeline } from "./compose-post";
import {
  toTimelinePostViews,
  type TimelineDisplayContext,
  type TimelinePostView,
} from "./post-view";

export type TimelineHighlights = {
  posts: TimelinePostView[];
  context: TimelineDisplayContext;
  unreadCount: number;
};

export const TIMELINE_HIGHLIGHTS_LIMIT = 3;

export function toTimelineHighlights(
  state: GameState,
  saveId: string,
  limit: number = TIMELINE_HIGHLIGHTS_LIMIT,
): TimelineHighlights {
  const first = buildLeagueTimeline(state, { limit: 1 });
  const top = first.topStory;
  const rest = buildLeagueTimeline(state, {
    limit: Math.max(1, limit),
    excludePostId: top?.id ?? null,
  }).posts;
  const posts = (top ? [top, ...rest] : rest).slice(0, limit);
  const views = toTimelinePostViews(
    state,
    saveId,
    composeTimeline(state, posts),
  );
  return {
    posts: views.posts,
    context: views.context,
    unreadCount: first.unreadCount,
  };
}

/** Unread count the Media Hub shows (nav badge). */
export function timelineUnreadCount(state: GameState): number {
  return buildLeagueTimeline(state, { limit: 1 }).unreadCount;
}
