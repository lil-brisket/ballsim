import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { advanceOwnerTime } from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { addCalendarDays } from "@/domain/calendar-date";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { serializeGameState } from "@/persistence/mappers/game-state-mapper";

async function seedPreseasonSave(id: string, seed: number) {
  resetDomainEventSequenceForTests();
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
  await store.create({ id, name: id, state });
  return { store, state };
}

async function seedRegularSave(id: string, seed: number) {
  resetDomainEventSequenceForTests();
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  state = {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
  await store.create({ id, name: id, state });
  return { store, state };
}

describe("simulate-to-date", () => {
  it("rejects simulating to a past date", async () => {
    const { store, state } = await seedRegularSave("sim_past", 31);
    const past = addCalendarDays(state.world.calendar.currentDate, -3);
    const result = await advanceOwnerTime(
      "sim_past",
      { targetDate: past },
      store,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/backward/i);
    }
  });

  it("rejects simulating to the current date", async () => {
    const { store, state } = await seedRegularSave("sim_same", 32);
    const result = await advanceOwnerTime(
      "sim_same",
      { targetDate: state.world.calendar.currentDate },
      store,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Already at/i);
    }
  });

  it("advances sequentially to a future date", async () => {
    const { store, state } = await seedRegularSave("sim_forward", 33);
    const from = state.world.calendar.currentDate;
    const target = addCalendarDays(from, 3);
    const result = await advanceOwnerTime(
      "sim_forward",
      { targetDate: target },
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.simulation.stopReason).not.toBe("user_team_game");
    expect(result.simulation.stopReason).not.toBe("phase_change");
    if (result.simulation.stopReason === "pending_owner_decision") {
      expect(result.simulation.currentDate > from).toBe(true);
      expect(result.simulation.currentDate <= target).toBe(true);
    } else {
      expect(result.simulation.currentDate).toBe(target);
      expect(result.simulation.daysAdvanced).toBe(3);
    }

    const reloaded = await store.load("sim_forward");
    expect(reloaded!.state.world.calendar.currentDate).toBe(
      result.simulation.currentDate,
    );
  });

  it("lands on a preseason target without overshooting before opening night", async () => {
    const { store, state } = await seedPreseasonSave("sim_pre_jump", 36);
    const from = state.world.calendar.currentDate;
    const target = addCalendarDays(from, 4);
    const result = await advanceOwnerTime(
      "sim_pre_jump",
      { targetDate: target },
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.simulation.stopReason).not.toBe("user_team_game");
    expect(result.simulation.stopReason).not.toBe("phase_change");
    if (result.simulation.stopReason === "pending_owner_decision") {
      expect(result.simulation.currentDate > from).toBe(true);
      expect(result.simulation.currentDate <= target).toBe(true);
    } else {
      expect(result.simulation.currentDate).toBe(target);
      expect(result.simulation.daysAdvanced).toBe(4);
    }
  });

  it("persists media feed fields after multi-day advance", async () => {
    const { store } = await seedRegularSave("sim_roundtrip", 34);
    const loaded = await store.load("sim_roundtrip");
    const target = addCalendarDays(loaded!.state.world.calendar.currentDate, 2);
    const result = await advanceOwnerTime(
      "sim_roundtrip",
      { targetDate: target },
      store,
    );
    expect(result.ok).toBe(true);
    const after = await store.load("sim_roundtrip");
    const json = serializeGameState(after!.state);
    expect(json.length).toBeGreaterThan(100);
    const franchise =
      after!.state.user.ownedFranchises[after!.state.user.activeOwnerTeamId];
    expect(franchise.mediaFeed).toBeDefined();
    expect(franchise.mediaReadState).toBeDefined();
    expect(franchise.socialFeed).toBeDefined();
  });
});
