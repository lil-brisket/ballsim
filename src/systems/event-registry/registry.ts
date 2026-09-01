/**
 * Central Event Registry — single source of presentation policy for
 * Calendar, Media, Notifications, Simulation Highlights, and Social.
 */

import type {
  CalendarEventCategory,
  CalendarEventLifecycle,
} from "@/domain/entities/calendar-event";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { DomainEventType } from "@/domain/events";
import type { LeagueMilestoneKey } from "@/systems/league-rules/calendar-events";

export type NotificationCategory = "action_required" | "important" | "news";

export type EventRegistryEntry = {
  calendar: {
    show: boolean;
    lifecycle: CalendarEventLifecycle;
    category: CalendarEventCategory;
  };
  media: {
    generate: boolean;
    importance: ImportanceLevel;
  };
  notification: {
    generate: boolean;
    category: NotificationCategory;
  };
  highlight: {
    show: boolean;
    minImportance: ImportanceLevel;
  };
  social: {
    minPosts: number;
    maxPosts: number;
  };
};

const NONE_SOCIAL = { minPosts: 0, maxPosts: 0 } as const;

function entry(partial: EventRegistryEntry): EventRegistryEntry {
  return partial;
}

function occurred(
  category: CalendarEventCategory,
  importance: ImportanceLevel,
  opts: {
    media?: boolean;
    notify?: boolean;
    notifyCat?: NotificationCategory;
    highlight?: boolean;
    social?: { minPosts: number; maxPosts: number };
  } = {},
): EventRegistryEntry {
  const media = opts.media ?? importance !== "low";
  const highlight = opts.highlight ?? importance !== "low";
  return entry({
    calendar: { show: true, lifecycle: "occurred", category },
    media: { generate: media, importance },
    notification: {
      generate: opts.notify ?? false,
      category: opts.notifyCat ?? "news",
    },
    highlight: {
      show: highlight,
      minImportance: importance,
    },
    social: opts.social ?? NONE_SOCIAL,
  });
}

function silent(category: CalendarEventCategory): EventRegistryEntry {
  return entry({
    calendar: { show: false, lifecycle: "occurred", category },
    media: { generate: false, importance: "low" },
    notification: { generate: false, category: "news" },
    highlight: { show: false, minImportance: "low" },
    social: NONE_SOCIAL,
  });
}

/** Domain-event policies keyed by DomainEventType. */
export const DOMAIN_EVENT_REGISTRY: Record<
  DomainEventType,
  EventRegistryEntry
> = {
  GameCompleted: occurred("game", "medium", {
    social: { minPosts: 0, maxPosts: 2 },
  }),
  PlayerInjured: occurred("injury", "high", {
    notify: true,
    notifyCat: "important",
    social: { minPosts: 0, maxPosts: 1 },
  }),
  PlayerDeveloped: silent("team"),
  PlayerDeclined: silent("team"),
  ContractSigned: occurred("transaction", "medium", {
    notify: true,
    social: { minPosts: 0, maxPosts: 1 },
  }),
  PlayerTraded: occurred("transaction", "high", {
    notify: true,
    notifyCat: "important",
    social: { minPosts: 1, maxPosts: 2 },
  }),
  PlayerReleased: occurred("transaction", "medium", { notify: true }),
  DraftPickMade: occurred("league", "high", {
    notify: true,
    social: { minPosts: 0, maxPosts: 2 },
  }),
  FantasyDraftPickMade: occurred("league", "medium"),
  FantasyDraftPickUndone: silent("league"),
  FreeAgentSigned: occurred("transaction", "high", {
    notify: true,
    social: { minPosts: 0, maxPosts: 2 },
  }),
  FreeAgencyOfferInvalidated: silent("transaction"),
  AiAssistAction: silent("team"),
  OffseasonStageAdvanced: occurred("league", "medium", { notify: true }),
  LeaguePhaseAdvanced: occurred("league", "medium", { notify: true }),
  CoachHired: occurred("team", "medium", {
    notify: true,
    social: { minPosts: 0, maxPosts: 1 },
  }),
  StaffHired: occurred("team", "low", { media: false, highlight: false }),
  StaffFired: occurred("team", "medium", { notify: true }),
  StaffDeveloped: silent("team"),
  StaffDeclined: silent("team"),
  StaffRetired: occurred("team", "medium"),
  PlayerRetired: occurred("team", "high", {
    notify: true,
    social: { minPosts: 0, maxPosts: 2 },
  }),
  RfaQualifyingOfferIssued: occurred("transaction", "medium", {
    notify: true,
  }),
  RfaOfferSheetExpired: occurred("transaction", "low", {
    media: false,
    highlight: false,
  }),
  TradeOfferExpired: occurred("transaction", "low", {
    media: false,
    highlight: false,
    notify: true,
  }),
  FreeAgencyOfferWithdrawn: silent("transaction"),
  StaffContractExpired: silent("team"),
  StaffOfferAccepted: occurred("team", "low", {
    media: false,
    highlight: false,
  }),
  StaffOfferRejected: silent("team"),
  FacilityUpgradeStarted: occurred("team", "medium", { notify: true }),
  FacilityUpgradeCompleted: occurred("team", "medium", { notify: true }),
  SponsorshipSigned: occurred("team", "medium", { notify: true }),
  SponsorshipExpired: occurred("team", "low", {
    media: false,
    highlight: false,
    notify: true,
  }),
  RelocationStageChanged: occurred("team", "critical", {
    notify: true,
    notifyCat: "important",
    social: { minPosts: 1, maxPosts: 3 },
  }),
  ExpansionStageChanged: occurred("league", "high", {
    notify: true,
    social: { minPosts: 0, maxPosts: 2 },
  }),
  RevenueRecorded: silent("team"),
  ExpenseRecorded: silent("team"),
  HomeGameDaySettled: silent("game"),
  GameDayPromotionSettled: silent("team"),
  PlayerPayrollPaid: silent("team"),
  PlayerAssignedToDevelopmentLeague: occurred("team", "medium", {
    notify: true,
  }),
  PlayerRecalledFromDevelopmentLeague: occurred("team", "medium", {
    notify: true,
  }),
  PlayerGraduatedFromDevelopmentLeague: occurred("team", "high", {
    notify: true,
    social: { minPosts: 0, maxPosts: 1 },
  }),
};

