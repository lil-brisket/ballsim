/**
 * Persisted ownership confidence / strategic friction state.
 * Expectations are derived; this slice stores evidence narrative and mood.
 */

export type OwnershipMood =
  "confident" | "supportive" | "watchful" | "concerned" | "displeased";

export const OWNERSHIP_MOODS: readonly OwnershipMood[] = [
  "confident",
  "supportive",
  "watchful",
  "concerned",
  "displeased",
] as const;

export function isOwnershipMood(value: string): value is OwnershipMood {
  return (OWNERSHIP_MOODS as readonly string[]).includes(value);
}

export type AlignmentEvidenceSignificance = "minor" | "meaningful" | "major";

export const ALIGNMENT_EVIDENCE_SIGNIFICANCES: readonly AlignmentEvidenceSignificance[] =
  ["minor", "meaningful", "major"] as const;

export function isAlignmentEvidenceSignificance(
  value: string,
): value is AlignmentEvidenceSignificance {
  return (ALIGNMENT_EVIDENCE_SIGNIFICANCES as readonly string[]).includes(
    value,
  );
}

export type AlignmentEvidenceDirection = "aligned" | "neutral" | "conflicting";

export const ALIGNMENT_EVIDENCE_DIRECTIONS: readonly AlignmentEvidenceDirection[] =
  ["aligned", "neutral", "conflicting"] as const;

export function isAlignmentEvidenceDirection(
  value: string,
): value is AlignmentEvidenceDirection {
  return (ALIGNMENT_EVIDENCE_DIRECTIONS as readonly string[]).includes(value);
}

export type AlignmentEvidenceKind = "decision" | "posture" | "reversal";

export const ALIGNMENT_EVIDENCE_KINDS: readonly AlignmentEvidenceKind[] = [
  "decision",
  "posture",
  "reversal",
] as const;

export function isAlignmentEvidenceKind(
  value: string,
): value is AlignmentEvidenceKind {
  return (ALIGNMENT_EVIDENCE_KINDS as readonly string[]).includes(value);
}

export type AlignmentDimension =
  "competitive" | "roster" | "assets" | "financial" | "market" | "overall";

export const ALIGNMENT_DIMENSIONS: readonly AlignmentDimension[] = [
  "competitive",
  "roster",
  "assets",
  "financial",
  "market",
  "overall",
] as const;

export function isAlignmentDimension(
  value: string,
): value is AlignmentDimension {
  return (ALIGNMENT_DIMENSIONS as readonly string[]).includes(value);
}

export type AlignmentEvidence = {
  id: string;
  occurredOn: string;
  kind: AlignmentEvidenceKind;
  significance: AlignmentEvidenceSignificance;
  direction: AlignmentEvidenceDirection;
  summary: string;
  detail?: string;
  dimension: AlignmentDimension;
};

export type StrategicReversal = {
  priorDirection: string;
  newDirection: string;
  acknowledged: boolean;
  summary: string;
  occurredOn: string;
};

export type OwnershipSeasonNote = {
  seasonYear: number;
  mood: OwnershipMood;
  mandateSummary: string;
};

/**
 * How far the board has escalated over seasons that ended badly:
 * a formal warning, then frozen discretionary spending, then a blocking
 * "the board wants changes" decision. Good seasons step it back down.
 */
export type BoardPressureStage =
  "none" | "warning" | "restricted" | "ultimatum";

export const BOARD_PRESSURE_STAGES: readonly BoardPressureStage[] = [
  "none",
  "warning",
  "restricted",
  "ultimatum",
] as const;

export function isBoardPressureStage(
  value: string,
): value is BoardPressureStage {
  return (BOARD_PRESSURE_STAGES as readonly string[]).includes(value);
}

export type BoardPressureState = {
  stage: BoardPressureStage;
};

/** Max recent evidence retained for UI and confidence aggregation. */
export const OWNERSHIP_EVIDENCE_RING_MAX = 12;

/** Max season narrative notes (not a parallel franchise history). */
export const OWNERSHIP_SEASON_NOTES_MAX = 8;

/**
 * Persisted ownership confidence state.
 * alignmentScore is derived on read when possible; stored for UI stability.
 */
export type OwnershipConfidenceState = {
  mood: OwnershipMood;
  /** Internal friction meter 0–100; not the primary player-facing metric. */
  concernLevel: number;
  /** Secondary UI metric derived from evidence + posture (0–100). */
  alignmentScore: number;
  recentEvidence: AlignmentEvidence[];
  recentHelping: string[];
  recentHurting: string[];
  lastReversal?: StrategicReversal;
  lastConfidenceChangeOn: string;
  lastPostureCheckOn?: string;
  seasonNotes: OwnershipSeasonNote[];
  boardPressure: BoardPressureState;
};

export function createDefaultOwnershipConfidence(
  occurredOn: string,
): OwnershipConfidenceState {
  return {
    mood: "supportive",
    concernLevel: 25,
    alignmentScore: 55,
    recentEvidence: [],
    recentHelping: [],
    recentHurting: [],
    lastConfidenceChangeOn: occurredOn,
    seasonNotes: [],
    boardPressure: { stage: "none" },
  };
}

export function ownershipMoodLabel(mood: OwnershipMood): string {
  switch (mood) {
    case "confident":
      return "Confident";
    case "supportive":
      return "Supportive";
    case "watchful":
      return "Watchful";
    case "concerned":
      return "Concerned";
    case "displeased":
      return "Displeased";
  }
}
