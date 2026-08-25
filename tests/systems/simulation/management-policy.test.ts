import { describe, expect, it } from "vitest";
import {
  applyPreset,
  inferPreset,
  phasesEqual,
  type AiAssistancePhases,
} from "@/domain/ai-management-presets";
import {
  cloneGameSettings,
  DEFAULT_GAME_SETTINGS,
  legacyManagementModeToPreset,
  type GameSettings,
} from "@/domain/game-settings";
import {
  MANAGEMENT_ACTION_IDS,
  MANAGEMENT_ACTIONS,
  type ManagementActionId,
} from "@/systems/simulation/management-actions";
import {
  buildManagementPolicy,
  evaluateAction,
  evaluateManagementAction,
  type PolicyOutcome,
} from "@/systems/simulation/management-policy";

function settingsWithPreset(
  preset: GameSettings["ai"]["managementPreset"],
  custom?: Partial<AiAssistancePhases>,
): GameSettings {
  const settings = cloneGameSettings(DEFAULT_GAME_SETTINGS);
  if (preset === "custom") {
    settings.ai.managementPreset = "custom";
    settings.ai.assistance = {
      ...applyPreset("continuity"),
      ...custom,
    };
    return settings;
  }
  settings.ai.managementPreset = preset;
  settings.ai.assistance = applyPreset(preset);
  if (custom) {
    settings.ai.assistance = { ...settings.ai.assistance, ...custom };
    settings.ai.managementPreset = "custom";
  }
  return settings;
}

function expectOutcome(
  settings: GameSettings,
  actionId: ManagementActionId,
  outcome: PolicyOutcome,
): void {
  const decision = evaluateManagementAction(settings, actionId);
  expect(decision.outcome, `${actionId} → ${outcome}`).toBe(outcome);
}

describe("management action registry audit", () => {
  it("registers every action with required metadata", () => {
    expect(MANAGEMENT_ACTION_IDS.length).toBeGreaterThan(10);
    for (const id of MANAGEMENT_ACTION_IDS) {
      const action = MANAGEMENT_ACTIONS[id];
      expect(action.id).toBe(id);
      expect(action.phase).toBeTruthy();
      expect(action.classification).toBeTruthy();
      expect(action.requiredCapability).toBeTruthy();
      expect(typeof action.mutatesState).toBe("boolean");
      expect(typeof action.cooldownDays).toBe("number");
      expect(typeof action.blocksWhenDenied).toBe("boolean");
      expect(action.logging.defaultReason.length).toBeGreaterThan(0);
      expect(action.logging.defaultTrigger.length).toBeGreaterThan(0);
    }
  });
});

describe("management presets", () => {
  it("defaults new saves to continuity", () => {
    expect(DEFAULT_GAME_SETTINGS.ai.managementPreset).toBe("continuity");
    expect(
      phasesEqual(
        DEFAULT_GAME_SETTINGS.ai.assistance,
        applyPreset("continuity"),
      ),
    ).toBe(true);
  });

  it("inferPreset returns custom when one phase differs", () => {
    const phases = applyPreset("continuity");
    phases.freeAgency = "off";
    expect(inferPreset(phases)).toBe("custom");
  });

  it("maps legacy smart_assist to smart preset", () => {
    expect(legacyManagementModeToPreset("smart_assist")).toBe("smart");
    expect(legacyManagementModeToPreset("off")).toBe("off");
    expect(legacyManagementModeToPreset("full_management")).toBe(
      "full_management",
    );
  });
});

describe("management policy — Off preset", () => {
  const settings = settingsWithPreset("off");

  it("denies all mutating continuity actions", () => {
    expectOutcome(settings, "MAINTAIN_MIN_ROSTER", "DENY_CONTINUE");
    expectOutcome(settings, "SIGN_INJURY_REPLACEMENT", "DENY_CONTINUE");
    expectOutcome(settings, "HIRE_REQUIRED_COACH", "DENY_CONTINUE");
    expectOutcome(settings, "FIX_INVALID_ROTATION", "DENY_CONTINUE");
  });

  it("blocks draft pick when denied", () => {
    expectOutcome(settings, "DRAFT_PICK", "DENY_BLOCK");
  });

  it("denies trades and strategic actions", () => {
    expectOutcome(settings, "EXECUTE_TRADE", "DENY_CONTINUE");
    expectOutcome(settings, "PROPOSE_TRADE", "DENY_CONTINUE");
    expectOutcome(settings, "SIGN_STRATEGIC_FA", "DENY_CONTINUE");
  });
});

