/**
 * Ownership confidence engine — evidence → mood → modest patience drift.
 * Alignment scores are derived support metrics, not the gameplay centerpiece.
 */

import type {
  AlignmentEvidence,
  OwnershipConfidenceState,
  OwnershipMood,
  OwnershipSeasonNote,
} from "@/domain/entities/ownership-confidence";
import {
  OWNERSHIP_EVIDENCE_RING_MAX,
  OWNERSHIP_SEASON_NOTES_MAX,
} from "@/domain/entities/ownership-confidence";
import type { DomainEvent } from "@/domain/events";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnedFranchise,
  getActiveOwnerTeamId,
  withOwnedFranchise,
} from "@/state/owner-context";
import { clampOwnerPatience } from "@/systems/owner-philosophy-config";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import { evaluateStrategicPosture } from "@/systems/ownership-strategic-posture";
import { generateOwnershipConfidenceNotifications } from "@/systems/ownership-confidence-notifications";

const MOOD_ORDER: readonly OwnershipMood[] = [
  "confident",
  "supportive",
  "watchful",
  "concerned",
  "displeased",
];

const SIGNIFICANCE_WEIGHT: Record<AlignmentEvidence["significance"], number> = {
  minor: 0,
  meaningful: 1,
  major: 2.25,
};

const KIND_WEIGHT: Record<AlignmentEvidence["kind"], number> = {
  decision: 0.35,
  posture: 0.65,
  reversal: 0.5,
};

