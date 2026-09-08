import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionCenter } from "@/components/action-center/ActionCenter";
import type { ActionCenterView } from "@/state/action-center-selectors";

describe("ActionCenter", () => {
  it("shows all-clear empty state", () => {
    const view: ActionCenterView = {
      items: [],
      hasUrgentActions: false,
      focalMode: "next-game",
      urgentCount: 0,
    };
    render(
      <ActionCenter view={view} saveId="s1" returnPath="/dashboard/s1" />,
    );
    expect(screen.getByText(/good shape/i)).toBeTruthy();
  });

  it("elevates urgent actions in actions focal mode", () => {
    const view: ActionCenterView = {
      items: [
        {
          id: "a1",
          priority: 1,
          severity: "critical",
          category: "roster",
          urgency: "immediate",
          deadline: null,
          relevance: "team",
          title: "Injury requires rotation change",
          description: "Starter is out",
          href: "/dashboard/s1/team-management/rotations",
          hrefLabel: "Review Rotation",
        },
      ],
      hasUrgentActions: true,
      focalMode: "actions",
      urgentCount: 1,
    };
    render(
      <ActionCenter view={view} saveId="s1" returnPath="/dashboard/s1" />,
    );
    expect(screen.getByText(/1 action need attention/i)).toBeTruthy();
    expect(
      screen.getByText("Injury requires rotation change"),
    ).toBeTruthy();
  });
});
