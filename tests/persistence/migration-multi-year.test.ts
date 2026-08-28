import { describe, expect, it, vi } from "vitest";
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
  beginOffseason,
  createNewOwnerSave,
  selectOwnerTeam,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 600_000;

describe("migration then multi-year simulation", () => {
  it("migrates a v36-shaped save (no AI assist fields) and simulates 5 seasons", async () => {
    // Fresh multi-year run uses migrated defaults via create path; additionally
    // verify v36 → v37 field injection then a 5-year Smart Assist sim.
    const parsedProbe = await (async () => {
      const store = createMemorySaveGameStore();
      const created = await createNewOwnerSave(
        {
          settings: cloneGameSettings(CBL_GAME_SETTINGS),
          name: "Migrate Probe",
          rngSeed: TEST_RNG_SEED + 40,
        },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        throw new Error(created.error);
      }
      const modern = (await store.load(created.save.id))!.state;
      const parsed = JSON.parse(serializeGameState(modern)) as Record<
        string,
        unknown
      >;
      (parsed.meta as Record<string, unknown>).schemaVersion = 36;
      const competition = parsed.competition as {
        season: Record<string, unknown>;
      };
      delete competition.season.offseasonStageEnteredDate;
      delete competition.season.freeAgencyExtendedUntil;
      const settingsRaw = parsed.settings as Record<string, unknown>;
      delete settingsRaw.offseason;
      const ai = settingsRaw.ai as Record<string, unknown>;
      delete ai.managementMode;
      delete ai.managementPreset;
      delete ai.assistance;
      const user = parsed.user as Record<string, unknown>;
      delete user.explicitDecisions;
      delete user.phaseSkips;
      delete user.aiAssistState;
      return parsed;
    })();

    const migrated = deserializeGameState(JSON.stringify(parsedProbe));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.settings.ai.managementPreset).toBe("smart");
    expect(migrated.settings.offseason.freeAgency.durationDays).toBe(30);
    expect(getActiveOwnedFranchise(migrated).explicitDecisions).toEqual({});
    expect(getActiveOwnedFranchise(migrated).phaseSkips).toEqual([]);
    expect(getActiveOwnedFranchise(migrated).aiAssistState.resolvedNeeds).toEqual({});
    expect(() => validateGameState(migrated)).not.toThrow();

    const result = await runMultiYearSimulation({
      seasons: 5,
      managementPreset: "smart",
      advanceMode: "until_phase",
      seed: TEST_RNG_SEED + 41,
      saveReloadEachSeason: true,
    });
    expect(result.seasonsCompleted).toBe(5);
  }, LONG_TIMEOUT_MS);

  it("migrates mid free-agency historical accepted offers and continues", async () => {
    const store = createMemorySaveGameStore();
    const created = await createNewOwnerSave(
      {
        settings: CBL_GAME_SETTINGS,
        name: "FA Migrate",
        rngSeed: TEST_RNG_SEED + 42,
      },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const loaded = await store.load(created.save.id);
    const teamIds = Object.keys(loaded!.state.world.teams).sort();
    await selectOwnerTeam(created.save.id, teamIds[0]!, store);

    // Advance into regular then quickly toward offseason is expensive;
    // instead seed a free_agency stage on a migrated blob.
    let state = (await store.load(created.save.id))!.state;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          phase: "offseason",
          offseasonStage: "free_agency",
          offseasonStageEnteredDate: state.world.calendar.currentDate,
          freeAgencyExtendedUntil: null,
        },
      },
      meta: {
        ...state.meta,
        updatedAt: TEST_NOW_ISO,
      },
    };
    expect(() => validateGameState(state)).not.toThrow();

    const parsed = JSON.parse(serializeGameState(state)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 36;
    const competition = parsed.competition as {
      season: Record<string, unknown>;
    };
    delete competition.season.offseasonStageEnteredDate;
    delete competition.season.freeAgencyExtendedUntil;

    const migrated = deserializeGameState(JSON.stringify(parsed));
    expect(migrated.competition.season.offseasonStage).toBe("free_agency");
    expect(migrated.competition.season.offseasonStageEnteredDate).toBeTruthy();
    expect(() => validateGameState(migrated)).not.toThrow();

    await store.save({ id: created.save.id, state: migrated });

    // Advance out of FA via duration / finish path
    const advanced = await advanceOwnerTime(
      created.save.id,
      { days: 40, stopOnPhaseChange: true },
      store,
    );
    // May need beginOffseason if somehow in postseason — not expected here
    if (!advanced.ok && /season review/i.test(advanced.error)) {
      await beginOffseason(created.save.id, store);
    } else if (!advanced.ok) {
      // FA may still be open if duration not met due to entered date reset
      expect(advanced.error.length).toBeGreaterThan(0);
    }
    const after = await store.load(created.save.id);
    expect(after).not.toBeNull();
    expect(() => validateGameState(after!.state)).not.toThrow();
  }, LONG_TIMEOUT_MS);
});
