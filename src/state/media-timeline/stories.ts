/**
 * Stories strip: short themed slide decks built from recent timeline posts
 * ("Last night", "Your team", …). A ring exists only when it has slides.
 */

import { addCalendarDays } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";
import { buildLeagueTimeline } from "./build-league-timeline";
import { composeTimeline } from "./compose-post";
import {
  toTimelinePostViews,
  type TimelineDisplayContext,
  type TimelinePostView,
} from "./post-view";
import type { TimelinePost } from "./types";

export type MediaStoryKey =
  | "last-night"
  | "top-performers"
  | "your-team"
  | "awards"
  | "trade-wire"
  | "injury-report";

export type MediaStoryRing = {
  key: MediaStoryKey;
  label: string;
  /** Newest slide date; the viewer compares it with what it last saw. */
  latestOn: string;
  slides: TimelinePostView[];
};

export const STORY_SLIDE_LIMIT = 8;

type StoryDefinition = {
  key: MediaStoryKey;
  label: string;
  /** Calendar days back from the latest game day (or today). */
  days: number;
  matches(post: TimelinePost, viewerTeamId: string): boolean;
};

const STORIES: readonly StoryDefinition[] = [
  {
    key: "last-night",
    label: "Last night",
    days: 0,
    matches: (post) => post.kind === "game" || post.kind === "playoff",
  },
  {
    key: "top-performers",
    label: "Top players",
    days: 2,
    matches: (post) => post.kind === "performance",
  },
  {
    key: "your-team",
    label: "Your team",
    days: 6,
    matches: (post, viewer) => post.teamIds.includes(viewer),
  },
  {
    key: "awards",
    label: "Awards",
    days: 30,
    matches: (post) => post.kind === "award",
  },
  {
    key: "trade-wire",
    label: "Trades",
    days: 6,
    matches: (post) =>
      post.kind === "trade" ||
      post.kind === "signing" ||
      post.kind === "transaction",
  },
  {
    key: "injury-report",
    label: "Injuries",
    days: 6,
    matches: (post) => post.kind === "injury",
  },
];

export function buildMediaStories(
  state: GameState,
  saveId: string,
): { rings: MediaStoryRing[]; context: TimelineDisplayContext } {
  const viewerTeamId = state.user.activeOwnerTeamId;
  const timeline = buildLeagueTimeline(state, { limit: 1_000 });
  const anchor = timeline.scores[0]?.date ?? state.world.calendar.currentDate;

  const groups: Array<{ definition: StoryDefinition; posts: TimelinePost[] }> =
    [];
  for (const definition of STORIES) {
    const from = addCalendarDays(anchor, -definition.days);
    const posts = timeline.posts
      .filter(
        (post) =>
          post.occurredOn >= from &&
          (definition.key !== "last-night" || post.occurredOn === anchor) &&
          definition.matches(post, viewerTeamId),
      )
      .slice(0, STORY_SLIDE_LIMIT);
    if (posts.length > 0) groups.push({ definition, posts });
  }

  // One view pass so every slide shares one display context.
  const composed = groups.flatMap((group) =>
    composeTimeline(state, group.posts),
  );
  const views = toTimelinePostViews(state, saveId, composed);
  let offset = 0;
  const rings = groups.map(({ definition, posts }) => {
    const slides = views.posts.slice(offset, offset + posts.length);
    offset += posts.length;
    return {
      key: definition.key,
      label: definition.label,
      latestOn: slides.reduce(
        (latest, slide) =>
          slide.occurredOn > latest ? slide.occurredOn : latest,
        slides[0]!.occurredOn,
      ),
      slides,
    };
  });
  return { rings, context: views.context };
}
