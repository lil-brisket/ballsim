/**
 * Draft pick result — authoritative history for grading and long-term regrades.
 * Survives prospect lifecycle; stores scouting snapshot at selection time.
 */

import type {
  DraftClassId,
  DraftPickId,
  PlayerId,
  TeamId,
} from "@/domain/ids";
import type { DraftPickRound } from "@/domain/entities/draft-pick";
import type { Player } from "@/domain/entities/player";
import type {
  PickGradeSummary,
  RatingRange,
  ScoutConfidence,
  ScoutGrade,
} from "@/domain/entities/scouting-types";

export type ScoutingAtSelection = {
  scoutGrade: ScoutGrade;
  estimatedOverall: RatingRange;
  estimatedPotential: RatingRange;
  confidence: ScoutConfidence;
};

export type DraftPickResult = {
  draftClassId: DraftClassId;
  draftPickId: DraftPickId;
  seasonYear: number;
  round: DraftPickRound;
  overallPick: number;
  teamId: TeamId;
  playerId: PlayerId;
  /** Exact player truth at selection (for long-term regrade only). */
  playerSnapshot: Player;
  /** What this team's scouts believed at selection. */
  scoutingAtSelection: ScoutingAtSelection;
  immediateGrade?: PickGradeSummary;
  longTermGrade?: PickGradeSummary;
};

export function createDraftPickResult(input: {
  draftClassId: DraftClassId;
  draftPickId: DraftPickId;
  seasonYear: number;
  round: DraftPickRound;
  overallPick: number;
  teamId: TeamId;
  playerId: PlayerId;
  playerSnapshot: Player;
  scoutingAtSelection: ScoutingAtSelection;
  immediateGrade?: PickGradeSummary;
  longTermGrade?: PickGradeSummary;
}): DraftPickResult {
  const result: DraftPickResult = {
    draftClassId: input.draftClassId,
    draftPickId: input.draftPickId,
    seasonYear: input.seasonYear,
    round: input.round,
    overallPick: input.overallPick,
    teamId: input.teamId,
    playerId: input.playerId,
    playerSnapshot: { ...input.playerSnapshot },
    scoutingAtSelection: {
      scoutGrade: input.scoutingAtSelection.scoutGrade,
      estimatedOverall: { ...input.scoutingAtSelection.estimatedOverall },
      estimatedPotential: { ...input.scoutingAtSelection.estimatedPotential },
      confidence: input.scoutingAtSelection.confidence,
    },
  };
  if (input.immediateGrade !== undefined) {
    result.immediateGrade = { ...input.immediateGrade };
  }
  if (input.longTermGrade !== undefined) {
    result.longTermGrade = { ...input.longTermGrade };
  }
  return result;
}
