import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createNewOwnerSave,
  exportOwnerSave,
  importOwnerSave,
} from "@/application/game-service";
import { createActingSaveGameStore } from "@/application/online/acting-save-store";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  encodeSaveExport,
  saveExportFileName,
} from "@/persistence/save-export";
import { withSaveHistory } from "@/persistence/save-history";
import { leagueWithHistory } from "../persistence/save-history-fixture";
import { TEST_RNG_SEED } from "../helpers/determinism";

const OWNER = "user_owner";

function actingAs(
  base: ReturnType<typeof createMemorySaveGameStore>,
  userId: string | null,
) {
  return createActingSaveGameStore(base, async () => userId);
}

describe("save export and import", () => {
  it("round-trips a league, history included, into an independent copy", async () => {
    const base = createMemorySaveGameStore();
    const store = actingAs(base, OWNER);
    await store.create({
      id: "save_original",
      name: "Dynasty",
      state: leagueWithHistory("save_original"),
    });

    const exported = await exportOwnerSave("save_original", store);
    expect(exported?.fileName).toBe("dynasty.ballsim.json");

    const imported = await importOwnerSave(exported!.json, store);
    if (!imported.ok) throw new Error(imported.error);
    const copyId = imported.save.id;
    expect(copyId).not.toBe("save_original");
    expect(imported.save.name).toBe("Dynasty");

    const copy = (await store.load(copyId))!;
    expect(copy.state.meta.saveId).toBe(copyId);
    expect(copy.ownerUserId).toBe(OWNER);
    const history = await store.loadHistory(copyId);
    const withHistory = withSaveHistory(copy.state, history);
    expect(Object.keys(withHistory.business.gameArchive).sort()).toEqual([
      "g_current",
      "g_old_1",
      "g_old_2",
      "g_prev",
      "g_unknown",
    ]);
    expect(await store.load("save_original")).not.toBeNull();
  });

  it("does not export a save the caller cannot open", async () => {
    const base = createMemorySaveGameStore();
    await actingAs(base, OWNER).create({
      id: "save_private",
      name: "Private",
      state: leagueWithHistory("save_private"),
    });
    expect(
      await exportOwnerSave("save_private", actingAs(base, "user_other")),
    ).toBeNull();
  });

  it("rejects files that are not save exports", async () => {
    const store = actingAs(createMemorySaveGameStore(), null);
    for (const text of ["not json", "{}", '{"format":"other"}']) {
      const result = await importOwnerSave(text, store);
      expect(result).toMatchObject({ ok: false });
    }
    const wrongVersion = await importOwnerSave(
      JSON.stringify({ format: "ballsim-save", version: 99, state: {} }),
      store,
    );
    expect(wrongVersion).toMatchObject({
      ok: false,
      error: expect.stringMatching(/different version/),
    });
  });

  it("refuses to import an online league", async () => {
    const base = createMemorySaveGameStore();
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.league.area = "north_america";
    const created = await createNewOwnerSave(
      {
        settings,
        name: "Online",
        rngSeed: TEST_RNG_SEED,
        participation: { mode: "online" },
        hostUser: { id: OWNER, username: "owner" },
      },
      actingAs(base, OWNER),
    );
    if (!created.ok) throw new Error(created.error);
    const state = (await base.load(created.save.id))!.state;

    const result = await importOwnerSave(
      encodeSaveExport("Online", state, "2026-10-24T00:00:00.000Z"),
      actingAs(base, OWNER),
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Online leagues/),
    });
  });

  it("names files safely", () => {
    expect(saveExportFileName("My League: Year 2!")).toBe(
      "my-league-year-2.ballsim.json",
    );
    expect(saveExportFileName("???")).toBe("save.ballsim.json");
  });
});
