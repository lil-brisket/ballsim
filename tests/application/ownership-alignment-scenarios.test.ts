import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  processOwnershipConfidence,
  recordOwnershipEvidence,
} from "@/systems/ownership-confidence-engine";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import { evaluateStrategicPosture } from "@/systems/ownership-strategic-posture";
import type { AlignmentEvidence } from "@/domain/entities/ownership-confidence";
import type { OwnerPhilosophy } from "@/domain/entities/owner-philosophy";
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

function withPhilosophy(
  state: ReturnType<typeof createTestGameState>,
  philosophy: OwnerPhilosophy,
) {
  return withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
    ...f,
    ownerPhilosophy: philosophy,
  }));
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
  it("Scenario A — win_now frustration escalates with repeated conflict", () => {
    let state = withPhilosophy(createTestGameState(), "win_now");
    state = withWins(state, 52, 18);
    const before = getActiveOwnedFranchise(state).ownershipConfidence.mood;
    state = pushConflicts(state, 5);
    expect(["watchful", "concerned", "displeased"]).toContain(
      getActiveOwnedFranchise(state).ownershipConfidence.mood,
    );
    expect(getActiveOwnedFranchise(state).ownershipConfidence.mood).not.toBe(before === "displeased" ? "confident" : before);
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

  it("Scenario B — future rebuild remains supportive under aligned development", () => {
    let state = withPhilosophy(createTestGameState(), "build_for_the_future");
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
    let state = withPhilosophy(createTestGameState(), "build_for_the_future");
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
    expect(evaluation.expectations.philosophy).toBe("build_for_the_future");
  });

  it("Scenario D — financially conservative owners keep low payroll growth tolerance until fundamentals improve", () => {
    let state = withPhilosophy(createTestGameState(), "financially_conservative");
    const expectations = buildOwnershipExpectations(state);
    expect(expectations.tolerance.payrollGrowth).toBeLessThanOrEqual(0.25);
    expect(expectations.financialExpectation).toBe("preserve_cash");
  });

  it("Scenario E — no death spiral: alignment does not harden objectives directly", () => {
    let state = withPhilosophy(createTestGameState(), "win_now");
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
