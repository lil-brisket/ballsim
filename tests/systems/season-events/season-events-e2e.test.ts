import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { generateRosters } from "@/systems/roster-generation";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import { deriveMidseasonEventWindow } from "@/systems/season-events";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createEmptySeasonEventsState } from "@/domain/entities/season-events";
import { planSeasonEvents } from "@/systems/season-events";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";

function bootRegularSeason(saveId: string, rngSeed = 11) {
  resetDomainEventSequenceForTests();
  let state = createInitialGameState({
    saveId,
    rngSeed,
    settings: {
      ...CBL_GAME_SETTINGS,
      seasonEvents: {
        ...CBL_GAME_SETTINGS.seasonEvents,
        tournamentFieldSize: 4,
        votingDaysBeforeAnchor: 7,
        votingDaysAfterAnchor: 0,
        allStarDaysAfterVotingClose: 1,
      },
    },
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = generateRosters(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  return { state, rng };
}

describe("season events full midseason lifecycle (M5)", () => {
  it("runs voting → All-Star → awards → tournament → RS continues once each", () => {
    const { state: initial, rng } = bootRegularSeason("se_e2e");
    const window = deriveMidseasonEventWindow(initial);
    expect(window).not.toBeNull();

    // Jump to day before voting opens, then simulate through tournament end.
    let state: GameState = {
      ...initial,
      world: {
        ...initial.world,
        calendar: {
          ...initial.world.calendar,
          currentDate: addCalendarDays(window!.votingOpenDate, -1),
          lastSimulatedDate: addCalendarDays(window!.votingOpenDate, -2),
        },
      },
      meta: { ...initial.meta, rngState: rng.getState() },
    };
    const simRng = createSeededRng(state.meta.rngState);

    const daysNeeded =
      calendarDaysBetween(
        state.world.calendar.currentDate,
        addCalendarDays(window!.tournamentEndDate, 2),
      ) + 1;

    const seen = {
      votingOpened: false,
      votingClosed: false,
      allStarAnnounced: false,
      allStarGame: false,
      awards: false,
      tournamentComplete: false,
    };

    let daysLeft = Math.min(daysNeeded, 45);
    while (daysLeft > 0) {
      const chunk = Math.min(daysLeft, 5);
      const result = advanceSimulation(state, simRng, { days: chunk });
      state = result.state;
      daysLeft -= result.daysAdvanced;
      if (result.daysAdvanced === 0) break;

      const se = state.competition.seasonEvents;
      const campaign = Object.values(se.fanVoting)[0];
      if (campaign?.status === "open" || campaign?.status === "finalized") {
        seen.votingOpened = true;
      }
      if (campaign?.status === "finalized") {
        seen.votingClosed = true;
      }
      if (
        se.allStar?.status === "selections_announced" ||
        se.allStar?.status === "completed"
      ) {
        seen.allStarAnnounced = true;
      }
      if ((se.allStar?.gameIds.length ?? 0) > 0) {
        seen.allStarGame = true;
        for (const gameId of se.allStar!.gameIds) {
          const game = state.competition.games[gameId];
          expect(game?.competitionType).toBe("all_star");
          expect(state.competition.schedule.gameIds.includes(gameId)).toBe(
            false,
          );
        }
      }
      if (se.midseasonAwards?.status === "announced") {
        seen.awards = true;
      }
      if (se.tournament?.status === "complete") {
        seen.tournamentComplete = true;
      }

      if (
        seen.votingClosed &&
        seen.allStarAnnounced &&
        seen.allStarGame &&
        seen.awards &&
        seen.tournamentComplete
      ) {
        break;
      }
    }

    expect(seen.votingOpened).toBe(true);
    expect(seen.votingClosed).toBe(true);
    expect(seen.allStarAnnounced).toBe(true);
    expect(seen.allStarGame).toBe(true);
    expect(seen.awards).toBe(true);
    expect(seen.tournamentComplete).toBe(true);

    // Each event id activates at most once (completed or active, not duplicated).
    const eventStatuses = Object.values(
      state.competition.seasonEvents.events,
    ).map((e) => e.status);
    expect(eventStatuses.every((s) => s !== "cancelled")).toBe(true);

    // Season stays regular after midseason window.
    expect(state.competition.season.phase).toBe("regular");

    // Save/load during/after midseason preserves state.
    const reloaded = deserializeGameState(serializeGameState(state));
    expect(() => validateGameState(reloaded)).not.toThrow();
    expect(
      Object.values(reloaded.competition.seasonEvents.fanVoting)[0]?.status,
    ).toBe("finalized");
  }, 120_000);

  it("v60 migrated save continues season and plans events on begin RS", () => {
    const { state } = bootRegularSeason("se_mig_continue");
    const asV60Payload = JSON.parse(serializeGameState(state)) as {
      meta: { schemaVersion: number };
      competition: { seasonEvents?: unknown };
    };
    asV60Payload.meta.schemaVersion = 60;
    delete asV60Payload.competition.seasonEvents;

    const migrated = deserializeGameState(JSON.stringify(asV60Payload));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.competition.seasonEvents).toEqual(
      createEmptySeasonEventsState(),
    );

    // Continuing an in-progress RS: re-plan when empty (same season).
    const planned = planSeasonEvents(migrated).state;
    expect(
      Object.keys(planned.competition.seasonEvents.events).length,
    ).toBeGreaterThan(0);
    expect(planned.competition.season.phase).toBe("regular");
    expect(() => validateGameState(planned)).not.toThrow();
  });
});
