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
  confirmOwnerTeamIdentity,
  createNewOwnerSave,
  selectOwnerCity,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { brandingFromPalette } from "@/domain/entities/team-branding";
import { getTeamIdentityFingerprint } from "@/domain/team-identity";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { listCitiesForTeamPick } from "@/state/selectors";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 600_000;

async function createCustomIdentitySave(
  store: ReturnType<typeof createMemorySaveGameStore>,
) {
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.area = "north_america";
  settings.ai.managementPreset = "full_management";
  const created = await createNewOwnerSave(
    { settings, name: "Identity Regression", rngSeed: TEST_RNG_SEED },
    store,
  );
  if (!created.ok) {
    throw new Error(created.error);
  }

  const beforeCity = await store.load(created.save.id);
  const city = listCitiesForTeamPick(beforeCity!.state)[0]!.city;
  const selected = await selectOwnerCity(created.save.id, city, store);
  if (!selected.ok) {
    throw new Error(selected.error);
  }

  const confirmed = await confirmOwnerTeamIdentity(
    created.save.id,
    {
      nickname: "Royals",
      paletteId: "royal_purple",
      logoId: "crown",
    },
    store,
  );
  if (!confirmed.ok) {
    throw new Error(confirmed.error);
  }

  return {
    saveId: created.save.id,
    teamId: confirmed.dashboard.controlledTeam.id,
    city,
  };
}

describe("franchise identity persistence regression", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it(
    "keeps customized identity across save/load and multi-day simulation",
    async () => {
      const { saveId, teamId, city } = await createCustomIdentitySave(store);
      const afterConfirm = await store.load(saveId);
      const before = getTeamIdentityFingerprint(
        afterConfirm!.state.world.teams[teamId]!,
      );
      expect(before).toMatchObject({
        name: "Royals",
        logoId: "crown",
        city,
      });
      expect(before.primaryColor).toBe(
        brandingFromPalette("royal_purple", "crown").primaryColor,
      );

      const roundTrip = deserializeGameState(
        serializeGameState(afterConfirm!.state),
      );
      expect(
        getTeamIdentityFingerprint(roundTrip.world.teams[teamId]!),
      ).toEqual(before);

      for (let day = 0; day < 30; day += 1) {
        const advanced = await advanceOwnerTime(saveId, { days: 1 }, store);
        expect(advanced.ok).toBe(true);
        if (!advanced.ok) {
          throw new Error(advanced.error);
        }
      }

      const afterSim = await store.load(saveId);
      expect(
        getTeamIdentityFingerprint(afterSim!.state.world.teams[teamId]!),
      ).toEqual(before);
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "keeps identity fingerprint stable across multi-season simulation",
    async () => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = "north_america";

      const sim = await runMultiYearSimulation({
        seasons: 2,
        advanceMode: "until_phase",
        managementPreset: "full_management",
        seed: TEST_RNG_SEED + 21,
        settingsBase: settings,
        saveReloadEachSeason: true,
      });

      const teamId = sim.finalState.user.activeOwnerTeamId;
      const afterYear1Load = await sim.store.load(sim.saveId);
      const fingerprint = getTeamIdentityFingerprint(
        afterYear1Load!.state.world.teams[teamId]!,
      );

      expect(fingerprint.logoId).toBeTruthy();
      expect(fingerprint.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(sim.seasonsCompleted).toBeGreaterThanOrEqual(2);

      const reloaded = deserializeGameState(
        serializeGameState(sim.finalState),
      );
      expect(
        getTeamIdentityFingerprint(reloaded.world.teams[teamId]!),
      ).toEqual(fingerprint);
      expect(reloaded.world.teams[teamId]!.city).toBe(fingerprint.city);
      expect(reloaded.world.teams[teamId]!.name).toBe(fingerprint.name);
      expect(reloaded.world.teams[teamId]!.branding.logoId).toBe(
        fingerprint.logoId,
      );
    },
    LONG_TIMEOUT_MS,
  );
});
