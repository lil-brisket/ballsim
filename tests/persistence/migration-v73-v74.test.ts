import { describe, expect, it } from "vitest";
import { DEFAULT_PAYROLL_RULE_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function modernState() {
  const base = createTestGameState({ saveId: "mig_v74" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function legacyV73Json(luxuryTaxEnabled: boolean): string {
  const parsed = JSON.parse(serializeGameState(modernState())) as {
    meta: { schemaVersion: number };
    settings: { financialRules: Record<string, unknown> };
    business: Record<string, unknown>;
  };
  parsed.meta.schemaVersion = 73;
  for (const key of Object.keys(DEFAULT_PAYROLL_RULE_SETTINGS)) {
    delete parsed.settings.financialRules[key];
  }
  parsed.settings.financialRules.luxuryTaxEnabled = luxuryTaxEnabled;
  delete parsed.business.payrollAssessments;
  return JSON.stringify(parsed);
}

describe("v73 → v74 migration (payroll rules)", () => {
  it("adds the payroll-rule defaults and keeps the stored tax switch", () => {
    for (const enabled of [true, false]) {
      const loaded = deserializeGameState(legacyV73Json(enabled));
      expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
      expect(loaded.settings.financialRules).toMatchObject({
        ...DEFAULT_PAYROLL_RULE_SETTINGS,
        luxuryTaxEnabled: enabled,
      });
      expect(loaded.business.payrollAssessments).toEqual({});
      expect(() => validateGameState(loaded)).not.toThrow();
    }
  });

  it("round-trips migrated saves byte-for-byte", () => {
    const serialized = serializeGameState(
      deserializeGameState(legacyV73Json(true)),
    );
    expect(serializeGameState(deserializeGameState(serialized))).toBe(
      serialized,
    );
  });
});
