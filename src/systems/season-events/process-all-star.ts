import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createSeasonDomainEvent } from "@/systems/season-events/season-event-domain";
import {
  ensureSeasonEventsState,
  withSeasonEvents,
} from "@/systems/season-events/plan-season-events";
import {
  finalizeAllStarSelections,
  simulateAllStarGameIfDue,
} from "@/systems/season-events/all-star-selection";

/**
 * All-Star lifecycle: after voting closes → selections → exhibition game.
 * Selection is separate from raw fan vote rankings.
 */
export function processAllStar(
  state: GameState,
  rng: Rng,
  simulatedDate: string,
): SystemResult {
  const seasonEvents = ensureSeasonEventsState(state);
  const allStar = seasonEvents.allStar;
  if (allStar == null) {
    return systemResult(state);
  }

  let current = state;
  const events: DomainEvent[] = [];
  let nextAllStar = allStar;
  let seasonEventMap = { ...seasonEvents.events };

  const campaign = seasonEvents.fanVoting[allStar.campaignId];
  const votingClosed =
    campaign != null &&
    (campaign.status === "closed" || campaign.status === "finalized");

  // Selections after vote close, on/after close date, before or on event date.
  if (
    votingClosed &&
    (nextAllStar.status === "voting" || nextAllStar.status === "scheduled") &&
    campaign!.closeDate <= simulatedDate &&
    nextAllStar.selections.length === 0
  ) {
    const selected = finalizeAllStarSelections(current, nextAllStar);
    nextAllStar = {
      ...nextAllStar,
      ...selected.allStar,
      status: "selections_announced",
      selectionsAnnouncedOn: campaign!.closeDate,
    };
    events.push(
      createSeasonDomainEvent({
        type: "AllStarSelectionsAnnounced",
        occurredOn: campaign!.closeDate,
        key: `${nextAllStar.seasonId}_allstar_selections`,
        payload: {
          eventDate: nextAllStar.eventDate,
          selectionCount: nextAllStar.selections.length,
          playerIds: nextAllStar.selections.map((s) => s.playerId),
        },
      }),
    );
    const eventEntry = Object.values(seasonEventMap).find(
      (e) => e.type === "all_star",
    );
    if (eventEntry) {
      seasonEventMap = {
        ...seasonEventMap,
        [eventEntry.id]: { ...eventEntry, status: "active" },
      };
    }
  }

  current = withSeasonEvents(current, {
    ...ensureSeasonEventsState(current),
    events: seasonEventMap,
    allStar: nextAllStar,
  });

  // Exhibition game on event date
  if (
    nextAllStar.eventDate <= simulatedDate &&
    nextAllStar.status === "selections_announced" &&
    nextAllStar.gameIds.length === 0
  ) {
    const gameResult = simulateAllStarGameIfDue(current, rng, nextAllStar);
    current = gameResult.state;
    events.push(...gameResult.events);
    nextAllStar = ensureSeasonEventsState(current).allStar ?? nextAllStar;
  }

  if (
    nextAllStar.eventDate <= simulatedDate &&
    nextAllStar.gameIds.length > 0 &&
    nextAllStar.status !== "completed"
  ) {
    nextAllStar = { ...nextAllStar, status: "completed" };
    const eventEntry = Object.values(
      ensureSeasonEventsState(current).events,
    ).find((e) => e.type === "all_star");
    seasonEventMap = { ...ensureSeasonEventsState(current).events };
    if (eventEntry) {
      seasonEventMap = {
        ...seasonEventMap,
        [eventEntry.id]: { ...eventEntry, status: "completed" },
      };
    }
    current = withSeasonEvents(current, {
      ...ensureSeasonEventsState(current),
      events: seasonEventMap,
      allStar: nextAllStar,
    });
  }

  return systemResult(current, events);
}
