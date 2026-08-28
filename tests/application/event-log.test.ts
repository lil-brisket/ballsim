import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveOwnedFranchise } from "@/state/owner-context";

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
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
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
    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Event Log Franchise", rngSeed: TEST_RNG_SEED },
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
    const eventLog = getActiveOwnedFranchise(loaded!.state).eventLog;
    expect(Array.isArray(eventLog)).toBe(true);

    const ids = eventLog.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);

    const countAfterAdvance = eventLog.length;

    await saveOwnerGame(saveId, loaded!.state, store);
    const reloaded = await store.load(saveId);
    expect(getActiveOwnedFranchise(reloaded!.state).eventLog).toHaveLength(countAfterAdvance);
    expect(getActiveOwnedFranchise(reloaded!.state).eventLog.map((e) => e.id)).toEqual(ids);

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
        narrative: { situations: [], snapshots: [], cooldowns: {} },
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
    expect(getActiveOwnedFranchise(trimmed).eventLog).toHaveLength(EVENT_LOG_MAX);
    expect(getActiveOwnedFranchise(trimmed).eventLog[0]?.payload.index).toBe(50);
    expect(
      getActiveOwnedFranchise(trimmed).eventLog[getActiveOwnedFranchise(trimmed).eventLog.length - 1]?.payload.index,
    ).toBe(EVENT_LOG_MAX + 49);
  });

  it("migrates schema 22 saves with empty eventLog", async () => {
    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Migrate Event Log", rngSeed: TEST_RNG_SEED },
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
        controlledTeamId: loaded!.state.user.activeOwnerTeamId,
        mode: loaded!.state.user.mode,
        objectives: getActiveOwnedFranchise(loaded!.state).objectives,
        notifications: getActiveOwnedFranchise(loaded!.state).notifications,
        appliedGameplayConsequenceKeys:
          getActiveOwnedFranchise(loaded!.state).appliedGameplayConsequenceKeys,
      },
    };

    const migrated = deserializeGameState(JSON.stringify(asV22));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(getActiveOwnedFranchise(migrated).eventLog).toEqual([]);
    expect(serializeGameState(migrated)).toContain("eventLog");
  });
});

