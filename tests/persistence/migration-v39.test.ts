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
import { applyPreset } from "@/domain/ai-management-presets";
import {
  evaluateManagementAction,
  isUserAssistCompletelyOff,
} from "@/systems/simulation/management-policy";
import { cloneGameSettings } from "@/domain/game-settings";

describe("v38 → v39 migration", () => {
  it("preserves continuity phase modes exactly without upgrading to full", () => {
    let modern = createTestGameState({ saveId: "mig_v39_cont" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern.settings.ai.managementPreset = "continuity";
    modern.settings.ai.assistance = applyPreset("continuity");

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 38;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(39);
    expect(loaded.settings.ai.assistance).toEqual(applyPreset("continuity"));
    expect(loaded.settings.ai.assistance.freeAgency).toBe("continuity");
    expect(loaded.settings.ai.assistance.freeAgency).not.toBe("full");
    expect(loaded.settings.ai.assistance.trades).toBe("off");
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("preserves smart draftScouting as recommend (not full)", () => {
    let modern = createTestGameState({ saveId: "mig_v39_smart" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern.settings.ai.managementPreset = "smart";
    modern.settings.ai.assistance = applyPreset("smart");

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 38;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.settings.ai.assistance.draftScouting).toBe("recommend");
    expect(loaded.settings.ai.assistance.draftScouting).not.toBe("full");
    expect(loaded.settings.ai.assistance.freeAgency).toBe("routine");
    expect(loaded.settings.ai.assistance.draftSelection).toBe("off");
  });

  it("preserves off preset as all phases off", () => {
    let modern = createTestGameState({ saveId: "mig_v39_off" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern.settings.ai.managementPreset = "off";
    modern.settings.ai.assistance = applyPreset("off");

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 38;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(isUserAssistCompletelyOff(loaded.settings)).toBe(true);
    expect(loaded.settings.ai.assistance).toEqual(applyPreset("off"));
  });

  it("preserves custom mode mix without upgrading modes", () => {
    let modern = createTestGameState({ saveId: "mig_v39_custom" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    const customAssistance = {
      ...applyPreset("continuity"),
      freeAgency: "routine" as const,
      draftScouting: "recommend" as const,
      contracts: "off" as const,
    };
    modern.settings.ai.managementPreset = "custom";
    modern.settings.ai.assistance = customAssistance;

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 38;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.settings.ai.assistance.freeAgency).toBe("routine");
    expect(loaded.settings.ai.assistance.draftScouting).toBe("recommend");
    expect(loaded.settings.ai.assistance.contracts).toBe("off");
  });

  it("behavioral: migrated smart save keeps recommend-level draft scouting policy", () => {
    let modern = createTestGameState({ saveId: "mig_v39_behavior" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern.settings.ai.managementPreset = "smart";
    modern.settings.ai.assistance = applyPreset("smart");

    const beforeSettings = cloneGameSettings(modern.settings);
    const beforeDraftScout = evaluateManagementAction(
      beforeSettings,
      "DRAFT_SCOUT",
    ).outcome;

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 38;
    const loaded = deserializeGameState(JSON.stringify(parsed));

    const afterDraftScout = evaluateManagementAction(
      loaded.settings,
      "DRAFT_SCOUT",
    ).outcome;
    expect(afterDraftScout).toBe(beforeDraftScout);
    expect(afterDraftScout).toBe("RECOMMEND");

    // Free agency routine capability should still allow SIGN_ROUTINE_FA
    expect(
      evaluateManagementAction(loaded.settings, "SIGN_ROUTINE_FA").outcome,
    ).toBe("ALLOW");
    // Trades remain off
    expect(
      evaluateManagementAction(loaded.settings, "EXECUTE_TRADE").outcome,
    ).not.toBe("ALLOW");
  });
});
