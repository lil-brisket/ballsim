/**
 * Staff role registry: attribute schemas, display labels, and effect keys.
 * Adding a role = registry entry + effect module + generation weights.
 * Eight roles only in the staff overhaul — do not expand without a new phase.
 */

export type StaffRole =
  | "general_manager"
  | "finance"
  | "head_coach"
  | "assistant_coach"
  | "trainer"
  | "scout"
  | "medical"
  | "public_relations";

export const STAFF_ROLES: readonly StaffRole[] = [
  "general_manager",
  "finance",
  "head_coach",
  "assistant_coach",
  "trainer",
  "scout",
  "medical",
  "public_relations",
] as const;

/** Roles assigned to every new-league team (medical is vacancy on legacy saves). */
export const STARTER_STAFF_ROLES: readonly StaffRole[] = [
  "general_manager",
  "head_coach",
  "assistant_coach",
  "scout",
  "trainer",
  "medical",
  "finance",
  "public_relations",
] as const;

export const STAFF_ROLE_DISPLAY: Record<StaffRole, string> = {
  general_manager: "General Manager",
  finance: "Finance Director",
  head_coach: "Head Coach",
  assistant_coach: "Assistant Coach",
  trainer: "Trainer / Development Coach",
  scout: "Scout",
  medical: "Medical Staff",
  public_relations: "PR / Communications",
};

export type StaffEffectModuleKey =
  | "gm"
  | "finance"
  | "coach"
  | "development"
  | "scout"
  | "medical"
  | "pr";

export const STAFF_ROLE_EFFECT_MODULE: Record<StaffRole, StaffEffectModuleKey> =
  {
    general_manager: "gm",
    finance: "finance",
    head_coach: "coach",
    assistant_coach: "coach",
    trainer: "development",
    scout: "scout",
    medical: "medical",
    public_relations: "pr",
  };

export type GmAttributes = {
  rosterEvaluation: number;
  playerEvaluation: number;
  contractEvaluation: number;
  tradeNegotiation: number;
  assetValuation: number;
  capManagement: number;
  longTermPlanning: number;
  scoutingCoordination: number;
};

export type FinanceAttributes = {
  revenueEfficiency: number;
  costControl: number;
  sponsorshipLeverage: number;
  budgetForecasting: number;
  investmentJudgment: number;
  compliance: number;
};

export type HeadCoachAttributes = {
  offensiveStrategy: number;
  defensiveStrategy: number;
  gameManagement: number;
  playerDevelopment: number;
  leadership: number;
  adaptability: number;
  threePointCoaching: number;
  interiorReboundingCoaching: number;
};

export type AssistantCoachAttributes = {
  offensiveSupport: number;
  defensiveSupport: number;
  gamePreparation: number;
  playerDevelopment: number;
  adaptability: number;
  leadership: number;
};

export type TrainerAttributes = {
  playerDevelopment: number;
  skillDevelopment: number;
  potentialDevelopment: number;
  conditioning: number;
  youthDevelopment: number;
};

export type ScoutAttributes = {
  scoutingAccuracy: number;
  scoutingSpeed: number;
  playerEvaluation: number;
  potentialEvaluation: number;
  internationalScouting: number;
};

export type MedicalAttributes = {
  injuryPrevention: number;
  injuryDiagnosis: number;
  rehabilitation: number;
  recovery: number;
  conditioning: number;
};

export type PrAttributes = {
  teamReputation: number;
  playerRelations: number;
  publicRelations: number;
  mediaHandling: number;
  marketability: number;
};

export type StaffAttributesByRole = {
  general_manager: GmAttributes;
  finance: FinanceAttributes;
  head_coach: HeadCoachAttributes;
  assistant_coach: AssistantCoachAttributes;
  trainer: TrainerAttributes;
  scout: ScoutAttributes;
  medical: MedicalAttributes;
  public_relations: PrAttributes;
};

export type StaffAttributes = StaffAttributesByRole[StaffRole];

export const STAFF_ATTRIBUTE_KEYS: {
  [R in StaffRole]: readonly (keyof StaffAttributesByRole[R])[];
} = {
  general_manager: [
    "rosterEvaluation",
    "playerEvaluation",
    "contractEvaluation",
    "tradeNegotiation",
    "assetValuation",
    "capManagement",
    "longTermPlanning",
    "scoutingCoordination",
  ],
  finance: [
    "revenueEfficiency",
    "costControl",
    "sponsorshipLeverage",
    "budgetForecasting",
    "investmentJudgment",
    "compliance",
  ],
  head_coach: [
    "offensiveStrategy",
    "defensiveStrategy",
    "gameManagement",
    "playerDevelopment",
    "leadership",
    "adaptability",
    "threePointCoaching",
    "interiorReboundingCoaching",
  ],
  assistant_coach: [
    "offensiveSupport",
    "defensiveSupport",
    "gamePreparation",
    "playerDevelopment",
    "adaptability",
    "leadership",
  ],
  trainer: [
    "playerDevelopment",
    "skillDevelopment",
    "potentialDevelopment",
    "conditioning",
    "youthDevelopment",
  ],
  scout: [
    "scoutingAccuracy",
    "scoutingSpeed",
    "playerEvaluation",
    "potentialEvaluation",
    "internationalScouting",
  ],
  medical: [
    "injuryPrevention",
    "injuryDiagnosis",
    "rehabilitation",
    "recovery",
    "conditioning",
  ],
  public_relations: [
    "teamReputation",
    "playerRelations",
    "publicRelations",
    "mediaHandling",
    "marketability",
  ],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    typeof value === "string" &&
    (STAFF_ROLES as readonly string[]).includes(value)
  );
}

/** Legacy role id from pre-v50 saves. */
export function migrateLegacyStaffRole(role: string): StaffRole {
  if (role === "marketing") {
    return "public_relations";
  }
  if (role === "other") {
    return "assistant_coach";
  }
  if (isStaffRole(role)) {
    return role;
  }
  throw new Error(`Unknown staff role "${role}" during migration.`);
}
