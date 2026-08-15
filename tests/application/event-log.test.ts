import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  advanceOwnerTime,
  createNewOwnerSave,
  saveOwnerGame,
} from "@/application/game-service";
import { createDomainEvent } from "@/domain/events";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import {
  appendEventLog,
  EVENT_LOG_MAX,
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import { toEventLogView } from "@/state/selectors";
import { TEST_RNG_SEED } from "../helpers/determinism";

describe("eventLog persistence", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("appends newly emitted events exactly once across save/reload", async () => {
    const created = await createNewOwnerSave(
      { name: "Event Log Franchise", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const saveId = created.save.id;

    const advanced = await advanceOwnerTime(saveId, { days: 1 }, store);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) {
      return;
    }

    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();
    const eventLog = loaded!.state.user.eventLog;
    expect(Array.isArray(eventLog)).toBe(true);

    const ids = eventLog.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);

    const countAfterAdvance = eventLog.length;

    await saveOwnerGame(saveId, loaded!.state, store);
    const reloaded = await store.load(saveId);
    expect(reloaded!.state.user.eventLog).toHaveLength(countAfterAdvance);
    expect(reloaded!.state.user.eventLog.map((e) => e.id)).toEqual(ids);

    const view = toEventLogView(reloaded!.state);
    expect(view).toHaveLength(countAfterAdvance);
  });

  it("bounds eventLog to EVENT_LOG_MAX most recent", () => {
    const base = {
      user: {
        controlledTeamId: "team_a",
        mode: "owner" as const,
        objectives: [],
        notifications: [],
        eventLog: [],
        appliedGameplayConsequenceKeys: {},
      },
    } as unknown as GameState;

    const many = Array.from({ length: EVENT_LOG_MAX + 50 }, (_, index) =>
      createDomainEvent({
        type: "GameCompleted",
        occurredOn: "2026-01-01",
        payload: { index },
      }),
    );

    const trimmed = appendEventLog(base, many);
    expect(trimmed.user.eventLog).toHaveLength(EVENT_LOG_MAX);
    expect(trimmed.user.eventLog[0]?.payload.index).toBe(50);
    expect(
      trimmed.user.eventLog[trimmed.user.eventLog.length - 1]?.payload.index,
    ).toBe(EVENT_LOG_MAX + 49);
  });

  it("migrates schema 22 saves with empty eventLog", async () => {
    const created = await createNewOwnerSave(
      { name: "Migrate Event Log", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const loaded = await store.load(created.save.id);
    expect(loaded).not.toBeNull();

    const asV22 = {
      ...loaded!.state,
      meta: { ...loaded!.state.meta, schemaVersion: 22 },
      user: {
        controlledTeamId: loaded!.state.user.controlledTeamId,
        mode: loaded!.state.user.mode,
        objectives: loaded!.state.user.objectives,
        notifications: loaded!.state.user.notifications,
        appliedGameplayConsequenceKeys:
          loaded!.state.user.appliedGameplayConsequenceKeys,
      },
    };

    const migrated = deserializeGameState(JSON.stringify(asV22));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.user.eventLog).toEqual([]);
    expect(serializeGameState(migrated)).toContain("eventLog");
  });
});
