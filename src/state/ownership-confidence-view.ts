import { getActiveOwnedFranchise } from "@/state/owner-context";
/**
 * Dashboard view model for ownership expectations + confidence.
 */

import type {
  BoardPressureStage,
  OwnershipMood,
} from "@/domain/entities/ownership-confidence";
import { ownershipMoodLabel } from "@/domain/entities/ownership-confidence";
import type { OwnershipExpectations } from "@/domain/entities/ownership-expectations";
import type { GameState } from "@/state/game-state";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import { evaluateStrategicPosture } from "@/systems/ownership-strategic-posture";
import { BOARD_SETTLEMENT_COST } from "@/systems/board-pressure";

export type BoardPressureView = {
  stage: BoardPressureStage;
  label: string;
  detail: string;
  /** The board's "wants changes" decision is waiting; time cannot advance. */
  decisionPending: boolean;
  settlementCost: number;
};

const BOARD_STAGE_COPY: Record<
  BoardPressureStage,
  { label: string; detail: string }
> = {
  none: {
    label: "No pressure",
    detail: "The board is not acting on ownership's mood.",
  },
  warning: {
    label: "Formal warning",
    detail:
      "Another season that ends with ownership concerned or displeased will freeze discretionary spending.",
  },
  restricted: {
    label: "Spending frozen",
    detail:
      "No facility upgrades, marketing increases or game-day promotions. A season that ends with ownership supportive or confident lifts the freeze; another bad one brings the board's demands.",
  },
  ultimatum: {
    label: "The board wants changes",
    detail:
      "Accept the board's turnaround plan (the spending freeze stays and ownership remains concerned), or settle with the board's partners to lift the freeze.",
  },
};

export type OwnershipConfidenceView = {
  philosophy: string;
  mandateSummary: string;
  priorityBullets: string[];
  mood: OwnershipMood;
  moodLabel: string;
  concern: string | null;
  alignmentScore: number;
  recentDecisions: {
    direction: "aligned" | "neutral" | "conflicting";
    summary: string;
  }[];
  whyHelping: string[];
  whyHurting: string[];
  expectationVsReality: string;
  competitiveExpectation: string;
  expectations: OwnershipExpectations;
  board: BoardPressureView;
};

const PHILOSOPHY_LABELS: Record<string, string> = {
  win_now: "Win Now",
  build_for_the_future: "Build for the Future",
  financially_conservative: "Financially Conservative",
  market_expansion: "Market Expansion",
  balanced: "Balanced",
};

/**
 * Build ownership confidence section for the owner dashboard.
 */
export function toOwnershipConfidenceView(
  state: GameState,
): OwnershipConfidenceView {
  const expectations = buildOwnershipExpectations(state);
  const confidence = getActiveOwnedFranchise(state).ownershipConfidence;
  const posture = evaluateStrategicPosture(state);

  const recentDecisions = confidence.recentEvidence
    .filter((item) => item.kind === "decision" || item.kind === "reversal")
    .slice(-6)
    .reverse()
    .map((item) => ({
      direction: item.direction,
      summary: item.summary,
    }));

  const concern =
    confidence.mood === "concerned" || confidence.mood === "displeased"
      ? posture.gap.summary
      : confidence.mood === "watchful"
        ? "Ownership is watching recent strategic choices closely."
        : null;

  return {
    philosophy:
      PHILOSOPHY_LABELS[expectations.philosophy] ?? expectations.philosophy,
    mandateSummary: expectations.mandateSummary,
    priorityBullets: expectations.priorityBullets,
    mood: confidence.mood,
    moodLabel: ownershipMoodLabel(confidence.mood),
    concern,
    alignmentScore: confidence.alignmentScore,
    recentDecisions,
    whyHelping: confidence.recentHelping.slice().reverse(),
    whyHurting: confidence.recentHurting.slice().reverse(),
    expectationVsReality: posture.gap.summary,
    competitiveExpectation: expectations.competitiveExpectation,
    expectations,
    board: {
      stage: confidence.boardPressure.stage,
      ...BOARD_STAGE_COPY[confidence.boardPressure.stage],
      decisionPending: confidence.boardPressure.stage === "ultimatum",
      settlementCost: BOARD_SETTLEMENT_COST,
    },
  };
}
