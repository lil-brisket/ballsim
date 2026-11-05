import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createActingSaveGameStore } from "@/application/online/acting-save-store";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { leagueWithHistory } from "../persistence/save-history-fixture";

describe("acting save store history", () => {
  it("reads a league's history only after loading the league", async () => {
    const base = createMemorySaveGameStore();
    await base.create({
      id: "save_acting_history",
      name: "History",
      state: leagueWithHistory("save_acting_history"),
    });
    const store = createActingSaveGameStore(base, async () => null);

    await expect(store.loadHistory("save_acting_history")).rejects.toThrow(
      /follow a load/,
    );
    expect(await store.load("save_acting_history")).not.toBeNull();
    const history = await store.loadHistory("save_acting_history");
    expect(Object.keys(history.games).sort()).toEqual(["g_old_1", "g_old_2"]);
  });

  it("reads history after a read-only load too", async () => {
    const base = createMemorySaveGameStore();
    await base.create({
      id: "save_acting_read",
      name: "History",
      state: leagueWithHistory("save_acting_read"),
    });
    const store = createActingSaveGameStore(base, async () => null);

    expect(await store.loadReadOnly?.("save_acting_read")).not.toBeNull();
    const history = await store.loadHistory("save_acting_read");
    expect(Object.keys(history.games).sort()).toEqual(["g_old_1", "g_old_2"]);
  });

  it("hides another account's save from a read-only load, even when cached", async () => {
    const memory = createMemorySaveGameStore();
    await memory.create({
      id: "save_acting_owned",
      name: "Owned",
      ownerUserId: "owner",
      state: leagueWithHistory("save_acting_owned"),
    });
    const cached = await memory.load("save_acting_owned");
    const base = { ...memory, loadReadOnly: async () => cached };

    const owner = createActingSaveGameStore(base, async () => "owner");
    expect(await owner.loadReadOnly?.("save_acting_owned")).not.toBeNull();

    const stranger = createActingSaveGameStore(base, async () => "stranger");
    expect(await stranger.loadReadOnly?.("save_acting_owned")).toBeNull();
    await expect(stranger.loadHistory("save_acting_owned")).rejects.toThrow(
      /follow a load/,
    );
  });
});
