import type { DomainEvent } from "@/domain/events";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createSeasonDomainEvent } from "@/systems/season-events/season-event-domain";
import {
  ensureSeasonEventsState,
  withSeasonEvents,
} from "@/systems/season-events/plan-season-events";
import { runMidseasonAwards } from "@/systems/awards/award-pipeline";

/**
 * Midseason awards: evaluate on announce/cutoff date after RS games that day.
 */
export function processMidseasonAwards(
  state: GameState,
  simulatedDate: string,
): SystemResult {
  const seasonEvents = ensureSeasonEventsState(state);
  const awards = seasonEvents.midseasonAwards;
  if (awards == null || awards.status === "announced") {
    return systemResult(state);
  }
  if (awards.announceDate > simulatedDate) {
    return systemResult(state);
  }

  const pipeline = runMidseasonAwards(state, awards.cutoffDate);
  let current = pipeline.state;
  const events: DomainEvent[] = [...pipeline.events];

  const resultIds = Object.keys(current.business.awards.results).filter(
    (id) =>
      id.includes(":midseason:") ||
      id.includes(":midseason_"),
  );

  // Prefer ids written by midseason award definitions
  const midseasonIds = Object.values(current.business.awards.results)
    .filter((r) => r.period === "midseason")
    .map((r) => r.id);

  const nextAwards = {
    ...awards,
    status: "announced" as const,
    resultIds: midseasonIds.length > 0 ? midseasonIds : resultIds,
  };

  let seasonEventMap = { ...ensureSeasonEventsState(current).events };
  const eventEntry = Object.values(seasonEventMap).find(
    (e) => e.type === "midseason_awards",
  );
  if (eventEntry) {
    seasonEventMap = {
      ...seasonEventMap,
      [eventEntry.id]: { ...eventEntry, status: "completed" },
    };
  }

  current = withSeasonEvents(current, {
    ...ensureSeasonEventsState(current),
    events: seasonEventMap,
    midseasonAwards: nextAwards,
  });

  for (const resultId of nextAwards.resultIds) {
    const result = current.business.awards.results[resultId];
    if (!result) continue;
    events.push(
      createSeasonDomainEvent({
        type: "MidseasonAwardAnnounced",
        occurredOn: awards.announceDate,
        key: `${awards.seasonId}_${result.awardId}_announced`,
        payload: {
          awardId: result.awardId,
          resultId: result.id,
          winnerSubjectId: result.winner.subjectId,
          winnerTeamId: result.winner.teamId,
          cutoffDate: awards.cutoffDate,
        },
      }),
    );
  }

  return systemResult(current, events);
}
