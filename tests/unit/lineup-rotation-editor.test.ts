import { describe, expect, it } from "vitest";
import type { LineupView, RotationView } from "@/state/team-management-selectors";
import {
  cloneEditorState,
  createEditorState,
  findDuplicateAssignments,
  moveBenchToInactive,
  moveInactiveToBench,
  setStarterSlot,
  toSavePayload,
  updateRotationRow,
} from "@/state/lineup-rotation-editor";

function fixture(): { lineup: LineupView; rotation: RotationView } {
  const lineup = {
    teamId: "team_a" as never,
    teamName: "Test",
    city: "Test",
    abbreviation: "TST",
    lastConfiguredBy: "user",
    starters: [
      {
        playerId: "p1" as never,
        firstName: "A",
        lastName: "One",
        position: "PG" as const,
        overall: 80,
        archetypeLabel: "Guard",
        plannedMinutes: 32,
        availabilityLabel: "Available",
        available: true,
        slot: "PG" as const,
        role: "starter" as const,
      },
      {
        playerId: "p2" as never,
        firstName: "B",
        lastName: "Two",
        position: "SG" as const,
        overall: 78,
        archetypeLabel: "Guard",
        plannedMinutes: 30,
        availabilityLabel: "Available",
        available: true,
        slot: "SG" as const,
        role: "starter" as const,
      },
      {
        playerId: "p3" as never,
        firstName: "C",
        lastName: "Three",
        position: "SF" as const,
        overall: 76,
        archetypeLabel: "Wing",
        plannedMinutes: 28,
        availabilityLabel: "Available",
        available: true,
        slot: "SF" as const,
        role: "starter" as const,
      },
      {
        playerId: "p4" as never,
        firstName: "D",
        lastName: "Four",
        position: "PF" as const,
        overall: 74,
        archetypeLabel: "Big",
        plannedMinutes: 28,
        availabilityLabel: "Available",
        available: true,
        slot: "PF" as const,
        role: "starter" as const,
      },
      {
        playerId: "p5" as never,
        firstName: "E",
        lastName: "Five",
        position: "C" as const,
        overall: 72,
        archetypeLabel: "Big",
        plannedMinutes: 26,
        availabilityLabel: "Available",
        available: true,
        slot: "C" as const,
        role: "starter" as const,
      },
    ],
    bench: [
      {
        playerId: "p6" as never,
        firstName: "F",
        lastName: "Six",
        position: "SG" as const,
        overall: 70,
        archetypeLabel: "Guard",
        plannedMinutes: 18,
        availabilityLabel: "Available",
        available: true,
        role: "bench" as const,
      },
      {
        playerId: "p7" as never,
        firstName: "G",
        lastName: "Seven",
        position: "PF" as const,
        overall: 68,
        archetypeLabel: "Big",
        plannedMinutes: 12,
        availabilityLabel: "Available",
        available: true,
        role: "bench" as const,
      },
    ],
    inactive: [
      {
        playerId: "p8" as never,
        firstName: "H",
        lastName: "Eight",
        position: "C" as const,
        overall: 60,
        archetypeLabel: "Big",
        plannedMinutes: 0,
        availabilityLabel: "Available",
        available: true,
        role: "inactive" as const,
      },
    ],
  } satisfies LineupView;

  const row = (
    id: string,
    first: string,
    last: string,
    pos: string,
    role: string,
    group: string,
    minutes: number,
  ) => ({
    playerId: id as never,
    firstName: first,
    lastName: last,
    position: pos as never,
    age: 25,
    overall: 70,
    teamName: "Test",
    role: group,
    rotationRole: role,
    rotationStatus: group === "inactive" ? "inactive" : "active",
    plannedMinutes: minutes,
    targetMinutes: minutes,
    projectedMinutes: minutes,
    minimumMinutes: 0,
    normalMaximumMinutes: 36,
    absoluteMaximumMinutes: 42,
    rotationPriority: 3,
    minutePriorityBias: 0,
    overrideMedicalRecommendation: false,
    actualMinutes: 0,
    eligiblePositions: [pos as never],
    preferredPositions: [pos as never],
    secondaryPositions: [] as never[],
    availabilityStatus: "available",
    availabilityLabel: "Available",
    available: true,
    injuryLabel: null,
    injuryType: null,
    injurySeverity: null,
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: null,
    gamesRemaining: null,
    isLegacyUndisclosed: false,
    workloadWarning: null,
    seasonStats: null,
  });

  const rotation = {
    teamId: "team_a" as never,
    teamName: "Test",
    rows: [
      row("p1", "A", "One", "PG", "starter", "starter", 32),
      row("p2", "B", "Two", "SG", "starter", "starter", 30),
      row("p3", "C", "Three", "SF", "starter", "starter", 28),
      row("p4", "D", "Four", "PF", "starter", "starter", 28),
      row("p5", "E", "Five", "C", "starter", "starter", 26),
      row("p6", "F", "Six", "SG", "sixth_man", "bench", 18),
      row("p7", "G", "Seven", "PF", "bench", "bench", 12),
      row("p8", "H", "Eight", "C", "bench", "inactive", 0),
    ],
    totalPlanned: 174,
    target: 240,
    delta: -66,
    plannedValid: false,
    feedback: [],
    health: {
      level: "warning",
      totalMinutes: 174,
      targetMinutes: 240,
      balanceLabel: "Under",
      rosterSize: 8,
      availableCount: 8,
      rotationTargetCount: 9,
      meaningfulPlayerCount: 7,
      availabilitySummary: "8 available",
      summaryLine: "174 / 240 MIN",
      issues: [],
      positionCoverage: [],
      workloadWarnings: [],
      replacementRecommendations: [],
    },
    rotationStyle: "balanced",
    rotationPhilosophy: "balanced",
    rotationDepth: 12,
    rotationPreset: "balanced",
    closingLineupPolicy: "auto",
    closingLineupIds: [],
    feasibilityBanner: null,
    previewBands: [],
  } satisfies RotationView;

  return { lineup, rotation };
}

