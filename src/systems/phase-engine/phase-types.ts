import type { TeamId } from "@/domain/ids";

/**
 * Authoritative league calendar phase IDs (V1).
 * Not every management concern is a phase — see PhaseFocus / PhaseTask.
 */
export type LeaguePhaseId =
  | "postseason.season_review"
  | "offseason.season_transition"
  | "offseason.roster_decisions"
  | "offseason.draft_preparation"
  | "offseason.draft"
  | "offseason.free_agency"
  | "offseason.staff_development"
  | "preseason.preparation"
  | "regular"
  | "playoffs"
  | "end_of_season.wrap_up";

export const LEAGUE_PHASE_IDS: readonly LeaguePhaseId[] = [
  "postseason.season_review",
  "offseason.season_transition",
  "offseason.roster_decisions",
  "offseason.draft_preparation",
  "offseason.draft",
  "offseason.free_agency",
  "offseason.staff_development",
  "preseason.preparation",
  "regular",
  "playoffs",
  "end_of_season.wrap_up",
] as const;

export type AdvanceMode = "automatic" | "user";

export type ActionPriority = "required" | "recommended" | "optional";

export type PhaseStage =
  | "postseason"
  | "offseason"
  | "preseason"
  | "regular"
  | "playoffs"
  | "end_of_season";

/** Attention theme — not an actionable task. */
export type PhaseFocus = {
  focusKey: string;
  title: string;
  detail: string;
  explanation: string;
  phaseId: LeaguePhaseId;
  teamId: TeamId;
};

/** Specific actionable item with stable identity for dismissal matching. */
export type PhaseTask = {
  taskKey: string;
  type: string;
  subject?: string;
  phaseId: LeaguePhaseId;
  priority: ActionPriority;
  title: string;
  detail: string;
  explanation: string;
  href: string;
  deadline?: string;
  teamId: TeamId;
  focusKey?: string;
};

export type PhaseAttentionSummary = {
  required: PhaseTask[];
  recommended: PhaseTask[];
  optional: PhaseTask[];
  counts: {
    required: number;
    recommended: number;
    optional: number;
  };
};

export type DismissUntil = "phase_end" | "date" | "condition_change";

export type DismissedRecommendation = {
  taskKey: string;
  dismissedUntil: DismissUntil;
  dismissedAt: string;
  phaseId: LeaguePhaseId;
  /** When dismissedUntil is "date". */
  untilDate?: string;
};

export type FranchisePhaseState = {
  dismissed: DismissedRecommendation[];
};

/** Persisted league phase pointer. */
export type CompetitionPhaseState = {
  activePhaseId: LeaguePhaseId;
  enteredDate: string;
};

export type PhaseAdvancePreview = {
  fromPhaseId: LeaguePhaseId;
  toPhaseId: LeaguePhaseId;
  toPhaseName: string;
  consequences: string[];
  recommendedRemaining: number;
  requiredRemaining: number;
  canAdvance: boolean;
  blockReason: string | null;
};

export type PhaseAdvanceSummary = {
  fromPhaseId: LeaguePhaseId;
  toPhaseId: LeaguePhaseId;
  fromPhaseName: string;
  toPhaseName: string;
  ownerHighlights: string[];
  leagueHighlights: string[];
};

export type ResolvedPhase = {
  phaseId: LeaguePhaseId;
  stage: PhaseStage;
  name: string;
  theme: string;
  objective: string;
  description: string;
  advanceMode: AdvanceMode;
  enteredDate: string;
  nextPhaseId: LeaguePhaseId | null;
  nextPhaseName: string | null;
  laterPhaseId: LeaguePhaseId | null;
  laterPhaseName: string | null;
};

export type AiPhaseRoutine =
  | "contracts"
  | "releases"
  | "trades"
  | "scout"
  | "draft"
  | "free_agency"
  | "staff";
