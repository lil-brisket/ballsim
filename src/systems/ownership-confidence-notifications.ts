/**
 * Rare, contextual ownership confidence notifications.
 * Escalation: silent → pattern (UI only) → concern → pressure.
 * Positive confidence messages are first-class.
 */

import {
  createOwnerNotification,
  type OwnerNotification,
} from "@/domain/entities/owner-notification";
import type {
  OwnershipMood,
  StrategicReversal,
} from "@/domain/entities/ownership-confidence";
import { ownershipMoodLabel } from "@/domain/entities/ownership-confidence";
import type { DomainEvent } from "@/domain/events";
import { asOwnerNotificationId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getOwnerPhilosophyProfile } from "@/systems/owner-philosophy-config";

export type OwnershipConfidenceNotificationOptions = {
  previousMood: OwnershipMood;
  previousConcern: number;
  reversal: StrategicReversal | null;
  gapSummary: string;
  postureSummary: string;
};

function philosophyLabel(state: GameState): string {
  const philosophy = state.user.ownerPhilosophy;
  switch (philosophy) {
    case "win_now":
      return "Win Now";
    case "build_for_the_future":
      return "Build for the Future";
    case "financially_conservative":
      return "Financially Conservative";
    case "market_expansion":
      return "Market Expansion";
    case "balanced":
      return "Balanced";
  }
}

function appendNotification(
  state: GameState,
  notification: OwnerNotification,
): GameState {
  const existingKeys = new Set(
    state.user.notifications.map((item) => item.dedupeKey),
  );
  if (existingKeys.has(notification.dedupeKey)) {
    return state;
  }
  return {
    ...state,
    user: {
      ...state.user,
      notifications: [...state.user.notifications, notification],
    },
  };
}

/**
 * Generate ownership confidence / concern / pressure / direction notifications.
 * Idempotent via dedupeKey.
 */
export function generateOwnershipConfidenceNotifications(
  state: GameState,
  options: OwnershipConfidenceNotificationOptions,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const teamId = state.user.controlledTeamId;
  const date = state.world.calendar.currentDate;
  const year = state.competition.season.year;
  const mood = state.user.ownershipConfidence.mood;
  const previousMood = options.previousMood;
  const confidence = state.user.ownershipConfidence;

  const hurting = confidence.recentHurting[confidence.recentHurting.length - 1];
  const helping = confidence.recentHelping[confidence.recentHelping.length - 1];

  // Strategic reversal — important, rare.
  if (options.reversal && !options.reversal.acknowledged) {
    current = appendNotification(
      current,
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_own_dir_${teamId}_${year}_${date}`,
        ),
        type: "ownership_direction_change",
        title: "Change in Direction",
        message: options.reversal.summary,
        occurredOn: date,
        severity: "info",
        read: false,
        dedupeKey: `ownership_direction_change:${teamId}:${year}:${options.reversal.newDirection}`,
        relatedTeamId: teamId,
      }),
    );
  }

  // Positive confidence when improving into supportive/confident.
  if (
    (mood === "confident" || mood === "supportive") &&
    (previousMood === "watchful" ||
      previousMood === "concerned" ||
      previousMood === "displeased" ||
      (mood === "confident" && previousMood === "supportive"))
  ) {
    const detail =
      helping ??
      options.postureSummary ??
      "Recent decisions have tracked ownership priorities.";
    current = appendNotification(
      current,
      createOwnerNotification({
        id: asOwnerNotificationId(`notif_own_conf_${teamId}_${year}_${mood}`),
        type: "ownership_confidence",
        title: "Ownership Confidence",
        message: `The franchise has followed the organization's ${philosophyLabel(state)} strategy well. ${detail}`,
        occurredOn: date,
        severity: "success",
        read: false,
        dedupeKey: `ownership_confidence:${teamId}:${year}:${mood}`,
        relatedTeamId: teamId,
      }),
    );
  }

  // Concern — only on escalation into concerned (not every week).
  if (mood === "concerned" && previousMood !== "concerned" && previousMood !== "displeased") {
    const why = hurting ?? options.gapSummary;
    current = appendNotification(
      current,
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_own_concern_${teamId}_${year}`,
        ),
        type: "ownership_concern",
        title: "Ownership Concern",
        message: `${options.gapSummary} ${why}`.trim(),
        occurredOn: date,
        severity: "warning",
        read: false,
        dedupeKey: `ownership_concern:${teamId}:${year}`,
        relatedTeamId: teamId,
      }),
    );
  }

  // Pressure — only on escalation into displeased.
  if (mood === "displeased" && previousMood !== "displeased") {
    const profile = getOwnerPhilosophyProfile(state.user.ownerPhilosophy);
    void profile;
    current = appendNotification(
      current,
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_own_pressure_${teamId}_${year}`,
        ),
        type: "ownership_pressure",
        title: "Ownership Pressure",
        message: `Ownership has serious concerns about the direction of the franchise. Mood is now ${ownershipMoodLabel(mood)}. ${options.gapSummary}`,
        occurredOn: date,
        severity: "critical",
        read: false,
        dedupeKey: `ownership_pressure:${teamId}:${year}`,
        relatedTeamId: teamId,
      }),
    );
  }

  return systemResult(current, events);
}
