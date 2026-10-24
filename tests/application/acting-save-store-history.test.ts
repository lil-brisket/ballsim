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
});
