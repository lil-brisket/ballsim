/**
 * Player-facing AI team-management delegation model.
 *
 * UI uses boolean ownership (delegated / not). Internal phase modes remain
 * policy implementation details and are preserved on migration.
 */

import {
  MANAGEMENT_PHASE_KEYS,
  MANAGEMENT_PHASE_LABELS,
  type AiAssistancePhases,
  type BinaryPhaseMode,
  type DraftPhaseMode,
  type ManagementPhase,
  type OperationalPhaseMode,
  type TradesPhaseMode,
  type WaiversPhaseMode,
} from "@/domain/ai-management-presets";

export type DelegationCategoryId =
  | "roster"
  | "freeAgency"
  | "draft"
  | "coaching"
  | "trades"
  | "contracts"
  | "strategy";

export type ManagementPhaseAvailability = "supported" | "partial" | "future";

export type ManagementPhaseMetadata = {
  phase: ManagementPhase;
  categoryId: DelegationCategoryId;
  label: string;
  description: string;
  playerVisible: boolean;
  delegationSupported: boolean;
  availability: ManagementPhaseAvailability;
  /** Mode written when the player toggles this responsibility ON. */
  delegatedOnMode: AiAssistancePhases[ManagementPhase];
};

export type DelegationCategory = {
  id: DelegationCategoryId;
  title: string;
  icon: string;
  description: string;
};

export const ALL_MANAGEMENT_PHASES = MANAGEMENT_PHASE_KEYS;

export const MANAGEMENT_PHASE_METADATA: Record<
  ManagementPhase,
  ManagementPhaseMetadata
> = {
  injuriesEmergencyRoster: {
    phase: "injuriesEmergencyRoster",
    categoryId: "roster",
    label: MANAGEMENT_PHASE_LABELS.injuriesEmergencyRoster,
    description:
      "Sign players to keep the roster functional when players are injured or unavailable.",
    playerVisible: true,
    delegationSupported: true,
    availability: "supported",
    delegatedOnMode: "full" satisfies OperationalPhaseMode,
  },
  rotationsDepthChart: {
    phase: "rotationsDepthChart",
    categoryId: "roster",
    label: MANAGEMENT_PHASE_LABELS.rotationsDepthChart,
    description:
      "Maintain playable rotations and flag invalid depth-chart assignments during simulation.",
    playerVisible: true,
    delegationSupported: true,
    availability: "partial",
    delegatedOnMode: "full" satisfies OperationalPhaseMode,
  },
  freeAgency: {
    phase: "freeAgency",
    categoryId: "freeAgency",
    label: MANAGEMENT_PHASE_LABELS.freeAgency,
    description:
      "Sign free agents to fill roster needs that arise during simulation.",
    playerVisible: true,
    delegationSupported: true,
    availability: "supported",
    delegatedOnMode: "full" satisfies OperationalPhaseMode,
  },
  waiversReleases: {
    phase: "waiversReleases",
    categoryId: "roster",
    label: MANAGEMENT_PHASE_LABELS.waiversReleases,
    description: "Handle players who need to be waived or released.",
    playerVisible: false,
    delegationSupported: false,
    availability: "future",
    delegatedOnMode: "full" satisfies WaiversPhaseMode,
  },
  contracts: {
    phase: "contracts",
    categoryId: "contracts",
    label: MANAGEMENT_PHASE_LABELS.contracts,
    description: "Manage contract decisions, extensions, and negotiations.",
    playerVisible: false,
    delegationSupported: false,
    availability: "future",
    delegatedOnMode: "full" satisfies OperationalPhaseMode,
  },
  trades: {
    phase: "trades",
    categoryId: "trades",
    label: MANAGEMENT_PHASE_LABELS.trades,
    description: "Evaluate and execute trades according to team needs.",
    playerVisible: false,
    delegationSupported: false,
    availability: "future",
    delegatedOnMode: "full" satisfies TradesPhaseMode,
  },
  draftScouting: {
    phase: "draftScouting",
    categoryId: "draft",
    label: MANAGEMENT_PHASE_LABELS.draftScouting,
    description:
      "Evaluate prospects and prepare draft recommendations for your team.",
    playerVisible: true,
    delegationSupported: true,
    availability: "partial",
    delegatedOnMode: "recommend" satisfies DraftPhaseMode,
  },
  draftSelection: {
    phase: "draftSelection",
    categoryId: "draft",
    label: MANAGEMENT_PHASE_LABELS.draftSelection,
    description: "Make draft selections on behalf of the team when on the clock.",
    playerVisible: true,
    delegationSupported: true,
    availability: "supported",
    delegatedOnMode: "full" satisfies DraftPhaseMode,
  },
  coachingStaff: {
    phase: "coachingStaff",
    categoryId: "coaching",
    label: MANAGEMENT_PHASE_LABELS.coachingStaff,
    description: "Hire required coaches when coaching staff vacancies arise.",
    playerVisible: true,
    delegationSupported: true,
    availability: "supported",
    delegatedOnMode: "full" satisfies OperationalPhaseMode,
  },
  frontOfficeStaff: {
    phase: "frontOfficeStaff",
    categoryId: "coaching",
    label: MANAGEMENT_PHASE_LABELS.frontOfficeStaff,
    description:
      "Hire required front-office staff when vacancies arise.",
    playerVisible: true,
    delegationSupported: true,
    availability: "supported",
    delegatedOnMode: "full" satisfies OperationalPhaseMode,
  },
  strategicRosterDecisions: {
    phase: "strategicRosterDecisions",
    categoryId: "strategy",
    label: "Roster Strategy",
    description: "Make strategic roster-building moves over the long term.",
    playerVisible: false,
    delegationSupported: false,
    availability: "future",
    delegatedOnMode: "full" satisfies BinaryPhaseMode,
  },
  longTermPlanning: {
    phase: "longTermPlanning",
    categoryId: "strategy",
    label: MANAGEMENT_PHASE_LABELS.longTermPlanning,
    description: "Manage long-term planning and cap flexibility.",
    playerVisible: false,
    delegationSupported: false,
    availability: "future",
    delegatedOnMode: "full" satisfies BinaryPhaseMode,
  },
};

