import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  serializeGameState,
  deserializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { addCalendarDays } from "@/domain/calendar-date";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

function normalizeMeta(state: ReturnType<typeof createInitialGameState>) {
  return {
    ...state,
    meta: {
      ...state.meta,
      updatedAt: "normalized",
    },
  };
}

describe("simulation persistence and determinism", () => {
  it("migrates schemaVersion 20 into simulation backbone fields", () => {
    const modern = createInitialGameState({
    saveId: "mig_v20",
    settings: CBL_GAME_SETTINGS,
  });
    const v20 = {
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 20,
      },
      world: {
        ...modern.world,
        calendar: { currentDate: modern.world.calendar.currentDate },
        // drop v21-only fields
        scheduledEvents: undefined,
      },
      competition: {
        ...modern.competition,
        season: {
          id: modern.competition.season.id,
          year: modern.competition.season.year,
          phase: modern.competition.season.phase,
        },
      },
    };
    // Remove keys that would confuse JSON round-trip of a true v20 blob
    const { scheduledEvents: _drop, ...worldWithoutEvents } = {
      ...v20.world,
      scheduledEvents: undefined,
    };
    const blob = {
      ...v20,
      world: {
        calendar: { currentDate: "2026-10-01" },
        league: worldWithoutEvents.league,
        conferences: worldWithoutEvents.conferences,
        divisions: worldWithoutEvents.divisions,
        teams: worldWithoutEvents.teams,
        players: worldWithoutEvents.players,
        coaches: worldWithoutEvents.coaches,
        staff: worldWithoutEvents.staff,
        draftPicks: worldWithoutEvents.draftPicks,
        drafts: worldWithoutEvents.drafts,
      },
      competition: {
        ...v20.competition,
        season: {
          id: modern.competition.season.id,
          year: 2026,
          phase: "preseason",
        },
      },
    };

    const loaded = deserializeGameState(JSON.stringify(blob));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.world.calendar.lastSimulatedDate).toBe(
      addCalendarDays("2026-10-01", -1),
    );
    expect(loaded.world.calendar.lastSimulatedWeekId).toBeNull();
    expect(loaded.world.scheduledEvents).toEqual({});
    expect(loaded.competition.season.offseasonStage).toBe("none");
  });

  it("advance → save → load → advance matches uninterrupted simulation", () => {
    resetDomainEventSequenceForTests();
    const initial = createInitialGameState({
    saveId: "det_roundtrip",
      rngSeed: 99,
    settings: CBL_GAME_SETTINGS,
  });

    const withRng = (
      state: typeof initial,
      rng: ReturnType<typeof createSeededRng>,
    ) => ({
      ...state,
      meta: { ...state.meta, rngState: rng.getState() },
    });

    const rngA = createSeededRng(initial.meta.rngState);
    let pathA = bootstrapWorld(initial, rngA).state;
    pathA = withRng(advanceSimulation(pathA, rngA).state, rngA);

    const reloaded = deserializeGameState(serializeGameState(pathA));
    const rngB = createSeededRng(reloaded.meta.rngState);
    const afterReload = withRng(advanceSimulation(reloaded, rngB).state, rngB);

    resetDomainEventSequenceForTests();
    const rngC = createSeededRng(initial.meta.rngState);
    let pathC = bootstrapWorld(initial, rngC).state;
    pathC = withRng(advanceSimulation(pathC, rngC).state, rngC);
    pathC = withRng(advanceSimulation(pathC, rngC).state, rngC);

    expect(normalizeMeta(afterReload)).toEqual(normalizeMeta(pathC));
  });
});
