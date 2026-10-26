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

import { loadSettingsView } from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  restrictedFreeAgencyLockReason,
  seasonFormatLockReason,
} from "@/systems/league-settings-edit";
import { bootstrapWorld } from "@/systems/world-pipeline";

async function seed() {
  const id = "settings_view";
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: 11,
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  await store.create({ id, name: id, state });
  return { id, store, state };
}

describe("loadSettingsView", () => {
  it("returns null for a missing save", async () => {
    expect(
      await loadSettingsView("nope", undefined, createMemorySaveGameStore()),
    ).toBeNull();
  });

  it("returns locks, teams and draft years as plain data", async () => {
    const { id, store, state } = await seed();
    const view = await loadSettingsView(id, undefined, store);
    expect(view).not.toBeNull();
    expect(view!.canEditLeague).toBe(true);
    expect(view!.leagueName).toBe(state.world.league.name);
    expect(view!.liveTeamCount).toBe(Object.keys(state.world.teams).length);
    expect(view!.teams).toHaveLength(view!.liveTeamCount);
    const labels = view!.teams.map((team) => team.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(view!.draftYears).toEqual(
      Object.values(state.world.drafts)
        .map((draft) => draft.seasonYear)
        .sort((a, b) => a - b),
    );
    expect(view!.seasonFormatLock).toBe(seasonFormatLockReason(state));
    expect(view!.rfaLock).toBe(restrictedFreeAgencyLockReason(state));
    expect(view!.selectedTeamId).toBeNull();
    expect(view!.selectedPlayer).toBeNull();
    expect(() => structuredClone(view)).not.toThrow();
  });

  it("loads the selected team players and the selected player fields", async () => {
    const { id, store, state } = await seed();
    const player = Object.values(state.world.players).find(
      (candidate) => candidate.teamId !== null && !candidate.retired,
    )!;
    const view = await loadSettingsView(
      id,
      { teamId: player.teamId!, playerId: player.id },
      store,
    );
    expect(view!.selectedTeamId).toBe(player.teamId);
    expect(view!.teamPlayers.some((entry) => entry.id === player.id)).toBe(
      true,
    );
    expect(view!.selectedPlayer).toMatchObject({
      id: player.id,
      firstName: player.firstName,
      age: player.age,
      potential: player.potential.overall,
    });
    expect(view!.selectedPlayer!.attributes).toEqual(player.attributes);

    const mismatched = await loadSettingsView(
      id,
      { teamId: "not_a_team", playerId: player.id },
      store,
    );
    expect(mismatched!.selectedPlayer).toBeNull();
  });
});