export type OwnershipConfidenceProcessResult = SystemResult & {
  postureRan: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function moodIndex(mood: OwnershipMood): number {
  return MOOD_ORDER.indexOf(mood);
}

function moodFromIndex(index: number): OwnershipMood {
  return MOOD_ORDER[clamp(index, 0, MOOD_ORDER.length - 1)]!;
}

function pushEvidence(
  list: AlignmentEvidence[],
  evidence: AlignmentEvidence,
): AlignmentEvidence[] {
  const withoutDup = list.filter((item) => item.id !== evidence.id);
  const next = [...withoutDup, evidence];
  return next.length > OWNERSHIP_EVIDENCE_RING_MAX
    ? next.slice(next.length - OWNERSHIP_EVIDENCE_RING_MAX)
    : next;
}

function pushUniqueLine(list: string[], line: string, max = 4): string[] {
  const cleaned = list.filter((item) => item !== line);
  return [...cleaned, line].slice(-max);
}

/**
 * Derive alignmentScore (0–100) from recent evidence.
 * Posture-weighted; minor decisions do not move the needle.
 */
export function deriveAlignmentScore(
  evidence: readonly AlignmentEvidence[],
): number {
  if (evidence.length === 0) {
    return 55;
  }
  let weighted = 0;
  let total = 0;
  for (const item of evidence) {
    const sig = SIGNIFICANCE_WEIGHT[item.significance];
    if (sig <= 0) {
      continue;
    }
    const kind = KIND_WEIGHT[item.kind];
    const weight = sig * kind;
    const value =
      item.direction === "aligned" ? 1 : item.direction === "conflicting" ? 0 : 0.55;
    weighted += value * weight;
    total += weight;
  }
  if (total <= 0) {
    return 55;
  }
  return Math.round(clamp((weighted / total) * 100, 0, 100));
}

function countPattern(
  evidence: readonly AlignmentEvidence[],
  direction: AlignmentEvidence["direction"],
): number {
  return evidence.filter(
    (item) =>
      item.direction === direction && item.significance !== "minor",
  ).length;
}

/**
 * Resolve next mood from concern level and evidence patterns.
 * Requires patterns — a single meaningful decision does not jump to displeased.
 */
export function resolveMood(
  current: OwnershipMood,
  concernLevel: number,
  evidence: readonly AlignmentEvidence[],
  hadMajorConflict: boolean,
): OwnershipMood {
  const conflicting = countPattern(evidence, "conflicting");
  const aligned = countPattern(evidence, "aligned");
  let next = moodIndex(current);

  if (aligned >= 3 && conflicting === 0 && concernLevel < 30) {
    next = Math.min(next, moodIndex("confident"));
    next -= 1;
  } else if (aligned >= 2 && conflicting <= 1 && concernLevel < 40) {
    next = Math.min(next, moodIndex("supportive"));
  }

  if (conflicting >= 3 || concernLevel >= 55) {
    next = Math.max(next, moodIndex("watchful"));
  }
  if (conflicting >= 4 || concernLevel >= 70) {
    next = Math.max(next, moodIndex("concerned"));
  }
  if (concernLevel >= 85 || (hadMajorConflict && conflicting >= 4)) {
    next = Math.max(next, moodIndex("displeased"));
  }

  // Cap single-step mood worsening except for major conflict.
  const maxDrop = hadMajorConflict ? 2 : 1;
  next = Math.min(next, moodIndex(current) + maxDrop);
  next = Math.max(next, moodIndex(current) - 1);

  return moodFromIndex(next);
}

function applyEvidenceToConfidence(
  confidence: OwnershipConfidenceState,
  evidence: AlignmentEvidence,
): OwnershipConfidenceState {
  if (evidence.significance === "minor" && evidence.kind === "decision") {
    return {
      ...confidence,
      recentEvidence: pushEvidence(confidence.recentEvidence, evidence),
    };
  }

  let concernLevel = confidence.concernLevel;
  const weight = SIGNIFICANCE_WEIGHT[evidence.significance] * KIND_WEIGHT[evidence.kind];
  if (evidence.direction === "conflicting") {
    concernLevel += weight * 6;
  } else if (evidence.direction === "aligned") {
    concernLevel -= weight * 5;
  } else if (evidence.kind === "reversal") {
    concernLevel = clamp(concernLevel - 4, 0, 100);
  }
  concernLevel = clamp(concernLevel, 0, 100);

  let recentHelping = [...confidence.recentHelping];
  let recentHurting = [...confidence.recentHurting];
  if (evidence.direction === "aligned") {
    recentHelping = pushUniqueLine(recentHelping, evidence.detail ?? evidence.summary);
  } else if (evidence.direction === "conflicting") {
    recentHurting = pushUniqueLine(recentHurting, evidence.detail ?? evidence.summary);
  }

  const recentEvidence = pushEvidence(confidence.recentEvidence, evidence);
  const alignmentScore = deriveAlignmentScore(recentEvidence);
  const hadMajorConflict =
    evidence.significance === "major" && evidence.direction === "conflicting";
  const mood = resolveMood(
    confidence.mood,
    concernLevel,
    recentEvidence,
    hadMajorConflict,
  );

  return {
    ...confidence,
    concernLevel: Math.round(concernLevel),
    alignmentScore,
    recentEvidence,
    recentHelping,
    recentHurting,
    mood,
    lastConfidenceChangeOn:
      mood !== confidence.mood
        ? evidence.occurredOn
        : confidence.lastConfidenceChangeOn,
    lastReversal:
      evidence.kind === "reversal"
        ? {
            priorDirection: "prior",
            newDirection: "new",
            acknowledged: false,
            summary: evidence.summary,
            occurredOn: evidence.occurredOn,
          }
        : confidence.lastReversal,
  };
}

/**
 * Record decision evidence onto game state (mutation-time hook).
 */
export function recordOwnershipEvidence(
  state: GameState,
  evidence: AlignmentEvidence | null | undefined,
): GameState {
  if (!evidence) {
    return state;
  }
  const ownershipConfidence = applyEvidenceToConfidence(
    getActiveOwnedFranchise(state).ownershipConfidence,
    evidence,
  );
  return withOwnedFranchise(state, getActiveOwnerTeamId(state), (franchise) => ({
    ...franchise,
    ownershipConfidence,
  }));
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  if (!Number.isFinite(ms)) {
    return 999;
  }
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Weekly posture + confidence processing. Idempotent per calendar week.
 */
export function processOwnershipConfidence(
  state: GameState,
): OwnershipConfidenceProcessResult {
  const date = state.world.calendar.currentDate;
  const confidence = getActiveOwnedFranchise(state).ownershipConfidence;
  const lastCheck = confidence.lastPostureCheckOn;
  const events: DomainEvent[] = [];

  // Run at most once per 7 world days.
  if (lastCheck && daysBetween(lastCheck, date) < 7) {
    return {
      ...systemResult(state, events),
      postureRan: false,
    };
  }

  const evaluation = evaluateStrategicPosture(state);
  let nextConfidence: OwnershipConfidenceState = {
    ...confidence,
    lastPostureCheckOn: date,
  };
  for (const evidence of evaluation.evidence) {
    nextConfidence = applyEvidenceToConfidence(nextConfidence, evidence);
  }
  if (evaluation.reversal) {
    nextConfidence = {
      ...nextConfidence,
      lastReversal: evaluation.reversal,
    };
  }

  // Modest patience drift from mood only (capped).
  let ownerPatience = getActiveOwnedFranchise(state).ownerPatience;
  if (nextConfidence.mood === "concerned") {
    ownerPatience = clampOwnerPatience(ownerPatience - 1);
  } else if (nextConfidence.mood === "displeased") {
    ownerPatience = clampOwnerPatience(ownerPatience - 2);
  } else if (
    nextConfidence.mood === "confident" &&
    confidence.mood !== "confident"
  ) {
    ownerPatience = clampOwnerPatience(ownerPatience + 1);
  }

  let current: GameState = withOwnedFranchise(
    state,
    getActiveOwnerTeamId(state),
    (franchise) => ({
      ...franchise,
      ownershipConfidence: nextConfidence,
      ownerPatience,
    }),
  );

  const notifs = generateOwnershipConfidenceNotifications(current, {
    previousMood: confidence.mood,
    previousConcern: confidence.concernLevel,
    reversal: evaluation.reversal,
    gapSummary: evaluation.gap.summary,
    postureSummary: evaluation.posture.narrativeSummary,
  });
  current = notifs.state;
  events.push(...notifs.events);

  return {
    ...systemResult(current, events),
    postureRan: true,
  };
}

/**
 * Append a season note at offseason boundary (bounded history).
 */
export function appendOwnershipSeasonNote(state: GameState): GameState {
  const expectations = buildOwnershipExpectations(state);
  const note: OwnershipSeasonNote = {
    seasonYear: state.competition.season.year,
    mood: getActiveOwnedFranchise(state).ownershipConfidence.mood,
    mandateSummary: expectations.mandateSummary,
  };
  const existing = getActiveOwnedFranchise(state).ownershipConfidence.seasonNotes.filter(
    (item) => item.seasonYear !== note.seasonYear,
  );
  const seasonNotes = [...existing, note];
  const trimmed =
    seasonNotes.length > OWNERSHIP_SEASON_NOTES_MAX
      ? seasonNotes.slice(seasonNotes.length - OWNERSHIP_SEASON_NOTES_MAX)
      : seasonNotes;

  return withOwnedFranchise(state, getActiveOwnerTeamId(state), (franchise) => ({
    ...franchise,
    ownershipConfidence: {
      ...franchise.ownershipConfidence,
      seasonNotes: trimmed,
      lastReversal: franchise.ownershipConfidence.lastReversal
        ? {
            ...franchise.ownershipConfidence.lastReversal,
            acknowledged: true,
          }
        : undefined,
    },
  }));
}

export function confidenceAlignmentScore(state: GameState): number {
  return getActiveOwnedFranchise(state).ownershipConfidence.alignmentScore;
}
