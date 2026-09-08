/**
 * Calendar event attention tiers for visual hierarchy.
 * Answers "What deserves my attention?" — not just "What happened?"
 */

import type { CalendarEventView } from "@/domain/entities/calendar-event";
import type { TeamId } from "@/domain/ids";

export type EventAttentionTier = 1 | 2 | 3 | 4;

export type AttentionIndicatorKind =
  | "team_game"
  | "user_impact"
  | "league"
  | "background";

const INDICATOR_ORDER: AttentionIndicatorKind[] = [
  "team_game",
  "user_impact",
  "league",
  "background",
];

export const ATTENTION_INDICATOR_DOT: Record<AttentionIndicatorKind, string> = {
  team_game: "bg-sky-400 ring-1 ring-sky-300/60",
  user_impact: "bg-amber-400",
  league: "bg-zinc-500",
  background: "bg-zinc-700",
};

export const ATTENTION_TIER_LABEL: Record<EventAttentionTier, string> = {
  1: "Your Team",
  2: "Needs Attention",
  3: "League",
  4: "Background",
};

export function getEventAttentionTier(
  event: CalendarEventView,
  userTeamId?: TeamId | null,
): EventAttentionTier {
  const isUserTeam = Boolean(
    userTeamId && event.teamIds?.includes(userTeamId),
  );

  // Tier 1 — user's team game
  if (event.category === "game" && isUserTeam) {
    return 1;
  }

  // Tier 2 — user-impacting
  if (
    event.lifecycle === "action_required" ||
    event.blocking ||
    event.category === "action_required" ||
    event.category === "deadline" ||
    (event.category === "injury" && isUserTeam) ||
    (event.category === "team" && isUserTeam)
  ) {
    return 2;
  }

  // Tier 3 — league
  if (
    event.category === "game" ||
    event.category === "transaction" ||
    event.category === "league" ||
    event.category === "injury" ||
    event.importance === "high" ||
    event.importance === "critical"
  ) {
    return 3;
  }

  // Tier 4 — background
  return 4;
}

export function collectAttentionIndicators(
  events: readonly CalendarEventView[],
  userTeamId?: TeamId | null,
): AttentionIndicatorKind[] {
  const present = new Set<AttentionIndicatorKind>();
  for (const event of events) {
    const tier = getEventAttentionTier(event, userTeamId);
    switch (tier) {
      case 1:
        present.add("team_game");
        break;
      case 2:
        present.add("user_impact");
        break;
      case 3:
        present.add("league");
        break;
      case 4:
        present.add("background");
        break;
    }
  }
  return INDICATOR_ORDER.filter((kind) => present.has(kind));
}

export function groupEventsByAttentionTier(
  events: readonly CalendarEventView[],
  userTeamId?: TeamId | null,
): { tier: EventAttentionTier; events: CalendarEventView[] }[] {
  const buckets = new Map<EventAttentionTier, CalendarEventView[]>();
  for (const event of events) {
    const tier = getEventAttentionTier(event, userTeamId);
    const list = buckets.get(tier);
    if (list) {
      list.push(event);
    } else {
      buckets.set(tier, [event]);
    }
  }
  return ([1, 2, 3, 4] as const)
    .filter((tier) => buckets.has(tier))
    .map((tier) => ({
      tier,
      events: buckets.get(tier)!,
    }));
}
