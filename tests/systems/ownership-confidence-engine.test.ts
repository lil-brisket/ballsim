import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deriveAlignmentScore,
  processOwnershipConfidence,
  recordOwnershipEvidence,
  resolveMood,
} from "@/systems/ownership-confidence-engine";
import { evaluateStrategicPosture } from "@/systems/ownership-strategic-posture";
import type { AlignmentEvidence } from "@/domain/entities/ownership-confidence";
import { createDefaultOwnershipConfidence } from "@/domain/entities/ownership-confidence";
import { getActiveOwnedFranchise } from "@/state/owner-context";

function evidence(
  partial: Partial<AlignmentEvidence> &
    Pick<AlignmentEvidence, "direction" | "significance" | "summary">,
): AlignmentEvidence {
  return {
    id: partial.id ?? `ev_${partial.summary}`,
    occurredOn: partial.occurredOn ?? "2026-11-01",
    kind: partial.kind ?? "decision",
    significance: partial.significance,
    direction: partial.direction,
    summary: partial.summary,
    detail: partial.detail,
    dimension: partial.dimension ?? "overall",
  };
}

describe("ownership confidence engine", () => {
  it("ignores minor decision evidence for mood movement", () => {
    const state = createTestGameState();
    const before = getActiveOwnedFranchise(state).ownershipConfidence.mood;
    const next = recordOwnershipEvidence(
      state,
      evidence({
        direction: "conflicting",
        significance: "minor",
        summary: "Tiny move",
      }),
    );
    expect(getActiveOwnedFranchise(next).ownershipConfidence.mood).toBe(before);
    expect(getActiveOwnedFranchise(next).ownershipConfidence.recentEvidence).toHaveLength(1);
  });

  it("does not jump to displeased from a single conflicting decision", () => {
    let state = createTestGameState();
    state = recordOwnershipEvidence(
      state,
      evidence({
        direction: "conflicting",
        significance: "meaningful",
        summary: "One bad trade",
        kind: "decision",
      }),
    );
    expect(getActiveOwnedFranchise(state).ownershipConfidence.mood).not.toBe("displeased");
  });

  it("escalates mood after repeated conflicting meaningful evidence", () => {
    let state = createTestGameState();
    for (let i = 0; i < 5; i += 1) {
      state = recordOwnershipEvidence(
        state,
        evidence({
          id: `bad_${i}`,
          direction: "conflicting",
          significance: "meaningful",
          summary: `Conflict ${i}`,
          kind: "posture",
        }),
      );
    }
    expect(["watchful", "concerned", "displeased"]).toContain(
      getActiveOwnedFranchise(state).ownershipConfidence.mood,
    );
  });

  it("weights posture evidence more heavily than decisions in alignment score", () => {
    const decisionHeavy = deriveAlignmentScore([
      evidence({
        direction: "conflicting",
        significance: "meaningful",
        summary: "d1",
        kind: "decision",
      }),
      evidence({
        id: "d2",
        direction: "conflicting",
        significance: "meaningful",
        summary: "d2",
        kind: "decision",
      }),
    ]);
    const postureAligned = deriveAlignmentScore([
      evidence({
        direction: "conflicting",
        significance: "meaningful",
        summary: "d1",
        kind: "decision",
      }),
      evidence({
        id: "p1",
        direction: "aligned",
        significance: "meaningful",
        summary: "p1",
        kind: "posture",
      }),
    ]);
    expect(postureAligned).toBeGreaterThan(decisionHeavy);
  });

  it("resolveMood requires patterns before displeased", () => {
    expect(
      resolveMood("supportive", 40, [
        evidence({
          direction: "conflicting",
          significance: "meaningful",
          summary: "one",
        }),
      ], false),
    ).not.toBe("displeased");
  });

  it("processOwnershipConfidence is idempotent within seven days", () => {
    const state = createTestGameState();
    const first = processOwnershipConfidence(state);
    expect(first.postureRan).toBe(true);
    const second = processOwnershipConfidence(first.state);
    expect(second.postureRan).toBe(false);
  });

  it("evaluateStrategicPosture produces expectation vs reality summary", () => {
    const state = createTestGameState();
    const evaluation = evaluateStrategicPosture(state);
    expect(evaluation.gap.summary.length).toBeGreaterThan(10);
    expect(evaluation.expectations.mandateSummary.length).toBeGreaterThan(5);
    expect(evaluation.evidence.length).toBeGreaterThan(0);
  });

  it("defaults ownership confidence on fresh saves", () => {
    const confidence = createDefaultOwnershipConfidence("2026-10-01");
    expect(confidence.mood).toBe("supportive");
    expect(confidence.recentEvidence).toEqual([]);
  });
});