/** Categories shown in the player UI (only those with at least one visible phase). */
export const DELEGATION_CATEGORIES: readonly DelegationCategory[] = [
  {
    id: "roster",
    title: "Roster Management",
    icon: "🏀",
    description: "Keep your roster functional throughout the season.",
  },
  {
    id: "freeAgency",
    title: "Free Agency",
    icon: "💰",
    description: "Handle roster-building through free-agent signings.",
  },
  {
    id: "draft",
    title: "Draft",
    icon: "🎯",
    description: "Delegate draft preparation and selection.",
  },
  {
    id: "coaching",
    title: "Coaching & Staff",
    icon: "🧠",
    description: "Manage coaching and front-office staffing.",
  },
] as const;

export const PLAYER_VISIBLE_DELEGATION_PHASES: readonly ManagementPhase[] =
  ALL_MANAGEMENT_PHASES.filter(
    (phase) => MANAGEMENT_PHASE_METADATA[phase].delegationSupported,
  );

/**
 * Essential continuity defaults for new games.
 * FA and draft stay off — those are consequential ownership decisions.
 */
export const DEFAULT_DELEGATED_ASSISTANCE: AiAssistancePhases = {
  injuriesEmergencyRoster: "continuity",
  rotationsDepthChart: "continuity",
  freeAgency: "off",
  trades: "off",
  waiversReleases: "off",
  contracts: "off",
  draftScouting: "off",
  draftSelection: "off",
  coachingStaff: "continuity",
  frontOfficeStaff: "continuity",
  strategicRosterDecisions: "off",
  longTermPlanning: "off",
};

/**
 * Whether the AI is permitted to take ownership of this responsibility.
 * Distinct from what capabilities policy grants within the phase.
 */
export function isPhaseDelegated(
  phases: AiAssistancePhases,
  phase: ManagementPhase,
): boolean {
  return phases[phase] !== "off";
}

export function getDelegatedOnMode(
  phase: ManagementPhase,
): AiAssistancePhases[ManagementPhase] {
  return MANAGEMENT_PHASE_METADATA[phase].delegatedOnMode;
}

/**
 * Toggle a single phase. When enabling, writes the phase's canonical on-mode.
 * When disabling, writes "off". Preserves other phases unchanged.
 */
export function setPhaseDelegated(
  phases: AiAssistancePhases,
  phase: ManagementPhase,
  delegated: boolean,
): AiAssistancePhases {
  return {
    ...phases,
    [phase]: delegated ? getDelegatedOnMode(phase) : "off",
  };
}

