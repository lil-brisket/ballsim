import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { InjurySeverity } from "@/domain/entities/injury";
import type { MediaItem } from "@/domain/entities/media-item";
import type { DomainEvent } from "@/domain/events";
import type { OwnedFranchiseState } from "@/state/game-state";
import type { DetectorInput } from "./detector-input";
import type { TimelinePost, TimelinePostKind, TradeMovement } from "./types";

/** Event types whose stories the detectors own, or that no longer exist. */
const DROPPED_EVENT_TYPES = new Set<string>([
  "GameCompleted",
  "MidseasonAwardAnnounced",
  "MidseasonTournamentStarted",
  "MidseasonTournamentCompleted",
]);

const SIGNING_EVENT_TYPES = new Set<string>([
  "FreeAgentSigned",
  "ContractSigned",
]);

const LEGACY_MIDSEASON_HEADLINE = /^midseason (award|tournament)/i;
const SIGNING_HEADLINE = / (signs with|joins) /;

const IMPORTANCE_NOTABILITY: Record<ImportanceLevel, number> = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 20,
};

/** Injuries are frequent; they rank below big games and trades. */
const INJURY_NOTABILITY: Record<InjurySeverity, number> = {
  minor: 15,
  moderate: 25,
  major: 40,
  severe: 55,
};

/**
 * Persisted media items → timeline posts. Game results come from the game
 * detector instead; trade legs sharing a story group become one post.
 */
export function postsFromMediaItems(
  input: DetectorInput,
  franchise: OwnedFranchiseState,
): TimelinePost[] {
  const events = indexEvents(input, franchise);
  const posts: TimelinePost[] = [];
  const tradeGroups = new Map<string, MediaItem[]>();

  for (const item of franchise.mediaFeed.items) {
    const event = eventFor(events, item);
    if (isDropped(item, event)) continue;
    if (item.storyGroupId?.startsWith("trade_")) {
      const group = tradeGroups.get(item.storyGroupId) ?? [];
      group.push(item);
      tradeGroups.set(item.storyGroupId, group);
      continue;
    }
    posts.push(toPost(input, item, event));
  }
  for (const [groupId, items] of tradeGroups) {
    posts.push(tradePost(input, groupId, items, events));
  }
  return posts;
}

function indexEvents(
  input: DetectorInput,
  franchise: OwnedFranchiseState,
): Map<string, DomainEvent> {
  const events = new Map<string, DomainEvent>();
  for (const event of input.state.competition.seasonEventLog) {
    events.set(event.id, event);
  }
  for (const event of franchise.eventLog) {
    if (!events.has(event.id)) events.set(event.id, event);
  }
  return events;
}

function eventFor(
  events: Map<string, DomainEvent>,
  item: MediaItem,
): DomainEvent | undefined {
  return item.source.type === "domain_event"
    ? events.get(item.source.id)
    : undefined;
}

function isDropped(item: MediaItem, event: DomainEvent | undefined): boolean {
  if (event) return DROPPED_EVENT_TYPES.has(event.type);
  return (
    (item.storyType === "game" && item.gameId !== undefined) ||
    LEGACY_MIDSEASON_HEADLINE.test(item.headline)
  );
}

