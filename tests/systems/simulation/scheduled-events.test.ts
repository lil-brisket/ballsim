import { describe, expect, it, afterEach } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  processScheduledEvents,
  registerScheduledEventHandler,
  scheduleEvent,
} from "@/systems/simulation/scheduled-events";
import {
  serializeGameState,
  deserializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { systemResult } from "@/domain/system-result";

describe("scheduled events", () => {
  afterEach(() => {
    registerScheduledEventHandler("noop", (state) => systemResult(state));
  });

  function baseState() {
    const state = createInitialGameState({
    saveId: "sched_evt", rngSeed: 3,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    return { state: bootstrapWorld(state, rng).state, rng };
  }

  it("keeps future events pending", () => {
    const { state, rng } = baseState();
    const withEvent = scheduleEvent(state, {
      id: "evt_future",
      type: "noop",
      triggerDate: "2026-12-01",
    }).state;

    const processed = processScheduledEvents(withEvent, rng);
    expect(processed.scheduledEventsProcessed).toBe(0);
    expect(processed.state.world.scheduledEvents.evt_future?.status).toBe(
      "pending",
    );
  });

  it("executes due events once in (triggerDate, id) order", () => {
    const { state, rng } = baseState();
    const order: string[] = [];
    registerScheduledEventHandler("noop", (current, event) => {
      order.push(event.id);
      return systemResult(current);
    });

    let current = scheduleEvent(state, {
      id: "evt_b",
      type: "noop",
      triggerDate: "2026-10-01",
    }).state;
    current = scheduleEvent(current, {
      id: "evt_a",
      type: "noop",
      triggerDate: "2026-10-01",
    }).state;
    current = scheduleEvent(current, {
      id: "evt_early",
      type: "noop",
      triggerDate: "2026-09-30",
    }).state;

    const first = processScheduledEvents(current, rng);
    expect(first.scheduledEventsProcessed).toBe(3);
    expect(order).toEqual(["evt_early", "evt_a", "evt_b"]);
    expect(first.state.world.scheduledEvents.evt_a?.status).toBe("executed");

    order.length = 0;
    const second = processScheduledEvents(first.state, rng);
    expect(second.scheduledEventsProcessed).toBe(0);
    expect(order).toEqual([]);
  });

  it("leaves the event pending when the handler throws", () => {
    const { state, rng } = baseState();
    registerScheduledEventHandler("noop", () => {
      throw new Error("handler boom");
    });

    const withEvent = scheduleEvent(state, {
      id: "evt_fail",
      type: "noop",
      triggerDate: "2026-10-01",
    }).state;

    expect(() => processScheduledEvents(withEvent, rng)).toThrow(/handler boom/);
    expect(withEvent.world.scheduledEvents.evt_fail?.status).toBe("pending");
  });

  it("survives save/load with executed status preserved", () => {
    const { state, rng } = baseState();
    let current = scheduleEvent(state, {
      id: "evt_persist",
      type: "noop",
      triggerDate: "2026-10-01",
    }).state;
    current = processScheduledEvents(current, rng).state;
    expect(current.world.scheduledEvents.evt_persist?.status).toBe("executed");

    const reloaded = deserializeGameState(serializeGameState(current));
    expect(reloaded.world.scheduledEvents.evt_persist?.status).toBe("executed");

    const again = processScheduledEvents(reloaded, rng);
    expect(again.scheduledEventsProcessed).toBe(0);
  });
});
