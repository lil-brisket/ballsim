/**
 * Scouting estimate types — fog-of-war layer between player truth and UI/AI.
 * Strengths/weaknesses MUST be derived from estimatedCategories, never true attrs.
 */

import type { PlayerId, StaffId, TeamId } from "@/domain/ids";
import type { PlayerPosition } from "@/domain/entities/player";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";

export type ScoutingKnowledgeLevel =
  | "unknown"
  | "basic"
  | "developing"
  | "detailed"
  | "comprehensive";

export const SCOUTING_KNOWLEDGE_LEVELS: readonly ScoutingKnowledgeLevel[] = [
  "unknown",
  "basic",
  "developing",
  "detailed",
  "comprehensive",
] as const;

export type ScoutConfidence = "low" | "medium" | "high";

export const SCOUT_CONFIDENCES: readonly ScoutConfidence[] = [
  "low",
  "medium",
  "high",
] as const;

export type RatingRange = {
  min: number;
  max: number;
};

/** Evaluation categories scouts estimate — not raw PlayerAttributes. */
export type EstimatedScoutingCategoryKey =
  | "shooting"
  | "finishing"
  | "passing"
  | "ballHandling"
  | "perimeterDefense"
  | "interiorDefense"
  | "rebounding"
  | "athleticism";

export const ESTIMATED_SCOUTING_CATEGORY_KEYS: readonly EstimatedScoutingCategoryKey[] =
  [
    "shooting",
    "finishing",
    "passing",
    "ballHandling",
    "perimeterDefense",
    "interiorDefense",
    "rebounding",
    "athleticism",
  ] as const;

export type EstimatedScoutingCategories = Record<
  EstimatedScoutingCategoryKey,
  RatingRange
>;

export type ScoutGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D"
  | "F";

export const SCOUT_GRADES: readonly ScoutGrade[] = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D",
  "F",
] as const;

export type PersonalityKey =
  | "workEthic"
  | "loyalty"
  | "competitiveness"
  | "leadership"
  | "composure";

export const PERSONALITY_KEYS: readonly PersonalityKey[] = [
  "workEthic",
  "loyalty",
  "competitiveness",
  "leadership",
  "composure",
] as const;

export type ScoutOpinion = {
  staffId: StaffId;
  projectedRank: RatingRange;
  confidence: ScoutConfidence;
  note?: string;
};

export type ProspectMovement = {
  previousProjectedPick: number;
  currentProjectedPick: number;
  delta: number;
  reasons: string[];
};

export type EstimatedProspectData = {
  teamId: TeamId;
  prospectPlayerId: PlayerId;
  /** Raw accumulated scouting effort. */
  exposure: number;
  /** exposure × scout quality × speed × region modifier. */
  effectiveExposure: number;
  knowledgeLevel: ScoutingKnowledgeLevel;
  confidence: ScoutConfidence;
  estimatedOverall: RatingRange;
  estimatedPotential: RatingRange;
  projectedRank: RatingRange;
  scoutGrade: ScoutGrade;
  estimatedCategories: EstimatedScoutingCategories;
  positionEstimate: PlayerPosition;
  positionConfidence: ScoutConfidence;
  intangibles: Partial<Record<PersonalityKey, RatingRange>>;
  scoutOpinions?: ScoutOpinion[];
  movement?: ProspectMovement;
  lastUpdatedOn: string;
};

export type ScoutingRegion = "domestic" | "international";

export const SCOUTING_REGIONS: readonly ScoutingRegion[] = [
  "domestic",
  "international",
] as const;

export type ScoutAssignment = {
  prospectPlayerId: PlayerId;
  assignedOn: string;
  exposurePerDay: number;
};

export type DraftBoardEntry = {
  prospectPlayerId: PlayerId;
  rank: number;
  priority: boolean;
  notes: string;
};

export type InterviewTopic =
  | "playing_time"
  | "development"
  | "winning"
  | "team_role"
  | "leadership"
  | "location"
  | "coaching"
  | "money"
  | "career_goals"
  | "motivation"
  | "work_ethic"
  | "expectations";

export const INTERVIEW_TOPICS: readonly InterviewTopic[] = [
  "playing_time",
  "development",
  "winning",
  "team_role",
  "leadership",
  "location",
  "coaching",
  "money",
  "career_goals",
  "motivation",
  "work_ethic",
  "expectations",
] as const;

export type ProspectInterviewAnswer = {
  topic: InterviewTopic;
  /** User-facing quote. */
  quote: string;
  /** Internal preference signal — not shown to user. */
  preferenceSignal: string;
  preferenceStrength: "low" | "medium" | "high";
};

export type ProspectInterview = {
  prospectPlayerId: PlayerId;
  conductedOn: string;
  answers: ProspectInterviewAnswer[];
};

export type PickGradeLetter =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D"
  | "F";

export type PickGradeSummary = {
  grade: PickGradeLetter;
  explanation: string;
  needAddressed: boolean;
  valueScore: number;
  riskScore: number;
};

export type ScoutingStrengthWeakness = {
  label: string;
  category: EstimatedScoutingCategoryKey;
  confidence: ScoutConfidence;
  polarity: "strength" | "weakness";
};

export function isScoutingKnowledgeLevel(
  value: unknown,
): value is ScoutingKnowledgeLevel {
  return (
    typeof value === "string" &&
    (SCOUTING_KNOWLEDGE_LEVELS as readonly string[]).includes(value)
  );
}

export function isScoutConfidence(value: unknown): value is ScoutConfidence {
  return (
    typeof value === "string" &&
    (SCOUT_CONFIDENCES as readonly string[]).includes(value)
  );
}

export function isScoutGrade(value: unknown): value is ScoutGrade {
  return (
    typeof value === "string" &&
    (SCOUT_GRADES as readonly string[]).includes(value)
  );
}

export function isScoutingRegion(value: unknown): value is ScoutingRegion {
  return (
    typeof value === "string" &&
    (SCOUTING_REGIONS as readonly string[]).includes(value)
  );
}

export function clampRatingValue(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)));
}

export function createRatingRange(min: number, max: number): RatingRange {
  const lo = clampRatingValue(Math.min(min, max));
  const hi = clampRatingValue(Math.max(min, max));
  return { min: lo, max: hi };
}

export function ratingRangeMidpoint(range: RatingRange): number {
  return Math.round((range.min + range.max) / 2);
}

export function ratingRangeWidth(range: RatingRange): number {
  return range.max - range.min;
}
