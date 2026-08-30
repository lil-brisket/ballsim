/**
 * Immediate draft grading from scouting-at-selection (confidence-aware).
 * Long-term regrade framework — populated later from development events.
 */

import type { DraftClass, TeamDraftGrade } from "@/domain/entities/draft";
import type { DraftPickResult } from "@/domain/entities/draft-pick-result";
import type {
  PickGradeLetter,
  PickGradeSummary,
  ScoutConfidence,
} from "@/domain/entities/scouting-types";
import { ratingRangeMidpoint, ratingRangeWidth } from "@/domain/entities/scouting-types";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  calculateTeamDraftNeeds,
  needLevelScore,
} from "@/systems/draft/draft-needs";

function letterFromScore(score: number): PickGradeLetter {
  if (score >= 92) return "A+";
  if (score >= 88) return "A";
  if (score >= 84) return "A-";
  if (score >= 80) return "B+";
  if (score >= 76) return "B";
  if (score >= 72) return "B-";
  if (score >= 68) return "C+";
  if (score >= 64) return "C";
  if (score >= 58) return "C-";
  if (score >= 50) return "D";
  return "F";
}

function confidenceRisk(confidence: ScoutConfidence, width: number): number {
  let risk = width * 0.8;
  if (confidence === "low") risk += 12;
  else if (confidence === "medium") risk += 5;
  return risk;
}

/**
 * Grade a single pick using scouting estimate at selection — never future performance.
 */
export function gradePickImmediate(
  state: GameState,
  pick: DraftPickResult,
): PickGradeSummary {
  const scout = pick.scoutingAtSelection;
  const overallMid = ratingRangeMidpoint(scout.estimatedOverall);
  const potentialMid = ratingRangeMidpoint(scout.estimatedPotential);
  const width = ratingRangeWidth(scout.estimatedOverall);
  const expectedValue = overallMid * 0.4 + potentialMid * 0.6;
  const risk = confidenceRisk(scout.confidence, width);

  // Slot value: early picks expected to deliver higher grades
  const slotExpectation = Math.max(55, 95 - pick.overallPick * 1.1);
  const valueDelta = expectedValue - slotExpectation;

  const needs = calculateTeamDraftNeeds(state, pick.teamId);
  const position = pick.playerSnapshot.position;
  const need =
    needs.byPosition.find((n) => n.position === position)?.level ?? "none";
  const needBonus = needLevelScore(need) * 3;
  const needAddressed = need !== "none" && need !== "minor";

  const reachPenalty =
    valueDelta < -8 && need === "none" ? 10 : valueDelta < -5 ? 5 : 0;

  const score = Math.max(
    40,
    Math.min(99, 75 + valueDelta + needBonus - risk * 0.35 - reachPenalty),
  );

  const parts: string[] = [];
  if (needAddressed) parts.push(`Addresses ${need} ${position} need`);
  if (scout.confidence === "high") parts.push("High scout confidence");
  if (scout.confidence === "low") parts.push("High uncertainty");
  if (reachPenalty > 0) parts.push("Reach relative to board");
  if (valueDelta > 5) parts.push("Strong value at pick");
  if (parts.length === 0) parts.push("Solid selection for draft slot");

  return {
    grade: letterFromScore(score),
    explanation: parts.join(". ") + ".",
    needAddressed,
    valueScore: Math.round(expectedValue),
    riskScore: Math.round(risk),
  };
}

export function gradeDraftForTeam(
  state: GameState,
  draft: DraftClass,
  teamId: TeamId,
): TeamDraftGrade {
  const picks = draft.pickResults.filter((p) => p.teamId === teamId);
  if (picks.length === 0) {
    return {
      overallGrade: "N/A",
      bestPickPlayerId: null,
      biggestReachPlayerId: null,
      needAddressed: false,
      explanation: "No selections in this draft.",
    };
  }

  const graded = picks.map((p) => ({
    pick: p,
    grade: p.immediateGrade ?? gradePickImmediate(state, p),
  }));

  const gradeOrder = [
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
  ];
  const best = [...graded].sort(
    (a, b) =>
      gradeOrder.indexOf(a.grade.grade) - gradeOrder.indexOf(b.grade.grade),
  )[0]!;
  const reach = [...graded].sort(
    (a, b) => b.grade.riskScore - a.grade.riskScore,
  )[0]!;

  const avgIndex =
    graded.reduce((sum, g) => sum + gradeOrder.indexOf(g.grade.grade), 0) /
    graded.length;
  const overallGrade = gradeOrder[Math.round(avgIndex)] ?? "C";
  const needAddressed = graded.some((g) => g.grade.needAddressed);

  return {
    overallGrade,
    bestPickPlayerId: best.pick.playerId,
    biggestReachPlayerId: reach.grade.riskScore >= 18 ? reach.pick.playerId : null,
    needAddressed,
    explanation: needAddressed
      ? `Draft addressed roster needs with overall ${overallGrade} grade.`
      : `Draft valued talent over need; overall ${overallGrade} grade.`,
  };
}

export function applyImmediateGradesToDraft(
  state: GameState,
  draft: DraftClass,
): DraftClass {
  const pickResults = draft.pickResults.map((pick) => {
    if (pick.immediateGrade) return pick;
    return {
      ...pick,
      immediateGrade: gradePickImmediate(state, pick),
    };
  });
  const teamIds = [
    ...new Set(pickResults.map((p) => p.teamId as string)),
  ] as TeamId[];
  const teamGrades: Record<string, TeamDraftGrade> = {};
  const draftWithPicks = { ...draft, pickResults };
  for (const teamId of teamIds) {
    teamGrades[teamId] = gradeDraftForTeam(state, draftWithPicks, teamId);
  }
  // Also grade teams that made no picks? Plan says every team — empty N/A
  for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
    if (!teamGrades[teamId]) {
      teamGrades[teamId] = gradeDraftForTeam(state, draftWithPicks, teamId);
    }
  }
  return {
    ...draftWithPicks,
    teamGrades,
  };
}

/**
 * Long-term regrade hook — uses actual development, not available at draft time.
 * Framework only; call from future season evaluation.
 */
export function regradePickLongTerm(
  pick: DraftPickResult,
  currentOverall: number,
  seasonsElapsed: number,
): PickGradeSummary {
  const expected =
    ratingRangeMidpoint(pick.scoutingAtSelection.estimatedPotential) -
    Math.max(0, 3 - seasonsElapsed);
  const delta = currentOverall - expected;
  const score = Math.max(40, Math.min(99, 75 + delta));
  return {
    grade: letterFromScore(score),
    explanation:
      delta >= 5
        ? "Exceeded scouting projection."
        : delta <= -5
          ? "Underperformed relative to draft projection."
          : "Developed roughly in line with scouting.",
    needAddressed: pick.immediateGrade?.needAddressed ?? false,
    valueScore: currentOverall,
    riskScore: pick.immediateGrade?.riskScore ?? 0,
  };
}