function payloadString(
  event: DomainEvent | undefined,
  key: string,
): string | null {
  const value = (event?.payload as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" ? value : null;
}

function basePost(
  item: MediaItem,
  kind: TimelinePostKind,
  notability: number,
  input: DetectorInput,
): Omit<TimelinePost, "attachment"> {
  const teamIds = [...(item.teamIds ?? [])];
  return {
    id: `media:${item.id}`,
    occurredOn: item.occurredOn,
    kind,
    importance: item.importance,
    notability,
    relevance: item.relevanceScore,
    teamIds,
    playerIds: [...(item.playerIds ?? [])],
    ...(item.gameId ? { gameId: item.gameId } : {}),
    tags: teamIds.map((id) => input.refs.team(id).abbreviation),
    unread: false,
  };
}

function toPost(
  input: DetectorInput,
  item: MediaItem,
  event: DomainEvent | undefined,
): TimelinePost {
  const { refs, state } = input;
  const playerId = payloadString(event, "playerId") ?? item.playerIds?.[0];
  const teamId = payloadString(event, "teamId") ?? item.teamIds?.[0];
  const player = playerId ? refs.player(playerId) : null;
  const team = teamId ? refs.team(teamId) : null;

  if (item.storyType === "injury") {
    const injuryId = payloadString(event, "injuryId");
    const severity = payloadString(event, "severity") as InjurySeverity | null;
    const injury =
      playerId && injuryId
        ? state.world.players[playerId]?.activeInjuries.find(
            (i) => i.injuryId === injuryId,
          )
        : undefined;
    const window = injury?.expectedReturnWindow ?? null;
    return {
      ...basePost(
        item,
        "injury",
        severity
          ? INJURY_NOTABILITY[severity]
          : IMPORTANCE_NOTABILITY[item.importance],
        input,
      ),
      attachment: {
        type: "injury",
        player,
        team,
        severity,
        bodyPart: payloadString(event, "bodyPart"),
        expectedReturn: window
          ? { earliest: window.earliest, latest: window.latest }
          : null,
      },
    };
  }

  const isSigning = event
    ? SIGNING_EVENT_TYPES.has(event.type)
    : item.storyType === "transaction" && SIGNING_HEADLINE.test(item.headline);
  if (isSigning) {
    return {
      ...basePost(
        item,
        "signing",
        IMPORTANCE_NOTABILITY[item.importance],
        input,
      ),
      attachment: {
        type: "signing",
        player,
        team,
        headline: item.headline,
        summary: item.summary,
      },
    };
  }

  return {
    ...basePost(
      item,
      item.storyType === "transaction" ? "transaction" : "league",
      IMPORTANCE_NOTABILITY[item.importance],
      input,
    ),
    attachment: {
      type: "league",
      headline: item.headline,
      summary: item.summary,
    },
  };
}

function tradePost(
  input: DetectorInput,
  groupId: string,
  items: MediaItem[],
  events: Map<string, DomainEvent>,
): TimelinePost {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const first = sorted[0]!;
  const movements: TradeMovement[] = [];
  const otherPieces: string[] = [];
  const teamIds = new Set<string>();
  const playerIds = new Set<string>();

  for (const item of sorted) {
    for (const id of item.teamIds ?? []) teamIds.add(id);
    const event = eventFor(events, item);
    const playerId = payloadString(event, "playerId");
    const fromTeamId = payloadString(event, "fromTeamId");
    const toTeamId = payloadString(event, "toTeamId");
    const player =
      event?.type === "PlayerTraded" && playerId
        ? input.refs.player(playerId)
        : null;
    if (player && fromTeamId && toTeamId) {
      movements.push({ player, fromTeamId, toTeamId });
      playerIds.add(player.playerId);
      teamIds.add(fromTeamId);
      teamIds.add(toTeamId);
    } else {
      otherPieces.push(item.headline);
      for (const id of item.playerIds ?? []) playerIds.add(id);
    }
  }

  const sortedTeamIds = [...teamIds].sort();
  const teams = sortedTeamIds.map((id) => input.refs.team(id));
  const occurredOn = sorted.reduce(
    (min, item) => (item.occurredOn < min ? item.occurredOn : min),
    first.occurredOn,
  );
  return {
    id: `media:${groupId}`,
    occurredOn,
    kind: "trade",
    importance: "high",
    notability: Math.min(85, 60 + 5 * Math.max(1, movements.length)),
    relevance: Math.max(...sorted.map((item) => item.relevanceScore)),
    teamIds: sortedTeamIds,
    playerIds: [...playerIds].sort(),
    attachment: { type: "trade", teams, movements, otherPieces },
    tags: teams.map((team) => team.abbreviation),
    unread: false,
  };
}

/** Media item ids folded into a post, for read-state lookups. */
export function sourceMediaItemIds(
  post: TimelinePost,
  franchise: OwnedFranchiseState,
): string[] {
  if (!post.id.startsWith("media:")) return [];
  const key = post.id.slice("media:".length);
  if (key.startsWith("trade_")) {
    return franchise.mediaFeed.items
      .filter((item) => item.storyGroupId === key)
      .map((item) => item.id);
  }
  return [key];
}
