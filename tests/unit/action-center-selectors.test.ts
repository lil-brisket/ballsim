import { describe, expect, it } from "vitest";
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
    expect(team.every((i) => i.category === "roster" || i.relevance === "team")).toBe(
      true,
    );
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
});
