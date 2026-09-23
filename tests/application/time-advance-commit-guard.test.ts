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
import { resetSimulationDedupeForTests } from "@/application/simulation-guard";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { SAVE_VERSION_CONFLICT_USER_MESSAGE } from "@/application/time-advance-mutation";

const LONG_TIMEOUT_MS = 120_000;

async function seedRegularSave(id: string, seed: number) {
  resetDomainEventSequenceForTests();
  resetSimulationDedupeForTests();
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

describe("time-advance commit guard", () => {
  it(
    "second concurrent advance fails cleanly; winner state is persisted",
    async () => {
      const saveId = "commit_guard_race";
      const { store } = await seedRegularSave(saveId, 70);
      const before = await store.load(saveId);
      const dateBefore = before!.state.world.calendar.currentDate;

      // Start both advances without awaiting the first to completion.
      // In-process dedupe rejects the second immediately; CAS would also
      // reject if both ran to persist.
      const firstPromise = advanceOwnerTime(saveId, { days: 1 }, store);
      const secondPromise = advanceOwnerTime(saveId, { days: 1 }, store);

      const [first, second] = await Promise.all([firstPromise, secondPromise]);
      const outcomes = [first, second];
      const successes = outcomes.filter((r) => r.ok);
      const failures = outcomes.filter((r) => !r.ok);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (!failures[0]!.ok) {
        expect(
          failures[0].error === "Simulation already in progress for this save." ||
            failures[0].error === SAVE_VERSION_CONFLICT_USER_MESSAGE,
        ).toBe(true);
      }

      const after = await store.load(saveId);
      expect(after!.state.world.calendar.currentDate).not.toBe(dateBefore);
      if (successes[0]!.ok) {
        expect(after!.state.world.calendar.currentDate).toBe(
          successes[0].simulation.currentDate,
        );
      }
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "stale ifUpdatedAt at persist rejects without writing",
    async () => {
      const saveId = "commit_guard_stale";
      const { store } = await seedRegularSave(saveId, 71);
      const loaded = await store.load(saveId);
      const originalUpdatedAt = loaded!.updatedAt;

      // Intercept: after load token is captured, mutate the row so persist CAS fails.
      // We simulate by wrapping save to first force a conflicting write once.
      let conflictInjected = false;
      const originalSave = store.save.bind(store);
      store.save = async (input) => {
        if (input.ifUpdatedAt != null && !conflictInjected) {
          conflictInjected = true;
          // External write with unconditional save (no token) bumps updatedAt.
          await originalSave({
            id: input.id,
            state: {
              ...input.state,
              meta: {
                ...input.state.meta,
                updatedAt: "2099-01-01T00:00:00.000Z",
              },
            },
          });
        }
        return originalSave(input);
      };

      resetSimulationDedupeForTests();
      const result = await advanceOwnerTime(saveId, { days: 1 }, store);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(SAVE_VERSION_CONFLICT_USER_MESSAGE);
      }

      // Row was bumped by the injected write, not by a successful simulation commit
      // of the advance — calendar may or may not have moved depending on whether
      // the injected write used the simulated state. Reload and ensure we did not
      // silently succeed the advance as ok:true.
      const after = await store.load(saveId);
      expect(after!.updatedAt.getTime()).not.toBe(originalUpdatedAt.getTime());
    },
    LONG_TIMEOUT_MS,
  );
});
