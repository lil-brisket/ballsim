/**
 * Display model for timeline components: composed posts plus everything the
 * cards need to render without reading GameState (branding views, portraits,
 * hrefs, broadcast dates).
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { TeamId } from "@/domain/ids";
import { formatGameDate } from "@/presentation/game-date";
import type { GameState } from "@/state/game-state";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { resolveTeamHref } from "@/state/resolve-team-href";
import { canOpenGameBoxScore } from "@/state/selectors/box-score";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import type { TimelineAccount } from "./accounts";
import type { ComposedPost } from "./compose-post";
import type { ComposedReply } from "./compose-replies";
import { engagementLabel, formatCount, type Engagement } from "./engagement";
import type {
  TimelineAttachment,
  TimelinePostKind,
  TimelineTeamRef,
} from "./types";

export type TimelineTeamDisplay = {
  branding: TeamBrandingView | null;
  href: string;
};

/** Lookups shared by every post on a page. */
export type TimelineDisplayContext = {
  saveId: string;
  /** Keyed by team id; covers every team in the league. */
  teams: Record<string, TimelineTeamDisplay>;
  /** Keyed by player id; covers every player shown on the page. */
  portraits: Record<string, PlayerPortraitAssignment | null>;
};

export type TimelinePostView = {
  id: string;
  kind: TimelinePostKind;
  occurredOn: string;
  /** Broadcast date, e.g. "Oct 8". */
  dateLabel: string;
  /** "Today", "1d" … "6d", then the broadcast date. */
  relativeLabel: string;
  unread: boolean;
  author: TimelineAccount;
  text: string;
  /** Hashtags in the text that link to the tag filter. */
  tags: string[];
  replies: ComposedReply[];
  engagement: Engagement;
  /** Formatted counts, e.g. { replies: "214", reposts: "1.2K", likes: "5.8K" }. */
  engagementDisplay: { replies: string; reposts: string; likes: string };
  /** "214 replies, 1.2K reposts, 5.8K likes" */
  engagementLabel: string;
  attachment: TimelineAttachment;
  /** Box score link when the game is openable (current season, final). */
  boxScoreHref: string | null;
};

export function playerHref(saveId: string, playerId: string): string {
  return `/dashboard/${saveId}/players/${playerId}`;
}

export function relativeGameDayLabel(
  occurredOn: string,
  currentDate: string,
): string {
  const days = calendarDaysBetween(occurredOn, currentDate);
  if (days <= 0) return "Today";
  if (days < 7) return `${days}d`;
  return formatGameDate(occurredOn);
}

export function toTimelinePostViews(
  state: GameState,
  saveId: string,
  composed: readonly ComposedPost[],
): { posts: TimelinePostView[]; context: TimelineDisplayContext } {
  const currentDate = state.world.calendar.currentDate;
  const teams: Record<string, TimelineTeamDisplay> = {};
  for (const team of Object.values(state.world.teams)) {
    teams[team.id] = {
      branding: toBrandingView(team.branding),
      href: resolveTeamHref(state, team.id as TeamId, saveId),
    };
  }

  const portraits: Record<string, PlayerPortraitAssignment | null> = {};
  const addPlayer = (playerId: string | null | undefined) => {
    if (playerId && !(playerId in portraits)) {
      portraits[playerId] = selectPlayerPortrait(state, playerId);
    }
  };

  const posts = composed.map((entry): TimelinePostView => {
    addPlayer(entry.author.playerId);
    for (const reply of entry.replies) addPlayer(reply.author.playerId);
    for (const playerId of attachmentPlayerIds(entry.post.attachment)) {
      addPlayer(playerId);
    }
    // Snapshot branding wins for historical names; fill teams missing from
    // the world (relocated or legacy ids) from the attachment refs.
    for (const ref of attachmentTeams(entry.post.attachment)) {
      if (!teams[ref.teamId]) {
        teams[ref.teamId] = {
          branding: toBrandingView(ref.branding),
          href: resolveTeamHref(state, ref.teamId as TeamId, saveId),
        };
      }
    }
    const gameId = entry.post.gameId;
    return {
      id: entry.post.id,
      kind: entry.post.kind,
      occurredOn: entry.post.occurredOn,
      dateLabel: formatGameDate(entry.post.occurredOn),
      relativeLabel: relativeGameDayLabel(entry.post.occurredOn, currentDate),
      unread: entry.post.unread,
      author: entry.author,
      text: entry.text,
      tags: entry.post.tags,
      replies: entry.replies,
      engagement: entry.engagement,
      engagementDisplay: {
        replies: formatCount(entry.engagement.replies),
        reposts: formatCount(entry.engagement.reposts),
        likes: formatCount(entry.engagement.likes),
      },
      engagementLabel: engagementLabel(entry.engagement),
      attachment: entry.post.attachment,
      boxScoreHref:
        gameId && canOpenGameBoxScore(state, gameId)
          ? `/dashboard/${saveId}/games/${gameId}`
          : null,
    };
  });

  return { posts, context: { saveId, teams, portraits } };
}

function attachmentPlayerIds(attachment: TimelineAttachment): string[] {
  switch (attachment.type) {
    case "game":
      return [
        attachment.topPerformers.home?.player.playerId,
        attachment.topPerformers.away?.player.playerId,
      ].filter((id): id is string => Boolean(id));
    case "performance":
      return [attachment.player.playerId];
    case "award":
      return attachment.winner ? [attachment.winner.playerId] : [];
    case "award_race":
      return attachment.contenders.flatMap((c) =>
        c.player ? [c.player.playerId] : [],
      );
    case "trade":
      return attachment.movements.map((m) => m.player.playerId);
    case "signing":
    case "injury":
      return attachment.player ? [attachment.player.playerId] : [];
    default:
      return [];
  }
}

function attachmentTeams(attachment: TimelineAttachment): TimelineTeamRef[] {
  switch (attachment.type) {
    case "game":
      return [attachment.home, attachment.away];
    case "performance":
      return [attachment.team, attachment.opponent];
    case "award":
      return attachment.team ? [attachment.team] : [];
    case "award_race":
      return attachment.contenders.flatMap((c) => (c.team ? [c.team] : []));
    case "playoff":
      return attachment.loser
        ? [attachment.winner, attachment.loser]
        : [attachment.winner];
    case "streak":
      return attachment.snappedBy
        ? [attachment.team, attachment.snappedBy]
        : [attachment.team];
    case "trade":
      return attachment.teams;
    case "signing":
    case "injury":
      return attachment.team ? [attachment.team] : [];
    default:
      return [];
  }
}
