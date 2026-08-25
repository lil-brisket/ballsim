/**
 * Registered AI management actions for the user franchise.
 * Every action declares phase, classification, required capability, and logging metadata.
 * Policy evaluates whether the phase mode grants the required capability — not ordinals.
 */

import type { ManagementPhase } from "@/domain/ai-management-presets";

export type ActionClassification =
  | "continuity"
  | "routine"
  | "strategic"
  | "userDecision";

/**
 * Capability an action requires from its phase mode.
 * Interpreted per-phase (not a global ladder).
 */
export type RequiredCapability =
  | "continuity"
  | "routine"
  | "full"
  | "recommend"
  | "user_only"
  | "propose"
  | "execute";

export type ManagementActionId =
  | "SIGN_INJURY_REPLACEMENT"
  | "MAINTAIN_MIN_ROSTER"
  | "FIX_INVALID_ROTATION"
  | "ADJUST_STARTING_LINEUP"
  | "SIGN_EMERGENCY_FA"
  | "SIGN_ROUTINE_FA"
  | "SIGN_STRATEGIC_FA"
  | "PROPOSE_TRADE"
  | "EXECUTE_TRADE"
  | "RELEASE_FOR_ROSTER_RULES"
  | "DISCRETIONARY_RELEASE"
  | "EXTEND_MINIMUM_CONTRACT"
  | "EXTEND_KEY_PLAYER"
  | "DRAFT_SCOUT"
  | "DRAFT_PICK"
  | "HIRE_REQUIRED_COACH"
  | "HIRE_REQUIRED_FRONT_OFFICE"
  | "HIRE_ROUTINE_STAFF"
  | "REBUILD_MOVE"
  | "CAP_FLEXIBILITY_MOVE";

export type ManagementActionDefinition = {
  id: ManagementActionId;
  phase: ManagementPhase;
  classification: ActionClassification;
  requiredCapability: RequiredCapability;
  mutatesState: boolean;
  /**
   * Days before the same need fingerprint may be reconsidered.
   * 0 = re-evaluate when trigger changes only.
   */
  cooldownDays: number;
  /**
   * When true, DENY outcomes become DENY_BLOCK (simulation cannot safely continue).
   * Used for mandatory decisions like draft clock.
   */
  blocksWhenDenied: boolean;
  logging: {
    defaultReason: string;
    defaultTrigger: string;
  };
};

