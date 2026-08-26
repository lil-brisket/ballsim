/**
 * Phase-based team management assistance presets and phase mode tables.
 * Policy evaluates actions against phase capabilities — not a global ordinal.
 */

export type AiManagementPreset =
  | "off"
  | "continuity"
  | "smart"
  | "full_management"
  | "custom";

export type OperationalPhaseMode =
  | "off"
  | "continuity"
  | "routine"
  | "full";

export type TradesPhaseMode = "off" | "user_only" | "full";

export type DraftPhaseMode = "off" | "recommend" | "full";

export type BinaryPhaseMode = "off" | "full";

export type WaiversPhaseMode = "off" | "continuity" | "full";

export type ManagementPhase =
  | "injuriesEmergencyRoster"
  | "rotationsDepthChart"
  | "freeAgency"
  | "trades"
  | "waiversReleases"
  | "contracts"
  | "draftScouting"
  | "draftSelection"
  | "coachingStaff"
  | "frontOfficeStaff"
  | "strategicRosterDecisions"
  | "longTermPlanning";

export type AiAssistancePhases = {
  injuriesEmergencyRoster: OperationalPhaseMode;
  rotationsDepthChart: OperationalPhaseMode;
  freeAgency: OperationalPhaseMode;
  trades: TradesPhaseMode;
  waiversReleases: WaiversPhaseMode;
  contracts: OperationalPhaseMode;
  draftScouting: DraftPhaseMode;
  draftSelection: DraftPhaseMode;
  coachingStaff: OperationalPhaseMode;
  frontOfficeStaff: OperationalPhaseMode;
  strategicRosterDecisions: BinaryPhaseMode;
  longTermPlanning: BinaryPhaseMode;
};

export const MANAGEMENT_PHASE_KEYS = [
  "injuriesEmergencyRoster",
  "rotationsDepthChart",
  "freeAgency",
  "trades",
  "waiversReleases",
  "contracts",
  "draftScouting",
  "draftSelection",
  "coachingStaff",
  "frontOfficeStaff",
  "strategicRosterDecisions",
  "longTermPlanning",
] as const satisfies ReadonlyArray<ManagementPhase>;

export const AI_MANAGEMENT_PRESETS = [
  "off",
  "continuity",
  "smart",
  "full_management",
  "custom",
] as const satisfies ReadonlyArray<AiManagementPreset>;

const ALL_OFF: AiAssistancePhases = {
  injuriesEmergencyRoster: "off",
  rotationsDepthChart: "off",
  freeAgency: "off",
  trades: "off",
  waiversReleases: "off",
  contracts: "off",
  draftScouting: "off",
  draftSelection: "off",
  coachingStaff: "off",
  frontOfficeStaff: "off",
  strategicRosterDecisions: "off",
  longTermPlanning: "off",
};

const CONTINUITY_PHASES: AiAssistancePhases = {
  injuriesEmergencyRoster: "continuity",
  rotationsDepthChart: "continuity",
  freeAgency: "continuity",
  trades: "off",
  waiversReleases: "continuity",
  contracts: "off",
  draftScouting: "off",
  draftSelection: "off",
  coachingStaff: "continuity",
  frontOfficeStaff: "continuity",
  strategicRosterDecisions: "off",
  longTermPlanning: "off",
};

/** Smart: waivers stay continuity (phase has no routine mode). */
const SMART_PHASES: AiAssistancePhases = {
  injuriesEmergencyRoster: "continuity",
  rotationsDepthChart: "routine",
  freeAgency: "routine",
  trades: "off",
  waiversReleases: "continuity",
  contracts: "routine",
  draftScouting: "recommend",
  draftSelection: "off",
  coachingStaff: "routine",
  frontOfficeStaff: "routine",
  strategicRosterDecisions: "off",
  longTermPlanning: "off",
};

const FULL_PHASES: AiAssistancePhases = {
  injuriesEmergencyRoster: "full",
  rotationsDepthChart: "full",
  freeAgency: "full",
  trades: "full",
  waiversReleases: "full",
  contracts: "full",
  draftScouting: "full",
  draftSelection: "full",
  coachingStaff: "full",
  frontOfficeStaff: "full",
  strategicRosterDecisions: "full",
  longTermPlanning: "full",
};

export const PRESET_PHASE_TABLES: Record<
  Exclude<AiManagementPreset, "custom">,
  AiAssistancePhases
> = {
  off: ALL_OFF,
  continuity: CONTINUITY_PHASES,
  smart: SMART_PHASES,
  full_management: FULL_PHASES,
};

/**
 * Legacy preset field. New saves use `"custom"` with canonical `assistance`.
 * Named presets remain for migration of older saves only.
 */