export const SCHEDULED_GAME_POLICY: EventRegistryEntry = entry({
  calendar: { show: true, lifecycle: "scheduled", category: "game" },
  media: { generate: false, importance: "low" },
  notification: { generate: false, category: "news" },
  highlight: { show: false, minImportance: "low" },
  social: NONE_SOCIAL,
});

export const COMPLETED_GAME_POLICY: EventRegistryEntry = entry({
  calendar: { show: true, lifecycle: "occurred", category: "game" },
  media: { generate: true, importance: "medium" },
  notification: { generate: false, category: "news" },
  highlight: { show: true, minImportance: "medium" },
  social: { minPosts: 0, maxPosts: 2 },
});

export const OWNER_DECISION_POLICY: EventRegistryEntry = entry({
  calendar: {
    show: true,
    lifecycle: "action_required",
    category: "action_required",
  },
  media: { generate: false, importance: "critical" },
  notification: { generate: true, category: "action_required" },
  highlight: { show: false, minImportance: "critical" },
  social: NONE_SOCIAL,
});

export const AWARD_POLICY: EventRegistryEntry = entry({
  calendar: { show: true, lifecycle: "occurred", category: "league" },
  media: { generate: true, importance: "high" },
  notification: { generate: true, category: "news" },
  highlight: { show: true, minImportance: "high" },
  social: { minPosts: 0, maxPosts: 2 },
});

export const PLAYOFF_SERIES_POLICY: EventRegistryEntry = entry({
  calendar: { show: true, lifecycle: "scheduled", category: "game" },
  media: { generate: true, importance: "high" },
  notification: { generate: true, category: "news" },
  highlight: { show: true, minImportance: "high" },
  social: { minPosts: 0, maxPosts: 2 },
});

const MILESTONE_DEADLINE_KEYS = new Set<LeagueMilestoneKey>([
  "tradeDeadline",
  "freeAgencyClose",
  "regularSeasonEnd",
]);

export function getMilestonePolicy(
  key: LeagueMilestoneKey,
): EventRegistryEntry {
  const isDeadline = MILESTONE_DEADLINE_KEYS.has(key);
  return entry({
    calendar: {
      show: true,
      lifecycle: "scheduled",
      category: isDeadline ? "deadline" : "league",
    },
    media: { generate: false, importance: "medium" },
    notification: {
      generate: isDeadline,
      category: isDeadline ? "important" : "news",
    },
    highlight: { show: false, minImportance: "medium" },
    social: NONE_SOCIAL,
  });
}

export function getDomainEventPolicy(
  type: DomainEventType,
): EventRegistryEntry {
  return DOMAIN_EVENT_REGISTRY[type];
}

/** Social post count bounds by importance tier. */
export function socialBoundsForImportance(
  importance: ImportanceLevel,
): { minPosts: number; maxPosts: number } {
  switch (importance) {
    case "critical":
      return { minPosts: 1, maxPosts: 3 };
    case "high":
      return { minPosts: 0, maxPosts: 2 };
    case "medium":
      return { minPosts: 0, maxPosts: 1 };
    case "low":
      return NONE_SOCIAL;
  }
}