describe("lineup-rotation-editor", () => {
  it("starter change keeps assignments consistent and moves previous to bench", () => {
    const { lineup, rotation } = fixture();
    const state = createEditorState(lineup, rotation);
    const next = setStarterSlot(state, "PG", "p6");
    expect(next.starters.find((s) => s.slot === "PG")?.playerId).toBe("p6");
    expect(next.bench).toContain("p1");
    expect(next.bench).not.toContain("p6");
    expect(findDuplicateAssignments(next)).toEqual([]);
    const p6 = next.rows.find((r) => r.playerId === "p6");
    expect(p6?.groupRole).toBe("starter");
    expect(p6?.role).toBe("starter");
  });

  it("no player occupies multiple groups after moves", () => {
    const { lineup, rotation } = fixture();
    let state = createEditorState(lineup, rotation);
    state = moveBenchToInactive(state, "p7");
    state = moveInactiveToBench(state, "p8");
    expect(findDuplicateAssignments(state)).toEqual([]);
    expect(state.inactive).toContain("p7");
    expect(state.bench).toContain("p8");
    expect(state.inactive).not.toContain("p8");
  });

  it("inactive players cannot have minutes in local state", () => {
    const { lineup, rotation } = fixture();
    let state = createEditorState(lineup, rotation);
    state = moveBenchToInactive(state, "p6");
    const row = state.rows.find((r) => r.playerId === "p6");
    expect(row?.targetMinutes).toBe(0);
    state = updateRotationRow(state, "p6", { targetMinutes: 20 });
    expect(
      state.rows.find((r) => r.playerId === "p6")?.targetMinutes,
    ).toBe(0);
    const payload = toSavePayload(state);
    expect(payload.rotation.some((e) => e.playerId === "p6")).toBe(false);
    expect(payload.inactive).toContain("p6");
  });

  it("undo snapshot only changes local state representation", () => {
    const { lineup, rotation } = fixture();
    const initial = createEditorState(lineup, rotation);
    const snapshot = cloneEditorState(initial);
    const edited = setStarterSlot(initial, "SG", "p6");
    expect(edited.starters.find((s) => s.slot === "SG")?.playerId).toBe("p6");
    const restored = cloneEditorState(snapshot);
    expect(restored.starters.find((s) => s.slot === "SG")?.playerId).toBe("p2");
    expect(JSON.stringify(toSavePayload(restored))).toBe(
      JSON.stringify(toSavePayload(initial)),
    );
  });
});
