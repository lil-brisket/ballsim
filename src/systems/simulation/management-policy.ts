/**
 * Centralized management policy for user-franchise AI assistance.
 * Sole authority for whether AI may perform a specific action.
 * Does not contain basketball need logic.
 */

import {
  resolveAssistancePhases,
  type AiAssistancePhases,
  type AiManagementPreset,
  type ManagementPhase,
} from "@/domain/ai-management-presets";
import {
  areAllPhasesOff,
  playerRetainsAnyVisibleResponsibility,
} from "@/domain/ai-management-delegation";
import type { GameSettings } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import {
  getManagementAction,
  type ManagementActionDefinition,
  type ManagementActionId,
  type RequiredCapability,
} from "@/systems/simulation/management-actions";

export type PolicyOutcome =
  | "ALLOW"
  | "RECOMMEND"
  | "DENY_CONTINUE"
  | "DENY_BLOCK";

export type PhaseCapabilities = {
  continuity: boolean;
  routine: boolean;
  full: boolean;
  recommend: boolean;
  /** Trades: propose without execute. */
  propose: boolean;
  /** Trades / full: execute mutating strategic action. */
  execute: boolean;
  /** Alias for user_only propose path. */
  user_only: boolean;
};

export type PolicyDecision = {
  outcome: PolicyOutcome;
  action: ManagementActionDefinition;
  phase: ManagementPhase;
  phaseMode: string;
  preset: AiManagementPreset;
  capabilities: PhaseCapabilities;
  reason: string;
};

export type ResolvedManagementPolicy = {
  preset: AiManagementPreset;
  phases: AiAssistancePhases;
  capabilitiesByPhase: Record<ManagementPhase, PhaseCapabilities>;
};

const EMPTY_CAPABILITIES: PhaseCapabilities = {
  continuity: false,
  routine: false,
  full: false,
  recommend: false,
  propose: false,
  execute: false,
  user_only: false,
};

/**
 * Build capability maps for each phase from resolved phase modes.
 * Cheap O(phases) construction — call once per simulation day.
 * When franchiseAssistance is provided, uses that franchise's config
 * instead of career settings.ai (multi-team Owner Mode).
 */
export function buildManagementPolicy(
  settings: GameSettings,
  franchiseAssistance?: {
    managementPreset: AiManagementPreset;
    aiAssistance: AiAssistancePhases;
  },
): ResolvedManagementPolicy {
  const preset =
    franchiseAssistance?.managementPreset ?? settings.ai.managementPreset;
  const phases = resolveAssistancePhases(
    preset,
    franchiseAssistance?.aiAssistance ?? settings.ai.assistance,
  );
  const capabilitiesByPhase = {
    injuriesEmergencyRoster: operationalCapabilities(
      phases.injuriesEmergencyRoster,
    ),
    rotationsDepthChart: operationalCapabilities(phases.rotationsDepthChart),
    freeAgency: operationalCapabilities(phases.freeAgency),
    trades: tradesCapabilities(phases.trades),
    waiversReleases: waiversCapabilities(phases.waiversReleases),
    contracts: operationalCapabilities(phases.contracts),
    draftScouting: draftCapabilities(phases.draftScouting),
    draftSelection: draftCapabilities(phases.draftSelection),
    coachingStaff: operationalCapabilities(phases.coachingStaff),
    frontOfficeStaff: operationalCapabilities(phases.frontOfficeStaff),
    strategicRosterDecisions: binaryCapabilities(
      phases.strategicRosterDecisions,
    ),
    longTermPlanning: binaryCapabilities(phases.longTermPlanning),
  } as const satisfies Record<ManagementPhase, PhaseCapabilities>;

  return { preset, phases, capabilitiesByPhase };
}

function operationalCapabilities(
  mode: AiAssistancePhases["injuriesEmergencyRoster"],
): PhaseCapabilities {
  switch (mode) {
    case "off":
      return { ...EMPTY_CAPABILITIES };
    case "continuity":
      return {
        ...EMPTY_CAPABILITIES,
        continuity: true,
        execute: true,
      };
    case "routine":
      return {
        ...EMPTY_CAPABILITIES,
        continuity: true,
        routine: true,
        execute: true,
      };
    case "full":
      return {
        ...EMPTY_CAPABILITIES,
        continuity: true,
        routine: true,
        full: true,
        execute: true,
      };
  }
}

