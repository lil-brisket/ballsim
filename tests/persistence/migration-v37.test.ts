import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createSeededRng } from "@/domain/rng";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("v36 → v38 migration (via v37)", () => {
  it("adds phase presets, offseason FA settings, and aiAssistState", () => {
    let modern = createTestGameState({ saveId: "mig_v37" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 36;
    const settings = parsed.settings as Record<string, unknown>;
    const ai = settings.ai as Record<string, unknown>;
    delete ai.managementPreset;
    delete ai.managementMode;
    delete ai.assistance;
    delete settings.offseason;
    const season = (parsed.competition as Record<string, unknown>)
      .season as Record<string, unknown>;
    delete season.offseasonStageEnteredDate;
    delete season.freeAgencyExtendedUntil;
    const user = parsed.user as Record<string, unknown>;
    delete user.explicitDecisions;
    delete user.phaseSkips;
    delete user.aiAssistState;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(41);
    // v37 defaulted missing mode to smart_assist → v38 maps to smart preset
    // → v39 preserves smart phase modes on assistance
    expect(loaded.settings.ai.managementPreset).toBe("smart");
    expect(loaded.settings.ai.assistance.freeAgency).toBe("routine");
    expect(loaded.settings.offseason.freeAgency.durationDays).toBe(30);
    expect(loaded.settings.offseason.freeAgency.allowExtension).toBe(true);
    expect(loaded.competition.season.offseasonStageEnteredDate).toBeNull();
    expect(loaded.competition.season.freeAgencyExtendedUntil).toBeNull();
    expect(loaded.user.explicitDecisions).toEqual({});
    expect(loaded.user.phaseSkips).toEqual([]);
    expect(loaded.user.aiAssistState.resolvedNeeds).toEqual({});
    expect(() => validateGameState(loaded)).not.toThrow();
  });
});
