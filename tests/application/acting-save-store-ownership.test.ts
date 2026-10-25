import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createActingSaveGameStore } from "@/application/online/acting-save-store";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { createTestGameState } from "../factories/game-state";

const OWNER = "user_owner";
const STRANGER = "user_stranger";

function actingAs(
  base: SaveGameStore,
  userId: string | null,
  requireSignIn = false,
) {
  return createActingSaveGameStore(base, async () => userId, {
    requireSignIn,
  });
}

async function ownedSave(base: SaveGameStore, id = "save_owned") {
  await actingAs(base, OWNER).create({
    id,
    name: "Owned",
    state: createTestGameState({ saveId: id }),
  });
  return id;
}

describe("acting save store ownership", () => {
  it("records the signed-in creator as the owner", async () => {
    const base = createMemorySaveGameStore();
    await ownedSave(base);
    expect((await base.load("save_owned"))?.ownerUserId).toBe(OWNER);
  });

  it("hides an owned save from other accounts and signed-out visitors", async () => {
    const base = createMemorySaveGameStore();
    const id = await ownedSave(base);

    for (const userId of [STRANGER, null]) {
      const store = actingAs(base, userId);
      expect(await store.load(id)).toBeNull();
      expect(await store.list()).toEqual([]);
    }
    expect(await actingAs(base, OWNER).load(id)).not.toBeNull();
    expect((await actingAs(base, OWNER).list()).map((s) => s.id)).toEqual([id]);
  });

  it("refuses writes and deletes from other accounts", async () => {
    const base = createMemorySaveGameStore();
    const id = await ownedSave(base);
    const state = (await base.load(id))!.state;

    await expect(actingAs(base, STRANGER).save({ id, state })).rejects.toThrow(
      /another account/,
    );
    await expect(actingAs(base, STRANGER).delete(id)).rejects.toThrow(
      /another account/,
    );
    expect(await base.load(id)).not.toBeNull();
    expect(await actingAs(base, OWNER).delete(id)).toBe(true);
  });

  it("keeps saves made signed out open to everyone locally", async () => {
    const base = createMemorySaveGameStore();
    await actingAs(base, null).create({
      id: "save_local",
      name: "Local",
      state: createTestGameState({ saveId: "save_local" }),
    });

    expect((await base.load("save_local"))?.ownerUserId).toBeNull();
    expect(await actingAs(base, STRANGER).load("save_local")).not.toBeNull();
    expect(await actingAs(base, null).load("save_local")).not.toBeNull();
  });

  it("requires an account for saves when sign-in is required", async () => {
    const base = createMemorySaveGameStore();
    await actingAs(base, null).create({
      id: "save_local",
      name: "Local",
      state: createTestGameState({ saveId: "save_local" }),
    });

    const hosted = actingAs(base, STRANGER, true);
    expect(await hosted.load("save_local")).toBeNull();
    await expect(hosted.delete("save_local")).rejects.toThrow(
      /another account/,
    );
    await expect(
      actingAs(base, null, true).create({
        id: "save_anon",
        name: "Anon",
        state: createTestGameState({ saveId: "save_anon" }),
      }),
    ).rejects.toThrow(/Sign in/);
  });
});