function waiversCapabilities(
  mode: AiAssistancePhases["waiversReleases"],
): PhaseCapabilities {
  switch (mode) {
    case "off":
      return { ...EMPTY_CAPABILITIES };
    case "continuity":
      return {
        ...EMPTY_CAPABILITIES,
        continuity: true,
        execute: true,
      };
    case "full":
      return {
        ...EMPTY_CAPABILITIES,
        continuity: true,
        routine: true,
        full: true,
        execute: true,
      };
  }
}

function tradesCapabilities(
  mode: AiAssistancePhases["trades"],
): PhaseCapabilities {
  switch (mode) {
    case "off":
      return { ...EMPTY_CAPABILITIES };
    case "user_only":
      return {
        ...EMPTY_CAPABILITIES,
        propose: true,
        user_only: true,
        recommend: true,
      };
    case "full":
      return {
        ...EMPTY_CAPABILITIES,
        propose: true,
        user_only: true,
        recommend: true,
        full: true,
        execute: true,
        continuity: true,
        routine: true,
      };
  }
}

function draftCapabilities(
  mode: AiAssistancePhases["draftSelection"],
): PhaseCapabilities {
  switch (mode) {
    case "off":
      return { ...EMPTY_CAPABILITIES };
    case "recommend":
      return {
        ...EMPTY_CAPABILITIES,
        recommend: true,
      };
    case "full":
      return {
        ...EMPTY_CAPABILITIES,
        recommend: true,
        full: true,
        execute: true,
        continuity: true,
        routine: true,
      };
  }
}

function binaryCapabilities(
  mode: AiAssistancePhases["strategicRosterDecisions"],
): PhaseCapabilities {
  if (mode === "off") {
    return { ...EMPTY_CAPABILITIES };
  }
  return {
    ...EMPTY_CAPABILITIES,
    full: true,
    execute: true,
    continuity: true,
    routine: true,
  };
}

function grantsCapability(
  capabilities: PhaseCapabilities,
  required: RequiredCapability,
): boolean {
  switch (required) {
    case "continuity":
      return capabilities.continuity;
    case "routine":
      return capabilities.routine;
    case "full":
      return capabilities.full;
    case "recommend":
      return capabilities.recommend;
    case "user_only":
      return capabilities.user_only;
    case "propose":
      return capabilities.propose;
    case "execute":
      return capabilities.execute;
  }
}

/**
 * Evaluate whether AI may perform an action under the resolved policy.
 * Does not check team ownership — callers must ensure user franchise.
 */
export function evaluateAction(
  policy: ResolvedManagementPolicy,
  actionId: ManagementActionId,
): PolicyDecision {
  const action = getManagementAction(actionId);
  const phaseMode = policy.phases[action.phase];
  const capabilities = policy.capabilitiesByPhase[action.phase];
  const granted = grantsCapability(capabilities, action.requiredCapability);

  if (granted) {
    if (!action.mutatesState && action.requiredCapability === "recommend") {
      return {
        outcome: "RECOMMEND",
        action,
        phase: action.phase,
        phaseMode,
        preset: policy.preset,
        capabilities,
        reason: `Phase ${action.phase}=${phaseMode} grants recommend for ${actionId}`,
      };
    }
    if (
      !action.mutatesState &&
      (action.requiredCapability === "user_only" ||
        action.requiredCapability === "propose")
    ) {
      return {
        outcome: "RECOMMEND",
        action,
        phase: action.phase,
        phaseMode,
        preset: policy.preset,
        capabilities,
        reason: `Phase ${action.phase}=${phaseMode} grants proposal for ${actionId}`,
      };
    }
    return {
      outcome: "ALLOW",
      action,
      phase: action.phase,
      phaseMode,
      preset: policy.preset,
      capabilities,
      reason: `Phase ${action.phase}=${phaseMode} grants ${action.requiredCapability} for ${actionId}`,
    };
  }

  // Recommend path: phase is recommend/user_only but action requires full execute
  if (
    action.mutatesState &&
    (capabilities.recommend || capabilities.user_only) &&
    !capabilities.execute
  ) {
    return {
      outcome: "RECOMMEND",
      action,
      phase: action.phase,
      phaseMode,
      preset: policy.preset,
      capabilities,
      reason: `Phase ${action.phase}=${phaseMode} allows recommendation but not execution of ${actionId}`,
    };
  }

  const denyOutcome: PolicyOutcome = action.blocksWhenDenied
    ? "DENY_BLOCK"
    : "DENY_CONTINUE";

  return {
    outcome: denyOutcome,
    action,
    phase: action.phase,
    phaseMode,
    preset: policy.preset,
    capabilities,
    reason: `Phase ${action.phase}=${phaseMode} does not grant ${action.requiredCapability} for ${actionId}`,
  };
}

