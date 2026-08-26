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
import { getTeamIdentityFingerprint } from "@/domain/team-identity";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { listCitiesForTeamPick } from "@/state/selectors";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 120_000;

describe("franchise identity persistence regression", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it(
    "keeps customized identity across save/load and multi-day simulation",
    async () => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = "north_america";
      const created = await createNewOwnerSave(
        { settings, name: "Identity Regression", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const beforeCity = await store.load(created.save.id);
      const city = listCitiesForTeamPick(beforeCity!.state)[0]!.city;
      const selected = await selectOwnerCity(created.save.id, city, store);
      expect(selected.ok).toBe(true);

      const confirmed = await confirmOwnerTeamIdentity(
        created.save.id,
        {
          nickname: "Royals",
          paletteId: "royal_purple",
          logoId: "crown",
        },
        store,
      );
      expect(confirmed.ok).toBe(true);
      if (!confirmed.ok) {
        return;
      }

      const teamId = confirmed.dashboard.controlledTeam.id;
      const afterConfirm = await store.load(created.save.id);
      const before = getTeamIdentityFingerprint(
        afterConfirm!.state.world.teams[teamId]!,
      );
      expect(before).toMatchObject({
        name: "Royals",
        logoId: "crown",
        city,
      });

      const roundTrip = deserializeGameState(
        serializeGameState(afterConfirm!.state),
      );
      expect(
        getTeamIdentityFingerprint(roundTrip.world.teams[teamId]!),
      ).toEqual(before);

      for (let day = 0; day < 14; day += 1) {
        const advanced = await advanceOwnerTime(
          created.save.id,
          { days: 1 },
          store,
        );
        expect(advanced.ok).toBe(true);
        if (!advanced.ok) {
          throw new Error(advanced.error);
        }
      }

      const afterSim = await store.load(created.save.id);
      expect(
        getTeamIdentityFingerprint(afterSim!.state.world.teams[teamId]!),
      ).toEqual(before);

      const afterReload = deserializeGameState(
        serializeGameState(afterSim!.state),
      );
      expect(
        getTeamIdentityFingerprint(afterReload.world.teams[teamId]!),
      ).toEqual(before);
    },
    LONG_TIMEOUT_MS,
  );
});
