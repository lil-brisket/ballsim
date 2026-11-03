import { describe, expect, it } from "vitest";
import { advanceBlockedReason } from "@/systems/participation";
import { createTestGameState } from "../factories/game-state";
import {
  buildActionCenterView,
  filterDomainDecisions,
  filterTeamDecisions,
  mapOwnerActionToCenterItem,
} from "@/state/action-center-selectors";
import type { OwnerDashboardActionItem } from "@/state/owner-dashboard";
import type { PhaseResponsibility } from "@/systems/simulation/phase-responsibility";

function action(
  partial: Partial<OwnerDashboardActionItem> &
    Pick<OwnerDashboardActionItem, "id" | "category" | "severity" | "title">,
): OwnerDashboardActionItem {
  return {
    what: partial.what ?? partial.title,
    why: partial.why ?? "Because",
    evidence: partial.evidence ?? [],
    href: partial.href ?? "/dashboard/s1",
    hrefLabel: partial.hrefLabel ?? "Open",
    ...partial,
  };
}

describe("action-center-selectors", () => {
  it("maps severity and derives urgency", () => {
    const item = mapOwnerActionToCenterItem(
      action({
        id: "a1",
        category: "roster",
        severity: "critical",
        title: "Injury",
      }),
      "2026-09-08",
    );
    expect(item.urgency).toBe("immediate");
    expect(item.relevance).toBe("team");
  });

  it("prioritizes deadline before undated critical of lower category priority", () => {
    const view = buildActionCenterView({
      actionItems: [
        action({
          id: "info-late",
          category: "marketing",
          severity: "info",
          title: "Marketing",
        }),
        action({
          id: "deadline",
          category: "calendar",
          severity: "warning",
          title: "Trade deadline",
          evidence: ["Deadline 2026-09-10"],
        }),
        action({
          id: "roster",
          category: "roster",
          severity: "critical",
          title: "Roster hole",
        }),
      ],
      currentDate: "2026-09-08",
      saveId: "s1",
    });
    expect(view.items[0]?.id).toBe("deadline");
    expect(view.hasUrgentActions).toBe(true);
    expect(view.focalMode).toBe("actions");
  });

  it("uses next-game focal mode when no urgent actions", () => {
    const view = buildActionCenterView({
      actionItems: [
        action({
          id: "i1",
          category: "notifications",
          severity: "info",
          title: "FYI",
        }),
      ],
      currentDate: "2026-09-08",
      saveId: "s1",
    });
    expect(view.focalMode).toBe("next-game");
    expect(view.hasUrgentActions).toBe(false);
  });

  it("includes phase unresolved items and caps results", () => {
    const responsibility: PhaseResponsibility = {
      phaseKey: "regular_season",
      owner: "unresolved",
      unresolvedCount: 1,
      unresolvedItems: [
        {
          id: "u1",
          domain: "draft",
          severity: "critical",
          title: "Draft pick",
          detail: "On the clock",
        },
      ],
    };
    const many = Array.from({ length: 10 }, (_, i) =>
      action({
        id: `n${i}`,
        category: "notifications",
        severity: "info",
        title: `Note ${i}`,
      }),
    );
    const view = buildActionCenterView({
      actionItems: many,
      phaseResponsibility: responsibility,
      currentDate: "2026-09-08",
      saveId: "s1",
      cap: 5,
    });
    expect(view.items.length).toBeLessThanOrEqual(5);
    expect(view.items.some((i) => i.id === "phase-u1")).toBe(true);
  });

  it("flags only the unresolved draft clock as blocking and merges its twin", () => {
    const view = buildActionCenterView({
      actionItems: [
        action({
          id: "action_draft",
          category: "draft",
          severity: "critical",
          title: "Draft clock",
        }),
        action({
          id: "action_attendance",
          category: "attendance",
          severity: "warning",
          title: "Attendance concern",
        }),
      ],
      phaseResponsibility: {
        phaseKey: "draft",
        owner: "unresolved",
        unresolvedCount: 1,
        unresolvedItems: [
          {
            id: "draft_clock",
            domain: "draft",
            severity: "critical",
            title: "On the clock",
            detail: "Make your pick",
          },
        ],
      },
      currentDate: "2026-06-20",
      saveId: "s1",
    });
    const draft = view.items.filter((i) => i.dedupeKey === "draft_clock");
    expect(draft).toHaveLength(1);
    expect(draft[0]!.blocksAdvance).toBe(true);
    expect(
      view.items.find((i) => i.id === "action_attendance")!.blocksAdvance,
    ).toBe(false);
    expect(view.blockingCount).toBe(1);
    expect(view.urgentCount).toBe(2);
  });

  it("does not block when the draft clock has no unresolved phase item", () => {
    const view = buildActionCenterView({
      actionItems: [
        action({
          id: "action_draft",
          category: "draft",
          severity: "critical",
          title: "Draft clock",
        }),
      ],
      currentDate: "2026-06-20",
      saveId: "s1",
    });
    expect(view.blockingCount).toBe(0);
    expect(view.items[0]!.blocksAdvance).toBe(false);
  });

  it("collapses staff and injury duplicates and counts before the cap", () => {
    const view = buildActionCenterView({
      actionItems: [
        action({
          id: "action_staff",
          category: "staff",
          severity: "warning",
          title: "Staff",
        }),
        action({
          id: "action_roster",
          category: "roster",
          severity: "warning",
          title: "Injuries",
        }),
        ...Array.from({ length: 6 }, (_, i) =>
          action({
            id: `w${i}`,
            category: "team",
            severity: "warning",
            title: `W${i}`,
          }),
        ),
      ],
      phaseResponsibility: {
        phaseKey: "regular_season",
        owner: "unresolved",
        unresolvedCount: 2,
        unresolvedItems: [
          {
            id: "staff_gap_head_coach",
            domain: "staffHiring",
            severity: "warning",
            title: "Coach",
            detail: "d",
          },
          {
            id: "injured_in_rotation",
            domain: "lineup",
            severity: "warning",
            title: "Hurt",
            detail: "d",
          },
        ],
      } as PhaseResponsibility,
      currentDate: "2026-09-08",
      saveId: "s1",
      cap: 5,
    });
    expect(view.items.length).toBe(5);
    expect(view.urgentCount).toBe(8);
    expect(view.items.filter((i) => i.dedupeKey === "staff_gap")).toHaveLength(
      1,
    );
    expect(view.items.filter((i) => i.dedupeKey === "injuries")).toHaveLength(
      1,
    );
  });

  it("filters team decisions without duplicating full action center shape", () => {
    const view = buildActionCenterView({
      actionItems: [
        action({
          id: "r1",
          category: "roster",
          severity: "warning",
          title: "Rotation",
        }),
        action({
          id: "m1",
          category: "marketing",
          severity: "warning",
          title: "Ads",
        }),
      ],
      currentDate: "2026-09-08",
      saveId: "s1",
    });
    const team = filterTeamDecisions(view.items);
    expect(
      team.every((i) => i.category === "roster" || i.relevance === "team"),
    ).toBe(true);
    expect(team.some((i) => i.id === "r1")).toBe(true);
  });

  it("filters domain decisions by category and sorts by urgency then deadline", () => {
    const view = buildActionCenterView({
      actionItems: [
        action({
          id: "c_late",
          category: "contracts",
          severity: "info",
          title: "Later",
          evidence: ["Due 2026-09-20"],
        }),
        action({
          id: "c_soon",
          category: "contracts",
          severity: "warning",
          title: "Soon",
          evidence: ["Due 2026-09-10"],
        }),
        action({
          id: "staff1",
          category: "staff",
          severity: "critical",
          title: "Hire",
        }),
      ],
      currentDate: "2026-09-08",
      saveId: "s1",
    });
    const contracts = filterDomainDecisions(view.items, ["contracts"], 5);
    expect(contracts).toHaveLength(2);
    expect(contracts[0]!.id).toBe("c_soon");
    expect(contracts[1]!.id).toBe("c_late");
  });

  describe("parity with the participation advance gate", () => {
    function shared(assignmentsConfirmed: boolean) {
      const state = createTestGameState();
      return {
        ...state,
        user: {
          ...state.user,
          participation: {
            mode: "local_shared" as const,
            participants: [
              {
                id: "p1",
                displayName: "Alex",
                teamIds: [state.user.activeOwnerTeamId],
                isHost: true,
                plannedTeamCount: 1,
              },
            ],
            activeParticipantId: "p1",
            readyParticipantIds: [],
            assignmentsConfirmed,
          },
        },
      };
    }

    it("blocks exactly when advanceBlockedReason says so", () => {
      for (const confirmed of [false, true]) {
        const state = shared(confirmed);
        const reason = advanceBlockedReason(state);
        const view = buildActionCenterView({
          actionItems: [],
          currentDate: "2026-09-08",
          saveId: "s1",
          participationBlockedReason: reason,
        });
        expect(view.blockingCount > 0).toBe(reason !== null);
      }
    });

    it("shows the reason on a critical blocking item", () => {
      const reason = advanceBlockedReason(shared(false));
      const view = buildActionCenterView({
        actionItems: [],
        currentDate: "2026-09-08",
        saveId: "s1",
        participationBlockedReason: reason,
      });
      expect(view.items[0]).toMatchObject({
        id: "participation_gate",
        severity: "critical",
        blocksAdvance: true,
        description: reason,
      });
    });
  });
});
