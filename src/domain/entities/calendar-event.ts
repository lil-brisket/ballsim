/**
 * Calendar presentation model — derived from GameState, never authoritative.
 * Future dates show scheduled / action_required only; never invent "projected"
 * transactions or injuries.
 */

import type { EventSourceRef, ImportanceLevel } from "@/domain/entities/event-source";
import type { PlayerId, TeamId } from "@/domain/ids";

export type CalendarEventLifecycle =
  | "scheduled"
  | "occurred"
  | "action_required"
  | "cancelled";

/** Display certainty — known (occurred), scheduled (future authoritative), action_required. */
export type CalendarEventCertainty =
  | "known"
  | "scheduled"
  | "action_required";

export function certaintyFromLifecycle(
  lifecycle: CalendarEventLifecycle,
): CalendarEventCertainty {
  if (lifecycle === "action_required") return "action_required";
  if (lifecycle === "occurred") return "known";
  return "scheduled";
}

export type CalendarEventCategory =
  | "game"
  | "transaction"
  | "injury"
  | "league"
  | "team"
  | "deadline"
  | "news"
  | "action_required";

export const CALENDAR_EVENT_CATEGORIES: readonly CalendarEventCategory[] = [
  "game",
  "transaction",
  "injury",
  "league",
  "team",
  "deadline",
  "news",
  "action_required",
] as const;

export type CalendarEventView = {
  id: string;
  date: string;
  lifecycle: CalendarEventLifecycle;
  category: CalendarEventCategory;
  title: string;
  description?: string;
  importance: ImportanceLevel;
  source: EventSourceRef;
  sourceKey: string;
  teamIds?: TeamId[];
  playerIds?: PlayerId[];
  /** True only for formal blocking owner decisions. */
  blocking: boolean;
  completed: boolean;
  href?: string;
  certainty: CalendarEventCertainty;
};

export type CalendarFilter =
  | "all"
  | "game"
  | "team"
  | "league"
  | "transaction"
  | "injury"
  | "deadline"
  | "news"
  | "action_required";

export const CALENDAR_FILTERS: readonly CalendarFilter[] = [
  "all",
  "game",
  "team",
  "league",
  "transaction",
  "injury",
  "deadline",
  "news",
  "action_required",
] as const;

export function matchesCalendarFilter(
  event: CalendarEventView,
  filter: CalendarFilter,
  userTeamId?: TeamId,
): boolean {
  if (filter === "all") return true;
  if (filter === "team") {
    return Boolean(userTeamId && event.teamIds?.includes(userTeamId));
  }
  if (filter === "action_required") {
    return event.lifecycle === "action_required" || event.blocking;
  }
  return event.category === filter;
}