export const MANAGEMENT_ACTIONS = {
  SIGN_INJURY_REPLACEMENT: {
    id: "SIGN_INJURY_REPLACEMENT",
    phase: "injuriesEmergencyRoster",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Injured player requires roster replacement",
      defaultTrigger: "player_injured",
    },
  },
  MAINTAIN_MIN_ROSTER: {
    id: "MAINTAIN_MIN_ROSTER",
    phase: "injuriesEmergencyRoster",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Roster below minimum size",
      defaultTrigger: "roster_below_minimum",
    },
  },
  FIX_INVALID_ROTATION: {
    id: "FIX_INVALID_ROTATION",
    phase: "rotationsDepthChart",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Lineup invalid due to unavailable players",
      defaultTrigger: "invalid_rotation",
    },
  },
  ADJUST_STARTING_LINEUP: {
    id: "ADJUST_STARTING_LINEUP",
    phase: "rotationsDepthChart",
    classification: "routine",
    requiredCapability: "routine",
    mutatesState: true,
    cooldownDays: 3,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Routine rotation adjustment",
      defaultTrigger: "rotation_rebalance",
    },
  },
  SIGN_EMERGENCY_FA: {
    id: "SIGN_EMERGENCY_FA",
    phase: "freeAgency",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Emergency free-agent signing to keep roster functional",
      defaultTrigger: "roster_emergency",
    },
  },
  SIGN_ROUTINE_FA: {
    id: "SIGN_ROUTINE_FA",
    phase: "freeAgency",
    classification: "routine",
    requiredCapability: "routine",
    mutatesState: true,
    cooldownDays: 7,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Routine free-agent signing for depth or positional need",
      defaultTrigger: "positional_need",
    },
  },
  SIGN_STRATEGIC_FA: {
    id: "SIGN_STRATEGIC_FA",
    phase: "freeAgency",
    classification: "strategic",
    requiredCapability: "full",
    mutatesState: true,
    cooldownDays: 14,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Strategic free-agent acquisition",
      defaultTrigger: "roster_upgrade",
    },
  },
  PROPOSE_TRADE: {
    id: "PROPOSE_TRADE",
    phase: "trades",
    classification: "userDecision",
    requiredCapability: "user_only",
    mutatesState: false,
    cooldownDays: 7,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Trade proposal prepared for owner review",
      defaultTrigger: "trade_opportunity",
    },
  },
  EXECUTE_TRADE: {
    id: "EXECUTE_TRADE",
    phase: "trades",
    classification: "strategic",
    requiredCapability: "full",
    mutatesState: true,
    cooldownDays: 7,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Trade executed by AI",
      defaultTrigger: "trade_execution",
    },
  },
  RELEASE_FOR_ROSTER_RULES: {
    id: "RELEASE_FOR_ROSTER_RULES",
    phase: "waiversReleases",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Release required to satisfy roster rules",
      defaultTrigger: "roster_over_maximum",
    },
  },
  DISCRETIONARY_RELEASE: {
    id: "DISCRETIONARY_RELEASE",
    phase: "waiversReleases",
    classification: "strategic",
    requiredCapability: "full",
    mutatesState: true,
    cooldownDays: 7,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Discretionary player release",
      defaultTrigger: "roster_reshaping",
    },
  },
  EXTEND_MINIMUM_CONTRACT: {
    id: "EXTEND_MINIMUM_CONTRACT",
    phase: "contracts",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Minimum-contract housekeeping",
      defaultTrigger: "contract_maintenance",
    },
  },
  EXTEND_KEY_PLAYER: {
    id: "EXTEND_KEY_PLAYER",
    phase: "contracts",
    classification: "strategic",
    requiredCapability: "full",
    mutatesState: true,
    cooldownDays: 30,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Key player contract extension",
      defaultTrigger: "strategic_extension",
    },
  },
  DRAFT_SCOUT: {
    id: "DRAFT_SCOUT",
    phase: "draftScouting",
    classification: "routine",
    requiredCapability: "recommend",
    mutatesState: false,
    cooldownDays: 1,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Draft prospect evaluation",
      defaultTrigger: "draft_scouting",
    },
  },
  DRAFT_PICK: {
    id: "DRAFT_PICK",
    phase: "draftSelection",
    classification: "strategic",
    requiredCapability: "full",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: true,
    logging: {
      defaultReason: "Draft selection made for user franchise",
      defaultTrigger: "draft_clock",
    },
  },
  HIRE_REQUIRED_COACH: {
    id: "HIRE_REQUIRED_COACH",
    phase: "coachingStaff",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Required coaching vacancy filled",
      defaultTrigger: "missing_coach_role",
    },
  },
  HIRE_REQUIRED_FRONT_OFFICE: {
    id: "HIRE_REQUIRED_FRONT_OFFICE",
    phase: "frontOfficeStaff",
    classification: "continuity",
    requiredCapability: "continuity",
    mutatesState: true,
    cooldownDays: 0,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Required front-office vacancy filled",
      defaultTrigger: "missing_front_office_role",
    },
  },
  HIRE_ROUTINE_STAFF: {
    id: "HIRE_ROUTINE_STAFF",
    phase: "coachingStaff",
    classification: "routine",
    requiredCapability: "routine",
    mutatesState: true,
    cooldownDays: 7,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Routine staff hire",
      defaultTrigger: "staff_upgrade",
    },
  },
  REBUILD_MOVE: {
    id: "REBUILD_MOVE",
    phase: "strategicRosterDecisions",
    classification: "strategic",
    requiredCapability: "full",
    mutatesState: true,
    cooldownDays: 14,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Strategic rebuild roster move",
      defaultTrigger: "rebuild_window",
    },
  },
  CAP_FLEXIBILITY_MOVE: {
    id: "CAP_FLEXIBILITY_MOVE",
    phase: "longTermPlanning",
    classification: "strategic",
    requiredCapability: "full",
    mutatesState: true,
    cooldownDays: 14,
    blocksWhenDenied: false,
    logging: {
      defaultReason: "Long-term cap flexibility move",
      defaultTrigger: "cap_planning",
    },
  },
} as const satisfies Record<ManagementActionId, ManagementActionDefinition>;

export const MANAGEMENT_ACTION_IDS = Object.keys(
  MANAGEMENT_ACTIONS,
) as ManagementActionId[];

export function getManagementAction(
  id: ManagementActionId,
): ManagementActionDefinition {
  return MANAGEMENT_ACTIONS[id];
}
