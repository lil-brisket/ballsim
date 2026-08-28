import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import { generateOwnershipConfidenceNotifications } from "@/systems/ownership-confidence-notifications";
import {
  processOwnershipConfidence,
  recordOwnershipEvidence,
} from "@/systems/ownership-confidence-engine";
import type { AlignmentEvidence } from "@/domain/entities/ownership-confidence";
import { getActiveOwnedFranchise, withOwnedFranchise } from "@/state/owner-context";

function evidence(
  partial: Partial<AlignmentEvidence> &
    Pick<AlignmentEvidence, "direction" | "significance" | "summary">,
): AlignmentEvidence {
  return {
    id: partial.id ?? `ev_${partial.summary}`,
    occurredOn: partial.occurredOn ?? "2026-11-01",
    kind: partial.kind ?? "posture",
    significance: partial.significance,
    direction: partial.direction,
    summary: partial.summary,
    detail: partial.detail,
    dimension: partial.dimension ?? "overall",
  };
}

describe("ownership confidence notifications", () => {
  it("does not notify on first divergence alone", () => {
    let state = createTestGameState();
    state = recordOwnershipEvidence(
      state,
      evidence({
        direction: "conflicting",
        significance: "meaningful",
        summary: "First miss",
      }),
    );
    const result = generateOwnershipConfidenceNotifications(state, {
      previousMood: "supportive",
      previousConcern: 25,
      reversal: null,
      gapSummary: "Gap",
      postureSummary: "Posture",
    });
    const ownershipTypes = getActiveOwnedFranchise(result.state).notifications.filter((n) =>
      n.type.startsWith("ownership_"),
    );
    // Still supportive → no concern/pressure; confidence only on positive transitions.
    expect(
      ownershipTypes.filter((n) => n.type === "ownership_concern"),
    ).toHaveLength(0);
  });

  it("emits concern only when mood escalates into concerned", () => {
    let state = createTestGameState();
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      ownershipConfidence: {
          ...f.ownershipConfidence,
          mood: "concerned",
          concernLevel: 72,
          recentHurting: ["Traded core talent while contending"],
        },
    }));
    const result = generateOwnershipConfidenceNotifications(state, {
      previousMood: "watchful",
      previousConcern: 50,
      reversal: null,
      gapSummary: "Ownership expects contention, but recent moves suggest a rebuild.",
      postureSummary: "Roster aged up while picks were added.",
    });
    expect(
      getActiveOwnedFranchise(result.state).notifications.some((n) => n.type === "ownership_concern"),
    ).toBe(true);
  });

  it("dedupes concern notifications within a season", () => {
    let state = createTestGameState();
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      ownershipConfidence: {
          ...f.ownershipConfidence,
          mood: "concerned",
          concernLevel: 72,
        },
    }));
    const first = generateOwnershipConfidenceNotifications(state, {
      previousMood: "watchful",
      previousConcern: 50,
      reversal: null,
      gapSummary: "Gap A",
      postureSummary: "Posture",
    });
    const second = generateOwnershipConfidenceNotifications(first.state, {
      previousMood: "watchful",
      previousConcern: 50,
      reversal: null,
      gapSummary: "Gap B",
      postureSummary: "Posture",
    });
    const concerns = getActiveOwnedFranchise(second.state).notifications.filter(
      (n) => n.type === "ownership_concern",
    );
    expect(concerns).toHaveLength(1);
  });

  it("emits confidence notification on recovery into confident", () => {
    let state = createTestGameState();
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      ownershipConfidence: {
          ...f.ownershipConfidence,
          mood: "confident",
          recentHelping: ["Young core improved while keeping flexibility"],
        },
    }));
    const result = generateOwnershipConfidenceNotifications(state, {
      previousMood: "concerned",
      previousConcern: 60,
      reversal: null,
      gapSummary: "Aligned",
      postureSummary: "Young core improved.",
    });
    expect(
      getActiveOwnedFranchise(result.state).notifications.some(
        (n) => n.type === "ownership_confidence",
      ),
    ).toBe(true);
  });

  it("emits direction-change notification for unacknowledged reversals", () => {
    const state = createTestGameState();
    const result = generateOwnershipConfidenceNotifications(state, {
      previousMood: "supportive",
      previousConcern: 25,
      reversal: {
        priorDirection: "youth_focus",
        newDirection: "win_now_roster",
        acknowledged: false,
        summary:
          "We've shifted decisively from development toward immediate contention.",
        occurredOn: state.world.calendar.currentDate,
      },
      gapSummary: "Gap",
      postureSummary: "Posture",
    });
    expect(
      getActiveOwnedFranchise(result.state).notifications.some(
        (n) => n.type === "ownership_direction_change",
      ),
    ).toBe(true);
  });

  it("weekly process does not spam ownership notifications on repeated calls", () => {
    let state = createTestGameState();
    const first = processOwnershipConfidence(state);
    state = first.state;
    // Force another week later.
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: "2026-11-15",
        },
      },
    };
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      ownershipConfidence: {
        ...f.ownershipConfidence,
        lastPostureCheckOn: "2026-11-01",
      },
    }));
    const second = processOwnershipConfidence(state);
    const ownership = getActiveOwnedFranchise(second.state).notifications.filter((n) =>
      n.type.startsWith("ownership_"),
    );
    // At most one of each type for the season in this short window.
    const byType = new Map<string, number>();
    for (const n of ownership) {
      byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    }
    for (const count of byType.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});
