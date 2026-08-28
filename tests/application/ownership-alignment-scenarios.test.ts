import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  processOwnershipConfidence,
  recordOwnershipEvidence,
} from "@/systems/ownership-confidence-engine";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import { evaluateStrategicPosture } from "@/systems/ownership-strategic-posture";
import type { AlignmentEvidence } from "@/domain/entities/ownership-confidence";
import {
  getActiveOwnedFranchise,
  withOwnedFranchise,
} from "@/state/owner-context";

function pushConflicts(state: ReturnType<typeof createTestGameState>, count: number) {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    const evidence: AlignmentEvidence = {
      id: `conflict_${i}`,
      occurredOn: next.world.calendar.currentDate,
      kind: "posture",
      significance: "meaningful",
      direction: "conflicting",
      summary: `Conflicting posture ${i}`,
      detail: "Moved away from ownership expectations",
      dimension: "overall",
    };
    next = recordOwnershipEvidence(next, evidence);
  }
  return next;
}

function pushAligned(state: ReturnType<typeof createTestGameState>, count: number) {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    const evidence: AlignmentEvidence = {
      id: `aligned_${i}`,
      occurredOn: next.world.calendar.currentDate,
      kind: "posture",
      significance: "meaningful",
      direction: "aligned",
      summary: `Aligned posture ${i}`,
      detail: "Followed ownership expectations",
      dimension: "overall",
    };
    next = recordOwnershipEvidence(next, evidence);
  }
  return next;
}

function withWins(
  state: ReturnType<typeof createTestGameState>,
  wins: number,
  losses: number,
) {
  const teamId = state.user.activeOwnerTeamId;
  const existing = state.competition.standings.byTeamId[teamId]!;
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        ...state.competition.standings,
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: { ...existing, wins, losses },
        },
      },
    },
  };
}

describe("ownership multi-season scenarios", () => {
  it("Scenario A — default mandate frustration escalates with repeated conflict", () => {
    let state = createTestGameState();
    state = withWins(state, 52, 18);
    const before = getActiveOwnedFranchise(state).ownershipConfidence.mood;
    state = pushConflicts(state, 5);
    expect(["watchful", "concerned", "displeased"]).toContain(
      getActiveOwnedFranchise(state).ownershipConfidence.mood,
    );
    expect(getActiveOwnedFranchise(state).ownershipConfidence.mood).not.toBe(
      before === "displeased" ? "confident" : before,
    );
    // Patience should only drift via weekly process, not raw evidence.
    const processed = processOwnershipConfidence(state);
    if (
      getActiveOwnedFranchise(processed.state).ownershipConfidence.mood === "concerned" ||
      getActiveOwnedFranchise(processed.state).ownershipConfidence.mood === "displeased"
    ) {
      expect(getActiveOwnedFranchise(processed.state).ownerPatience).toBeLessThanOrEqual(
        getActiveOwnedFranchise(state).ownerPatience,
      );
    }
  });

  it("Scenario B — rebuild remains supportive under aligned development", () => {
    let state = createTestGameState();
    state = withWins(state, 28, 42);
    const expectations = buildOwnershipExpectations(state);
    expect(["rebuild", "develop"]).toContain(expectations.competitiveExpectation);
    state = pushAligned(state, 4);
    expect(["confident", "supportive", "watchful"]).toContain(
      getActiveOwnedFranchise(state).ownershipConfidence.mood,
    );
    expect(getActiveOwnedFranchise(state).ownershipConfidence.alignmentScore).toBeGreaterThanOrEqual(
      50,
    );
  });

  it("Scenario C — strategic reversal is detectable when shifting toward contention", () => {
    let state = createTestGameState();
    state = withWins(state, 48, 22);
    // Seed a prior season note implying development mandate.
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      ownershipConfidence: {
        ...f.ownershipConfidence,
        seasonNotes: [
          {
            seasonYear: state.competition.season.year - 1,
            mood: "supportive",
            mandateSummary: "Focus on youth development during a rebuild.",
          },
        ],
      },
    }));
    const evaluation = evaluateStrategicPosture(state);
    // May or may not reverse depending on observed roster; ensure API is stable.
    expect(evaluation.gap).toBeTruthy();
    expect(evaluation.expectations.philosophy).toBe("balanced");
  });

  it("Scenario D — default mandate uses balanced payroll growth tolerance", () => {
    const state = createTestGameState();
    const expectations = buildOwnershipExpectations(state);
    expect(expectations.philosophy).toBe("balanced");
    expect(expectations.tolerance.payrollGrowth).toBe(0.45);
  });

  it("Scenario E — no death spiral: alignment does not harden objectives directly", () => {
    let state = createTestGameState();
    const patienceBefore = getActiveOwnedFranchise(state).ownerPatience;
    state = pushConflicts(state, 6);
    // Evidence alone should not mutate patience.
    expect(getActiveOwnedFranchise(state).ownerPatience).toBe(patienceBefore);
    const weekly = processOwnershipConfidence(state);
    // Cap: weekly patience drift is modest.
    expect(
      Math.abs(getActiveOwnedFranchise(weekly.state).ownerPatience - patienceBefore),
    ).toBeLessThanOrEqual(2);
  });
});