/** Count of player-visible phases currently delegated. */
export function countDelegatedVisiblePhases(
  phases: AiAssistancePhases,
): number {
  return PLAYER_VISIBLE_DELEGATION_PHASES.filter((phase) =>
    isPhaseDelegated(phases, phase),
  ).length;
}

export function visibleDelegationPhaseCount(): number {
  return PLAYER_VISIBLE_DELEGATION_PHASES.length;
}

export function selectAllVisiblePhases(
  phases: AiAssistancePhases,
): AiAssistancePhases {
  let next = { ...phases };
  for (const phase of PLAYER_VISIBLE_DELEGATION_PHASES) {
    next = setPhaseDelegated(next, phase, true);
  }
  return next;
}

export function clearAllVisiblePhases(
  phases: AiAssistancePhases,
): AiAssistancePhases {
  let next = { ...phases };
  for (const phase of PLAYER_VISIBLE_DELEGATION_PHASES) {
    next = setPhaseDelegated(next, phase, false);
  }
  return next;
}

export function selectAllCategoryPhases(
  phases: AiAssistancePhases,
  categoryId: DelegationCategoryId,
): AiAssistancePhases {
  let next = { ...phases };
  for (const phase of visiblePhasesForCategory(categoryId)) {
    next = setPhaseDelegated(next, phase, true);
  }
  return next;
}

export function visiblePhasesForCategory(
  categoryId: DelegationCategoryId,
): ManagementPhase[] {
  return PLAYER_VISIBLE_DELEGATION_PHASES.filter(
    (phase) => MANAGEMENT_PHASE_METADATA[phase].categoryId === categoryId,
  );
}

export type CategoryDelegationState =
  | "all"
  | "partial"
  | "none";

export function categoryDelegationState(
  phases: AiAssistancePhases,
  categoryId: DelegationCategoryId,
): { delegated: number; total: number; state: CategoryDelegationState } {
  const categoryPhases = visiblePhasesForCategory(categoryId);
  const delegated = categoryPhases.filter((phase) =>
    isPhaseDelegated(phases, phase),
  ).length;
  const total = categoryPhases.length;
  const state: CategoryDelegationState =
    delegated === 0 ? "none" : delegated === total ? "all" : "partial";
  return { delegated, total, state };
}

export function delegatedVisiblePhases(
  phases: AiAssistancePhases,
): ManagementPhase[] {
  return PLAYER_VISIBLE_DELEGATION_PHASES.filter((phase) =>
    isPhaseDelegated(phases, phase),
  );
}

export function playerRetainedVisiblePhases(
  phases: AiAssistancePhases,
): ManagementPhase[] {
  return PLAYER_VISIBLE_DELEGATION_PHASES.filter(
    (phase) => !isPhaseDelegated(phases, phase),
  );
}

/** Category IDs that have at least one delegated visible phase. */
export function delegatedCategoryIds(
  phases: AiAssistancePhases,
): DelegationCategoryId[] {
  const ids = new Set<DelegationCategoryId>();
  for (const phase of delegatedVisiblePhases(phases)) {
    ids.add(MANAGEMENT_PHASE_METADATA[phase].categoryId);
  }
  return DELEGATION_CATEGORIES.map((c) => c.id).filter((id) => ids.has(id));
}

/** Category IDs where the player retains at least one visible phase. */
export function playerRetainedCategoryIds(
  phases: AiAssistancePhases,
): DelegationCategoryId[] {
  const ids = new Set<DelegationCategoryId>();
  for (const phase of playerRetainedVisiblePhases(phases)) {
    ids.add(MANAGEMENT_PHASE_METADATA[phase].categoryId);
  }
  return DELEGATION_CATEGORIES.map((c) => c.id).filter((id) => ids.has(id));
}

export function categoryById(
  id: DelegationCategoryId,
): DelegationCategory | undefined {
  return DELEGATION_CATEGORIES.find((c) => c.id === id);
}

/**
 * True when every management phase is off (assist completely disabled).
 */
export function areAllPhasesOff(phases: AiAssistancePhases): boolean {
  return ALL_MANAGEMENT_PHASES.every((phase) => phases[phase] === "off");
}

/**
 * True when the player still retains at least one visible responsibility.
 */
export function playerRetainsAnyVisibleResponsibility(
  phases: AiAssistancePhases,
): boolean {
  return PLAYER_VISIBLE_DELEGATION_PHASES.some(
    (phase) => !isPhaseDelegated(phases, phase),
  );
}
