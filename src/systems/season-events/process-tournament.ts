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
  qualifyAndStartTournament,
  simulateTournamentGamesForDate,
} from "@/systems/season-events/tournament-engine";

/**
 * Midseason tournament (M4): qualify, bracket games, champion.
 * Games use competitionType midseason_tournament — never alter RS standings.
 */
export function processTournament(
  state: GameState,
  rng: Rng,
  simulatedDate: string,
): SystemResult {
  const seasonEvents = ensureSeasonEventsState(state);
  let tournament = seasonEvents.tournament;
  if (tournament == null) {
    return systemResult(state);
  }

  let current = state;
  const events: DomainEvent[] = [];

  if (
    tournament.status === "not_started" &&
    tournament.startDate.length > 0 &&
    tournament.startDate <= simulatedDate
  ) {
    const started = qualifyAndStartTournament(current, tournament);
    current = started.state;
    events.push(...started.events);
    tournament = ensureSeasonEventsState(current).tournament;

    if (tournament == null || tournament.fieldSize < 2) {
      const eventEntry = Object.values(
        ensureSeasonEventsState(current).events,
      ).find((e) => e.type === "midseason_tournament");
      if (eventEntry) {
        current = withSeasonEvents(current, {
          ...ensureSeasonEventsState(current),
          events: {
            ...ensureSeasonEventsState(current).events,
            [eventEntry.id]: { ...eventEntry, status: "cancelled" },
          },
          tournament: null,
        });
      }
      return systemResult(current, events);
    }

    events.push(
      createSeasonDomainEvent({
        type: "MidseasonTournamentStarted",
        occurredOn: tournament.startDate,
        key: `${tournament.seasonId}_tournament_started`,
        payload: {
          fieldSize: tournament.fieldSize,
          format: tournament.format,
          teamIds: tournament.qualifiedTeams.map((t) => t.teamId),
        },
      }),
    );

    const eventEntry = Object.values(
      ensureSeasonEventsState(current).events,
    ).find((e) => e.type === "midseason_tournament");
    if (eventEntry) {
      current = withSeasonEvents(current, {
        ...ensureSeasonEventsState(current),
        events: {
          ...ensureSeasonEventsState(current).events,
          [eventEntry.id]: { ...eventEntry, status: "active" },
        },
      });
    }
  }

  tournament = ensureSeasonEventsState(current).tournament;
  if (tournament != null && tournament.status === "in_progress") {
    const day = simulateTournamentGamesForDate(current, rng, simulatedDate);
    current = day.state;
    events.push(...day.events);
  }

  tournament = ensureSeasonEventsState(current).tournament;
  if (tournament != null && tournament.status === "complete") {
    const eventEntry = Object.values(
      ensureSeasonEventsState(current).events,
    ).find((e) => e.type === "midseason_tournament");
    if (eventEntry && eventEntry.status !== "completed") {
      current = withSeasonEvents(current, {
        ...ensureSeasonEventsState(current),
        events: {
          ...ensureSeasonEventsState(current).events,
          [eventEntry.id]: { ...eventEntry, status: "completed" },
        },
      });
      events.push(
        createSeasonDomainEvent({
          type: "MidseasonTournamentCompleted",
          occurredOn: simulatedDate,
          key: `${tournament.seasonId}_tournament_completed`,
          payload: {
            championTeamId: tournament.championTeamId ?? null,
            fieldSize: tournament.fieldSize,
          },
        }),
      );
    }
  }

  return systemResult(current, events);
}
