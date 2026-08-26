import { describe, expect, it } from "vitest";
import {
  ALL_MANAGEMENT_PHASES,
  clearAllVisiblePhases,
  countDelegatedVisiblePhases,
  DEFAULT_DELEGATED_ASSISTANCE,
  getDelegatedOnMode,
  isPhaseDelegated,
  MANAGEMENT_PHASE_METADATA,
  PLAYER_VISIBLE_DELEGATION_PHASES,
  selectAllVisiblePhases,
  setPhaseDelegated,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";
import {
  applyPreset,
  type AiAssistancePhases,
} from "@/domain/ai-management-presets";
import {
  cloneGameSettings,
  DEFAULT_GAME_SETTINGS,
} from "@/domain/game-settings";
import {
  evaluateManagementAction,
  isUserAssistCompletelyOff,
  canUserManageFranchise,
} from "@/systems/simulation/management-policy";

describe("ai-management-delegation", () => {
  it("defaults new saves to conservative continuity-style delegation", () => {
    expect(DEFAULT_GAME_SETTINGS.ai.managementPreset).toBe("custom");
    expect(DEFAULT_GAME_SETTINGS.ai.assistance).toEqual(
      DEFAULT_DELEGATED_ASSISTANCE,
    );
    expect(isPhaseDelegated(DEFAULT_DELEGATED_ASSISTANCE, "injuriesEmergencyRoster")).toBe(
      true,
    );
    expect(isPhaseDelegated(DEFAULT_DELEGATED_ASSISTANCE, "freeAgency")).toBe(
      false,
    );
    expect(isPhaseDelegated(DEFAULT_DELEGATED_ASSISTANCE, "draftSelection")).toBe(
      false,
    );
  });

  it("isPhaseDelegated is false only for off", () => {
    const phases = applyPreset("continuity");
    expect(isPhaseDelegated(phases, "injuriesEmergencyRoster")).toBe(true);
    expect(isPhaseDelegated(phases, "trades")).toBe(false);
    phases.draftScouting = "recommend";
    expect(isPhaseDelegated(phases, "draftScouting")).toBe(true);
  });

  it("setPhaseDelegated writes delegatedOnMode when enabling", () => {
    let phases: AiAssistancePhases = { ...DEFAULT_DELEGATED_ASSISTANCE };
    phases = setPhaseDelegated(phases, "freeAgency", true);
    expect(phases.freeAgency).toBe(getDelegatedOnMode("freeAgency"));
    expect(phases.freeAgency).toBe("full");

    phases = setPhaseDelegated(phases, "draftScouting", true);
    expect(phases.draftScouting).toBe("recommend");

    phases = setPhaseDelegated(phases, "freeAgency", false);
    expect(phases.freeAgency).toBe("off");
  });

  it("selectAllVisiblePhases only affects visible phases", () => {
    const cleared = clearAllVisiblePhases(DEFAULT_DELEGATED_ASSISTANCE);
    const all = selectAllVisiblePhases(cleared);

    for (const phase of PLAYER_VISIBLE_DELEGATION_PHASES) {
      expect(isPhaseDelegated(all, phase)).toBe(true);
      expect(all[phase]).toBe(getDelegatedOnMode(phase));
    }
    for (const phase of ALL_MANAGEMENT_PHASES) {
      if (!MANAGEMENT_PHASE_METADATA[phase].delegationSupported) {
        expect(all[phase]).toBe("off");
      }
    }
    expect(countDelegatedVisiblePhases(all)).toBe(
      visibleDelegationPhaseCount(),
    );
  });

  it("clearAllVisiblePhases leaves hidden phases unchanged and visible off", () => {
    const withTrades: AiAssistancePhases = {
      ...selectAllVisiblePhases(DEFAULT_DELEGATED_ASSISTANCE),
      trades: "full",
    };
    const cleared = clearAllVisiblePhases(withTrades);
    for (const phase of PLAYER_VISIBLE_DELEGATION_PHASES) {
      expect(cleared[phase]).toBe("off");
    }
    expect(cleared.trades).toBe("full");
  });

  it("unsupported phases are not player-visible", () => {
    for (const phase of [
      "trades",
      "waiversReleases",
      "contracts",
      "strategicRosterDecisions",
      "longTermPlanning",
    ] as const) {
      expect(MANAGEMENT_PHASE_METADATA[phase].delegationSupported).toBe(false);
      expect(PLAYER_VISIBLE_DELEGATION_PHASES.includes(phase)).toBe(false);
    }
  });

  it("delegated phase permits implemented AI actions; non-delegated denies", () => {
    const settings = cloneGameSettings(DEFAULT_GAME_SETTINGS);
    settings.ai.assistance = setPhaseDelegated(
      clearAllVisiblePhases(settings.ai.assistance),
      "injuriesEmergencyRoster",
      true,
    );
    settings.ai.managementPreset = "custom";

    expect(
      evaluateManagementAction(settings, "MAINTAIN_MIN_ROSTER").outcome,
    ).toBe("ALLOW");
    expect(
      evaluateManagementAction(settings, "SIGN_ROUTINE_FA").outcome,
    ).not.toBe("ALLOW");
  });

  it("isUserAssistCompletelyOff uses phase map not preset name", () => {
    const settings = cloneGameSettings(DEFAULT_GAME_SETTINGS);
    settings.ai.managementPreset = "continuity";
    settings.ai.assistance = applyPreset("off");
    expect(isUserAssistCompletelyOff(settings)).toBe(true);

    settings.ai.managementPreset = "off";
    settings.ai.assistance = applyPreset("continuity");
    expect(isUserAssistCompletelyOff(settings)).toBe(false);
  });

  it("canUserManageFranchise is true when any visible phase is retained", () => {
    const settings = cloneGameSettings(DEFAULT_GAME_SETTINGS);
    settings.ai.assistance = DEFAULT_DELEGATED_ASSISTANCE;
    expect(canUserManageFranchise(settings)).toBe(true);

    settings.ai.assistance = selectAllVisiblePhases(settings.ai.assistance);
    expect(canUserManageFranchise(settings)).toBe(false);
  });
});