/**
 * Convenience: build policy from settings and evaluate one action.
 */
export function evaluateManagementAction(
  settings: GameSettings,
  actionId: ManagementActionId,
  franchiseAssistance?: {
    managementPreset: AiManagementPreset;
    aiAssistance: AiAssistancePhases;
  },
): PolicyDecision {
  return evaluateAction(
    buildManagementPolicy(settings, franchiseAssistance),
    actionId,
  );
}

/**
 * True when the action may mutate state (ALLOW).
 */
export function canAiExecute(
  settings: GameSettings,
  actionId: ManagementActionId,
  franchiseAssistance?: {
    managementPreset: AiManagementPreset;
    aiAssistance: AiAssistancePhases;
  },
): boolean {
  return (
    evaluateManagementAction(settings, actionId, franchiseAssistance)
      .outcome === "ALLOW"
  );
}

/**
 * User-franchise gate: AI management policy only applies to the controlled team.
 * CPU teams never consult this policy.
 */
export function isUserFranchiseAssistTarget(
  controlledTeamId: TeamId,
  teamId: TeamId,
): boolean {
  return controlledTeamId === teamId;
}

/**
 * Assist completely off: every management phase is "off".
 */
export function isUserAssistCompletelyOff(
  settings: GameSettings,
  franchiseAssistance?: {
    managementPreset: AiManagementPreset;
    aiAssistance: AiAssistancePhases;
  },
): boolean {
  const phases = resolveAssistancePhases(
    franchiseAssistance?.managementPreset ?? settings.ai.managementPreset,
    franchiseAssistance?.aiAssistance ?? settings.ai.assistance,
  );
  return areAllPhasesOff(phases);
}

/**
 * Whether any phase grants at least continuity/recommend (for UI banners).
 */
export function isAnyAiAssistEnabled(
  settings: GameSettings,
  franchiseAssistance?: {
    managementPreset: AiManagementPreset;
    aiAssistance: AiAssistancePhases;
  },
): boolean {
  if (isUserAssistCompletelyOff(settings, franchiseAssistance)) {
    return false;
  }
  const policy = buildManagementPolicy(settings, franchiseAssistance);
  return Object.values(policy.capabilitiesByPhase).some(
    (caps) =>
      caps.continuity ||
      caps.routine ||
      caps.full ||
      caps.recommend ||
      caps.propose,
  );
}

/**
 * Whether the user still owns at least one visible management responsibility.
 */
export function canUserManageFranchise(
  settings: GameSettings,
  franchiseAssistance?: {
    managementPreset: AiManagementPreset;
    aiAssistance: AiAssistancePhases;
  },
): boolean {
  const phases = resolveAssistancePhases(
    franchiseAssistance?.managementPreset ?? settings.ai.managementPreset,
    franchiseAssistance?.aiAssistance ?? settings.ai.assistance,
  );
  return playerRetainsAnyVisibleResponsibility(phases);
}

/**
 * True when every player-visible responsibility is delegated (AI owns franchise ops).
 */
export function isFullDelegation(
  settings: GameSettings,
  franchiseAssistance?: {
    managementPreset: AiManagementPreset;
    aiAssistance: AiAssistancePhases;
  },
): boolean {
  return (
    !canUserManageFranchise(settings, franchiseAssistance) &&
    !isUserAssistCompletelyOff(settings, franchiseAssistance)
  );
}