export const DEFAULT_AI_MANAGEMENT_PRESET: AiManagementPreset = "custom";

/**
 * @deprecated Prefer DEFAULT_DELEGATED_ASSISTANCE from ai-management-delegation.
 * Kept as the continuity table for legacy preset resolution during migration.
 */
export const DEFAULT_AI_ASSISTANCE_PHASES: AiAssistancePhases = {
  ...CONTINUITY_PHASES,
};

export function applyPreset(
  preset: Exclude<AiManagementPreset, "custom">,
): AiAssistancePhases {
  return { ...PRESET_PHASE_TABLES[preset] };
}

export function phasesEqual(
  a: AiAssistancePhases,
  b: AiAssistancePhases,
): boolean {
  for (const key of MANAGEMENT_PHASE_KEYS) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Infer which preset matches the given phase map, or `custom` if none match.
 */
export function inferPreset(phases: AiAssistancePhases): AiManagementPreset {
  for (const preset of [
    "off",
    "continuity",
    "smart",
    "full_management",
  ] as const) {
    if (phasesEqual(phases, PRESET_PHASE_TABLES[preset])) {
      return preset;
    }
  }
  return "custom";
}

/**
 * Resolve effective phase modes.
 *
 * Assistance is the canonical source of truth. Named presets are only applied
 * when `assistanceCanonical` is false (legacy load / migration of pre-v39 saves).
 */
export function resolveAssistancePhases(
  preset: AiManagementPreset,
  customPhases: AiAssistancePhases,
  options?: { assistanceCanonical?: boolean },
): AiAssistancePhases {
  const assistanceCanonical = options?.assistanceCanonical !== false;
  if (assistanceCanonical || preset === "custom") {
    return { ...customPhases };
  }
  return applyPreset(preset);
}

/**
 * Resolve phases for a pre-v39 save where named presets overwrite assistance.
 * Used only by migration.
 */
export function resolveAssistancePhasesLegacy(
  preset: AiManagementPreset,
  customPhases: AiAssistancePhases,
): AiAssistancePhases {
  return resolveAssistancePhases(preset, customPhases, {
    assistanceCanonical: false,
  });
}

export function isAiManagementPreset(
  value: unknown,
): value is AiManagementPreset {
  return (
    value === "off" ||
    value === "continuity" ||
    value === "smart" ||
    value === "full_management" ||
    value === "custom"
  );
}

export function isOperationalPhaseMode(
  value: unknown,
): value is OperationalPhaseMode {
  return (
    value === "off" ||
    value === "continuity" ||
    value === "routine" ||
    value === "full"
  );
}

export function isTradesPhaseMode(value: unknown): value is TradesPhaseMode {
  return value === "off" || value === "user_only" || value === "full";
}

export function isDraftPhaseMode(value: unknown): value is DraftPhaseMode {
  return value === "off" || value === "recommend" || value === "full";
}

export function isBinaryPhaseMode(value: unknown): value is BinaryPhaseMode {
  return value === "off" || value === "full";
}

export function isWaiversPhaseMode(value: unknown): value is WaiversPhaseMode {
  return value === "off" || value === "continuity" || value === "full";
}

export function isValidPhaseMode(
  phase: ManagementPhase,
  value: unknown,
): boolean {
  switch (phase) {
    case "trades":
      return isTradesPhaseMode(value);
    case "draftScouting":
    case "draftSelection":
      return isDraftPhaseMode(value);
    case "strategicRosterDecisions":
    case "longTermPlanning":
      return isBinaryPhaseMode(value);
    case "waiversReleases":
      return isWaiversPhaseMode(value);
    default:
      return isOperationalPhaseMode(value);
  }
}

/** Human-readable labels for UI. */
export const MANAGEMENT_PHASE_LABELS: Record<ManagementPhase, string> = {
  injuriesEmergencyRoster: "Injuries & Emergency Roster",
  rotationsDepthChart: "Rotations & Depth Chart",
  freeAgency: "Free Agency",
  trades: "Trades",
  waiversReleases: "Waivers & Releases",
  contracts: "Contracts",
  draftScouting: "Draft Scouting",
  draftSelection: "Draft Selection",
  coachingStaff: "Coaching Staff",
  frontOfficeStaff: "Front Office Staff",
  strategicRosterDecisions: "Strategic Roster Decisions",
  longTermPlanning: "Long-Term Planning",
};

export const AI_MANAGEMENT_PRESET_LABELS: Record<AiManagementPreset, string> = {
  off: "Off — you handle everything",
  continuity: "Continuity — AI prevents roster/management problems",
  smart: "Smart — AI handles routine management",
  full_management: "Full Management — AI runs the franchise",
  custom: "Custom — configure individual phases",
};