describe("management policy — Continuity preset", () => {
  const settings = settingsWithPreset("continuity");

  it("allows continuity roster/staff/rotation actions", () => {
    expectOutcome(settings, "MAINTAIN_MIN_ROSTER", "ALLOW");
    expectOutcome(settings, "SIGN_INJURY_REPLACEMENT", "ALLOW");
    expectOutcome(settings, "SIGN_EMERGENCY_FA", "ALLOW");
    expectOutcome(settings, "FIX_INVALID_ROTATION", "ALLOW");
    expectOutcome(settings, "HIRE_REQUIRED_COACH", "ALLOW");
    expectOutcome(settings, "HIRE_REQUIRED_FRONT_OFFICE", "ALLOW");
    expectOutcome(settings, "RELEASE_FOR_ROSTER_RULES", "ALLOW");
  });

  it("denies routine and strategic FA / trades / draft", () => {
    expectOutcome(settings, "SIGN_ROUTINE_FA", "DENY_CONTINUE");
    expectOutcome(settings, "SIGN_STRATEGIC_FA", "DENY_CONTINUE");
    expectOutcome(settings, "EXECUTE_TRADE", "DENY_CONTINUE");
    expectOutcome(settings, "PROPOSE_TRADE", "DENY_CONTINUE");
    expectOutcome(settings, "DRAFT_PICK", "DENY_BLOCK");
    expectOutcome(settings, "ADJUST_STARTING_LINEUP", "DENY_CONTINUE");
    expectOutcome(settings, "EXTEND_KEY_PLAYER", "DENY_CONTINUE");
  });
});

describe("management policy — Smart preset", () => {
  const settings = settingsWithPreset("smart");

  it("allows routine FA and continuity injuries", () => {
    expectOutcome(settings, "SIGN_INJURY_REPLACEMENT", "ALLOW");
    expectOutcome(settings, "MAINTAIN_MIN_ROSTER", "ALLOW");
    expectOutcome(settings, "SIGN_ROUTINE_FA", "ALLOW");
    expectOutcome(settings, "ADJUST_STARTING_LINEUP", "ALLOW");
    expectOutcome(settings, "HIRE_REQUIRED_COACH", "ALLOW");
  });

  it("does not allow trades or draft picks", () => {
    expectOutcome(settings, "EXECUTE_TRADE", "DENY_CONTINUE");
    expectOutcome(settings, "PROPOSE_TRADE", "DENY_CONTINUE");
    expectOutcome(settings, "DRAFT_PICK", "DENY_BLOCK");
    expectOutcome(settings, "SIGN_STRATEGIC_FA", "DENY_CONTINUE");
  });

  it("allows draft scouting as recommend", () => {
    expectOutcome(settings, "DRAFT_SCOUT", "RECOMMEND");
  });
});

describe("management policy — Full Management", () => {
  const settings = settingsWithPreset("full_management");

  it("allows strategic and draft execution", () => {
    expectOutcome(settings, "EXECUTE_TRADE", "ALLOW");
    expectOutcome(settings, "DRAFT_PICK", "ALLOW");
    expectOutcome(settings, "SIGN_STRATEGIC_FA", "ALLOW");
    expectOutcome(settings, "REBUILD_MOVE", "ALLOW");
    expectOutcome(settings, "CAP_FLEXIBILITY_MOVE", "ALLOW");
  });
});

describe("management policy — negative / bypass boundaries", () => {
  it("cannot sign discretionary FA when only continuity is enabled", () => {
    const settings = settingsWithPreset("custom", {
      freeAgency: "continuity",
    });
    expectOutcome(settings, "SIGN_EMERGENCY_FA", "ALLOW");
    expectOutcome(settings, "SIGN_ROUTINE_FA", "DENY_CONTINUE");
    expectOutcome(settings, "SIGN_STRATEGIC_FA", "DENY_CONTINUE");
  });

  it("cannot trade when trades are off even if action is registered", () => {
    const settings = settingsWithPreset("custom", {
      trades: "off",
      freeAgency: "full",
    });
    expectOutcome(settings, "EXECUTE_TRADE", "DENY_CONTINUE");
    expectOutcome(settings, "PROPOSE_TRADE", "DENY_CONTINUE");
  });

  it("user_only allows propose but not execute", () => {
    const settings = settingsWithPreset("custom", {
      trades: "user_only",
    });
    expectOutcome(settings, "PROPOSE_TRADE", "RECOMMEND");
    expectOutcome(settings, "EXECUTE_TRADE", "RECOMMEND");
  });

  it("cannot draft pick when draft selection is recommend", () => {
    const settings = settingsWithPreset("custom", {
      draftSelection: "recommend",
    });
    const decision = evaluateManagementAction(settings, "DRAFT_PICK");
    expect(decision.outcome).toBe("RECOMMEND");
    expect(decision.action.mutatesState).toBe(true);
  });

  it("cannot draft pick when draft selection is off", () => {
    const settings = settingsWithPreset("custom", {
      draftSelection: "off",
    });
    expectOutcome(settings, "DRAFT_PICK", "DENY_BLOCK");
  });

  it("strategic contracts blocked under continuity contracts mode", () => {
    const settings = settingsWithPreset("custom", {
      contracts: "continuity",
    });
    expectOutcome(settings, "EXTEND_MINIMUM_CONTRACT", "ALLOW");
    expectOutcome(settings, "EXTEND_KEY_PLAYER", "DENY_CONTINUE");
  });
});

describe("buildManagementPolicy", () => {
  it("is cheap and stable for a given settings object", () => {
    const settings = settingsWithPreset("smart");
    const a = buildManagementPolicy(settings);
    const b = buildManagementPolicy(settings);
    expect(a.preset).toBe("smart");
    expect(a.phases.freeAgency).toBe("routine");
    expect(a.capabilitiesByPhase.freeAgency.routine).toBe(true);
    expect(a.capabilitiesByPhase.trades.execute).toBe(false);
    expect(evaluateAction(b, "SIGN_ROUTINE_FA").outcome).toBe("ALLOW");
  });
});
