import { addCalendarDays } from "@/domain/calendar-date";
import {
  buildSeasonEventId,
  createEmptySeasonEventsState,
  type SeasonEvent,
  type SeasonEventsState,
} from "@/domain/entities/season-events";
import { createEmptyFanVoteCampaign } from "@/domain/entities/season-events/fan-voting";
import type { AllStarEventState } from "@/domain/entities/season-events/all-star";
import { asFanVoteCampaignId, asSeasonId, type SeasonId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { LEAGUE_HOLIDAY_DEFINITIONS } from "@/systems/season-events/holiday-definitions";
import { deriveMidseasonEventWindow } from "@/systems/season-events/midseason-dates";
import { buildFanVoteCategories } from "@/systems/season-events/fan-vote-categories";

/**
 * Plans midseason events once the regular-season schedule exists.
 * Idempotent: no-op when seasonEvents.events is already non-empty for this season.
 */
export function planSeasonEvents(state: GameState): SystemResult {
  const seasonId = asSeasonId(state.competition.season.id);
  const existing = state.competition.seasonEvents;
  if (
    existing != null &&
    Object.keys(existing.events).length > 0 &&
    Object.values(existing.events).some((e) => e.seasonId === seasonId)
  ) {
    return systemResult(state);
  }

  const window = deriveMidseasonEventWindow(state);
  if (window == null) {
    return systemResult(state);
  }

  const campaignId = asFanVoteCampaignId(`fanvote_${seasonId}`);
  const categories = buildFanVoteCategories(state);

  const campaign = {
    ...createEmptyFanVoteCampaign({
      id: campaignId,
      seasonId,
      title: "Midseason Fan Voting",
      openDate: window.votingOpenDate,
      closeDate: window.votingCloseDate,
    }),
    categories,
  };

  const allStar: AllStarEventState = {
    seasonId,
    campaignId,
    eventDate: window.allStarDate,
    status: "scheduled",
    selections: [],
    gameIds: [],
    selectionsAnnouncedOn: null,
  };

  const events: Record<string, SeasonEvent> = {};
  const holidays: SeasonEventsState["holidays"] = {};

  const votingEventId = buildSeasonEventId(seasonId, "fan_voting", "allstar");
  events[votingEventId] = {
    id: votingEventId,
    seasonId,
    type: "fan_voting",
    title: "All-Star Fan Voting",
    shortLabel: "Fan Voting",
    startDate: window.votingOpenDate,
    endDate: window.votingCloseDate,
    status: "scheduled",
    sidecarKey: campaignId,
  };

  const allStarEventId = buildSeasonEventId(seasonId, "all_star", "main");
  events[allStarEventId] = {
    id: allStarEventId,
    seasonId,
    type: "all_star",
    title: "All-Star Game",
    shortLabel: "All-Star",
    startDate: window.allStarDate,
    endDate: window.allStarDate,
    status: "scheduled",
    sidecarKey: "main",
  };

  for (const def of LEAGUE_HOLIDAY_DEFINITIONS) {
    const startDate = addCalendarDays(window.anchorDate, def.offsetFromAnchor);
    const endDate = addCalendarDays(
      startDate,
      Math.max(0, def.durationDays - 1),
    );
    const holidayEventId = buildSeasonEventId(seasonId, "holiday", def.key);
    events[holidayEventId] = {
      id: holidayEventId,
      seasonId,
      type: "holiday",
      title: def.title,
      shortLabel: def.shortLabel,
      startDate,
      endDate,
      status: "scheduled",
      sidecarKey: def.key,
    };
    holidays[def.key] = {
      key: def.key,
      title: def.title,
      shortLabel: def.shortLabel,
      startDate,
      endDate,
      status: "scheduled",
      effects: def.effects,
    };
  }

  const seasonEvents: SeasonEventsState = {
    events,
    fanVoting: { [campaignId]: campaign },
    allStar,
    // Midseason awards and the Midseason Cup are retired; legacy saves may
    // still hold them, but new seasons never plan either.
    midseasonAwards: null,
    tournament: null,
    holidays,
  };

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      seasonEvents,
    },
  });
}

export function ensureSeasonEventsState(state: GameState): SeasonEventsState {
  return state.competition.seasonEvents ?? createEmptySeasonEventsState();
}

export function withSeasonEvents(
  state: GameState,
  seasonEvents: SeasonEventsState,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      seasonEvents,
    },
  };
}

export function emptySeasonEventsForSeason(
  _seasonId: SeasonId,
): SeasonEventsState {
  return createEmptySeasonEventsState();
}
