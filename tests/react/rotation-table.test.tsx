import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RotationTable } from "@/components/team-management/RotationTable";
import type { EditableRotationRow } from "@/state/lineup-rotation-editor";

afterEach(cleanup);

function row(
  playerId: string,
  lastName: string,
  role: string,
  groupRole: string,
  targetMinutes: number,
): EditableRotationRow {
  return {
    playerId,
    targetMinutes,
    rotationPriority: 1,
    rotationStatus: groupRole === "inactive" ? "inactive" : "active",
    role,
    preferredPositions: [],
    secondaryPositions: [],
    minutePriorityBias: 0,
    overrideMedicalRecommendation: false,
    groupRole,
    firstName: "Test",
    lastName,
    position: "SF",
    actualMinutes: 0,
    projectedMinutes: targetMinutes,
    availabilityStatus: "available",
    availabilityLabel: "Available",
  };
}

describe("RotationTable", () => {
  it("shows every player in one table without priority, usage or sort controls", () => {
    render(
      <RotationTable
        teamName="Test"
        onUpdate={vi.fn()}
        rows={[
          row("p3", "Bench", "bench", "bench", 12),
          row("p4", "Out", "bench", "inactive", 0),
          row("p1", "Starter", "starter", "starter", 34),
          row("p2", "Sixth", "sixth_man", "bench", 24),
        ]}
      />,
    );

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(1);
    const headers = within(tables[0]!)
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    expect(headers).toEqual(["Player", "Pos", "Role", "Target MPG", "Status"]);
    expect(screen.queryByText("Core rotation")).toBeNull();
    expect(screen.queryByText("Depth")).toBeNull();
    expect(screen.queryByText("Sort by")).toBeNull();
    expect(screen.queryByText("Projected Rotation")).toBeNull();

    const names = within(tables[0]!)
      .getAllByRole("row")
      .slice(1)
      .map((tr) => within(tr).getAllByRole("cell")[0]!.textContent);
    expect(names).toEqual([
      "Test Starter",
      "Test Sixth",
      "Test Bench",
      "Test Out",
    ]);
  });
});
