import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { generateRosters } from "@/systems/roster-generation";
import {
  deriveMidseasonAnchorDate,
  deriveMidseasonEventWindow,
  planSeasonEvents,
  processSeasonEvents,
} from "@/systems/season-events";
import {
  serializeGameState,
  deserializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createEmptySeasonEventsState } from "@/domain/entities/season-events";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { addCalendarDays } from "@/domain/calendar-date";

function bootRegularSeason(saveId: string) {
  let state = createInitialGameState({
    saveId,
    rngSeed: 42,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = generateRosters(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  return { state, rng };
}

describe("season events foundation", () => {
  it("plans events from committed RS schedule dates", () => {
    const { state } = bootRegularSeason("se_plan");
    expect(Object.keys(state.competition.seasonEvents.events).length).toBeGreaterThan(0);
    const window = deriveMidseasonEventWindow(state);
    expect(window).not.toBeNull();
    const anchor = deriveMidseasonAnchorDate(state);
    expect(anchor).toBe(window!.anchorDate);
    expect(window!.votingOpenDate <= window!.votingCloseDate).toBe(true);
  });

  it("planSeasonEvents is idempotent", () => {
    const { state } = bootRegularSeason("se_idempotent");
    const firstCount = Object.keys(state.competition.seasonEvents.events).length;
    const second = planSeasonEvents(state).state;
    expect(Object.keys(second.competition.seasonEvents.events).length).toBe(
      firstCount,
    );
  });

  it("activates and completes holidays without interrupting simulation", () => {
    const { state, rng } = bootRegularSeason("se_holiday");
    const holiday = Object.values(state.competition.seasonEvents.holidays)[0];
    expect(holiday).toBeDefined();

    let current = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: holiday!.startDate,
          lastSimulatedDate: addCalendarDays(holiday!.startDate, -1),
        },
      },
    };

    const result = processSeasonEvents(current, rng);
    const after = result.state.competition.seasonEvents.holidays[holiday!.key]!;
    expect(after.status === "active" || after.status === "completed").toBe(true);
    expect(
      result.events.some((e) => e.type === "HolidayStarted"),
    ).toBe(true);
  });

  it("survives serialize/deserialize with planned events", () => {
    const { state } = bootRegularSeason("se_persist");
    const reloaded = deserializeGameState(serializeGameState(state));
    expect(reloaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(
      Object.keys(reloaded.competition.seasonEvents.events).length,
    ).toBe(Object.keys(state.competition.seasonEvents.events).length);
  });

  it("migrates v60 saves to empty seasonEvents", () => {
    const { state } = bootRegularSeason("se_migrate");
    const asV60 = {
      ...state,
      meta: { ...state.meta, schemaVersion: 60 },
      competition: {
        ...state.competition,
      },
    };
    delete (asV60.competition as { seasonEvents?: unknown }).seasonEvents;
    const json = JSON.stringify(asV60);
    // Force schema version 60 in the payload
    const parsed = JSON.parse(json) as { meta: { schemaVersion: number } };
    parsed.meta.schemaVersion = 60;
    const migrated = deserializeGameState(JSON.stringify(parsed));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.competition.seasonEvents).toEqual(
      createEmptySeasonEventsState(),
    );
  });

  it("processes fan voting open on voting open date", () => {
    const { state, rng } = bootRegularSeason("se_vote_open");
    const campaign = Object.values(state.competition.seasonEvents.fanVoting)[0]!;
    let current = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: campaign.openDate,
          lastSimulatedDate: addCalendarDays(campaign.openDate, -1),
        },
      },
    };
    const result = processSeasonEvents(current, rng);
    const updated = Object.values(
      result.state.competition.seasonEvents.fanVoting,
    )[0]!;
    expect(updated.status).toBe("open");
    expect(
      result.events.some((e) => e.type === "MidseasonVotingOpened"),
    ).toBe(true);
  });

  it("multi-day advance ticks votes deterministically", () => {
    const { state, rng } = bootRegularSeason("se_vote_tick");
    const campaign = Object.values(state.competition.seasonEvents.fanVoting)[0]!;

    let jump: GameState = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: campaign.openDate,
          lastSimulatedDate: addCalendarDays(campaign.openDate, -1),
        },
      },
      meta: { ...state.meta, rngState: rng.getState() },
    };

    const jumpRng = createSeededRng(jump.meta.rngState);
    const jumped = advanceSimulation(jump, jumpRng, { days: 5 });
    jump = jumped.state;

    const afterJump = Object.values(jump.competition.seasonEvents.fanVoting)[0]!;
    expect(afterJump.status).toBe("open");
    expect(afterJump.lastTickDate).not.toBeNull();

    const totals = Object.values(afterJump.categories).flatMap((c) =>
      Object.values(c.candidates).map((x) => x.voteTotal),
    );
    expect(totals.some((t) => t > 0)).toBe(true);
  });
});
