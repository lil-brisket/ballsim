import type { SeasonEvent } from "@/domain/entities/season-events/season-event";
import type { FanVoteCampaign } from "@/domain/entities/season-events/fan-voting";
import type { AllStarEventState } from "@/domain/entities/season-events/all-star";
import type { MidseasonAwardsState } from "@/domain/entities/season-events/midseason-awards";
import type { MidseasonTournamentState } from "@/domain/entities/season-events/midseason-tournament";
import type { HolidayInstance } from "@/domain/entities/season-events/holiday";

export type {
  SeasonEvent,
  SeasonEventType,
  SeasonEventStatus,
} from "@/domain/entities/season-events/season-event";
export {
  SEASON_EVENT_TYPES,
  SEASON_EVENT_STATUSES,
  isSeasonEventType,
  isSeasonEventStatus,
  buildSeasonEventId,
} from "@/domain/entities/season-events/season-event";

export type {
  FanVoteCampaign,
  FanVoteCategory,
  FanVoteCandidate,
  FanVoteCampaignStatus,
  FanVoteCategoryKind,
} from "@/domain/entities/season-events/fan-voting";
export { createEmptyFanVoteCampaign } from "@/domain/entities/season-events/fan-voting";

export type {
  AllStarEventState,
  AllStarSelection,
  AllStarSelectionRole,
  AllStarEventStatus,
} from "@/domain/entities/season-events/all-star";

export type {
  MidseasonAwardsState,
  MidseasonAwardsStatus,
} from "@/domain/entities/season-events/midseason-awards";

export type {
  MidseasonTournamentState,
  MidseasonTournamentFormat,
} from "@/domain/entities/season-events/midseason-tournament";
export { createEmptyMidseasonTournament } from "@/domain/entities/season-events/midseason-tournament";

export type {
  HolidayDefinition,
  HolidayEffectConfig,
  HolidayInstance,
  HolidayInstanceStatus,
} from "@/domain/entities/season-events/holiday";

/**
 * Authoritative midseason / special-event state for the current season.
 * Cleared on season rollover. Planned when the regular season initializes.
 */
export type SeasonEventsState = {
  events: Record<string, SeasonEvent>;
  fanVoting: Record<string, FanVoteCampaign>;
  allStar: AllStarEventState | null;
  midseasonAwards: MidseasonAwardsState | null;
  tournament: MidseasonTournamentState | null;
  holidays: Record<string, HolidayInstance>;
};

export function createEmptySeasonEventsState(): SeasonEventsState {
  return {
    events: {},
    fanVoting: {},
    allStar: null,
    midseasonAwards: null,
    tournament: null,
    holidays: {},
  };
}
