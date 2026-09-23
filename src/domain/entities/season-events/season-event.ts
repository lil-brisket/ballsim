import type {
  FanVoteCampaignId,
  SeasonEventId,
  SeasonId,
} from "@/domain/ids";

export type SeasonEventType =
  | "midseason_tournament"
  | "all_star"
  | "fan_voting"
  | "midseason_awards"
  | "holiday";

export const SEASON_EVENT_TYPES: readonly SeasonEventType[] = [
  "midseason_tournament",
  "all_star",
  "fan_voting",
  "midseason_awards",
  "holiday",
] as const;

export type SeasonEventStatus =
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled";

export const SEASON_EVENT_STATUSES: readonly SeasonEventStatus[] = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
] as const;

export type SeasonEvent = {
  id: SeasonEventId;
  seasonId: SeasonId;
  type: SeasonEventType;
  title: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  status: SeasonEventStatus;
  /** Optional pointer into a sidecar (campaign id, holiday key, etc.). */
  sidecarKey: string | null;
};

export function isSeasonEventType(value: unknown): value is SeasonEventType {
  return (
    typeof value === "string" &&
    (SEASON_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function isSeasonEventStatus(
  value: unknown,
): value is SeasonEventStatus {
  return (
    typeof value === "string" &&
    (SEASON_EVENT_STATUSES as readonly string[]).includes(value)
  );
}

export function buildSeasonEventId(
  seasonId: string,
  type: SeasonEventType,
  key: string,
): SeasonEventId {
  return `${seasonId}:${type}:${key}` as SeasonEventId;
}

export type SeasonEventSidecarRef = {
  campaignId?: FanVoteCampaignId;
  holidayKey?: string;
};
