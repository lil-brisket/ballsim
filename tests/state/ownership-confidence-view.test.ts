import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import { toOwnerCareerEvaluation } from "@/state/owner-career-evaluation";
import { toOwnershipConfidenceView } from "@/state/ownership-confidence-view";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { recordOwnershipEvidence } from "@/systems/ownership-confidence-engine";
import type { AlignmentEvidence } from "@/domain/entities/ownership-confidence";

describe("owner career evaluation with ownership confidence", () => {
  it("blends objective and strategic alignment without overriding performance", () => {
    const state = createTestGameState();
    const evaluation = toOwnerCareerEvaluation(state);
    expect(evaluation.objectiveAlignmentScore).toBeTypeOf("number");
    expect(evaluation.strategicAlignmentScore).toBeTypeOf("number");
    expect(evaluation.alignmentScore).toBe(
      Math.round(
        evaluation.objectiveAlignmentScore * 0.6 +
          evaluation.strategicAlignmentScore * 0.4,
      ),
    );
  });

  it("reflects lower strategic alignment when confidence is poor", () => {
    let state = createTestGameState();
    state = {
      ...state,
      user: {
        ...state.user,
        ownershipConfidence: {
          ...state.user.ownershipConfidence,
          alignmentScore: 25,
          mood: "displeased",
        },
      },
    };
    const evaluation = toOwnerCareerEvaluation(state);
    expect(evaluation.strategicAlignmentScore).toBe(25);
    expect(evaluation.alignmentScore).toBeLessThan(50);
  });
});

describe("ownership confidence view", () => {
  it("leads with expectations and exposes why helpers", () => {
    let state = createTestGameState();
    const evidence: AlignmentEvidence = {
      id: "ev1",
      occurredOn: state.world.calendar.currentDate,
      kind: "decision",
      significance: "meaningful",
      direction: "aligned",
      summary: "Retained core player",
      detail: "Kept a young core player",
      dimension: "roster",
    };
    state = recordOwnershipEvidence(state, evidence);
    const view = toOwnershipConfidenceView(state);
    expect(view.mandateSummary.length).toBeGreaterThan(5);
    expect(view.moodLabel.length).toBeGreaterThan(0);
    expect(view.alignmentScore).toBeGreaterThanOrEqual(0);
    expect(view.whyHelping.length).toBeGreaterThan(0);
  });

  it("includes ownership section on the owner dashboard", () => {
    const state = createTestGameState();
    const dashboard = toOwnerDashboardView(state);
    expect(dashboard.owner.ownership.mandateSummary.length).toBeGreaterThan(0);
    expect(dashboard.owner.ownership.mood).toBeTruthy();
  });
});
