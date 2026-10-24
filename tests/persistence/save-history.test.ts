import { describe, expect, it } from "vitest";
import { draftClassIdFor } from "@/domain/entities/draft";
import { buildGameArchiveIndex } from "@/domain/entities/game-archive-index";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  mergeSaveHistory,
  splitColdHistory,
  withSaveHistory,
} from "@/persistence/save-history";
import { createTestGameState } from "../factories/game-state";
import { leagueWithHistory } from "./save-history-fixture";

describe("splitColdHistory", () => {
  it("keeps the current and previous seasons and moves the rest", () => {
    const state = leagueWithHistory();
    const year = state.competition.season.year;
    const { hot, chunks } = splitColdHistory(state);

    expect(Object.keys(hot.business.gameArchive).sort()).toEqual([
      "g_current",
      "g_prev",
      "g_unknown",
    ]);
    expect(Object.keys(hot.world.drafts).sort()).toEqual(
      [draftClassIdFor(year), draftClassIdFor(year + 1)].sort(),
    );
    expect(chunks.map((chunk) => chunk.chunkId)).toEqual([
      `draft:${draftClassIdFor(year - 1)}`,
      `games:season_${year - 3}`,
      `games:season_${year - 2}`,
    ]);
    expect(hot.business.gameArchiveIndex).toEqual(
      buildGameArchiveIndex(hot.business.gameArchive),
    );
  });

  it("puts back exactly what it took out", () => {
    const state = leagueWithHistory();
    const { hot, chunks } = splitColdHistory(state);
    const restored = withSaveHistory(
      hot,
      mergeSaveHistory(chunks.map((chunk) => chunk.history)),
    );
    expect(restored).toEqual(state);
  });

  it("returns the same state when nothing is old enough", () => {
    const state = createTestGameState({ saveId: "save_history_new" });
    const { hot, chunks } = splitColdHistory(state);
    expect(hot).toBe(state);
    expect(chunks).toEqual([]);
  });
});

describe("memory store history", () => {
  it("loads the snapshot without old history and the history on request", async () => {
    const store = createMemorySaveGameStore();
    const state = leagueWithHistory();
    await store.create({ id: "save_history", name: "History", state });

    const loaded = await store.load("save_history");
    expect(Object.keys(loaded!.state.business.gameArchive).sort()).toEqual([
      "g_current",
      "g_prev",
      "g_unknown",
    ]);
    const history = await store.loadHistory("save_history");
    expect(Object.keys(history.games).sort()).toEqual(["g_old_1", "g_old_2"]);
    expect(
      withSaveHistory(loaded!.state, history).business.gameArchive,
    ).toEqual(state.business.gameArchive);
  });

  it("keeps the first copy of a chunk and drops history with the save", async () => {
    const store = createMemorySaveGameStore();
    const state = leagueWithHistory();
    const created = await store.create({
      id: "save_history_twice",
      name: "History",
      state,
    });
    // Saving a league with its history merged back stores nothing twice.
    const merged = withSaveHistory(
      created.state,
      await store.loadHistory("save_history_twice"),
    );
    await store.save({ id: "save_history_twice", state: merged });
    const history = await store.loadHistory("save_history_twice");
    expect(Object.keys(history.games).sort()).toEqual(["g_old_1", "g_old_2"]);

    await store.delete("save_history_twice");
    expect(await store.loadHistory("save_history_twice")).toEqual({
      games: {},
      drafts: {},
    });
  });
});
