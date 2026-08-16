import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { OwnerSavePreview } from "@/application/game-service";
import { OwnerEntryActions } from "@/components/game/OwnerEntryActions";

vi.mock("@/application/actions", () => ({
  openSaveAction: vi.fn(),
}));

function validSave(
  overrides: Partial<OwnerSavePreview & { ok: true }> = {},
): OwnerSavePreview & { ok: true } {
  return {
    ok: true,
    id: "save_1",
    name: "Harbor Franchise",
    updatedAt: new Date("2026-08-15T12:00:00.000Z"),
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    mode: "owner",
    controlledTeam: {
      id: "team_1",
      city: "Toronto",
      name: "Huskies",
      abbreviation: "TOR",
    },
    seasonYear: 2028,
    currentDate: "2029-01-15",
    seasonPhase: "regular",
    teamSelectionLocked: true,
    ...overrides,
  };
}

describe("OwnerEntryActions", () => {
  it("shows continue for latest owner save and new game href", () => {
    const { unmount } = render(
      <OwnerEntryActions
        continueSave={validSave()}
        hasAnySaves
        atSaveLimit={false}
        maxSaveSlots={10}
        newGameHref="/new/setup?mode=owner"
      />,
    );
    expect(screen.getByText("Toronto Huskies")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Continue/i })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Load Save/i }).getAttribute("href"),
    ).toBe("/saves?mode=owner");
    expect(
      screen.getByRole("link", { name: /New Game/i }).getAttribute("href"),
    ).toBe("/new/setup?mode=owner");
    unmount();
  });

  it("shows empty state without a dead continue control", () => {
    const { unmount } = render(
      <OwnerEntryActions
        continueSave={null}
        hasAnySaves={false}
        atSaveLimit={false}
        maxSaveSlots={10}
        newGameHref="/new/setup?mode=owner"
      />,
    );
    expect(screen.getByText(/No Owner saves yet/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue/i })).toBeNull();
    expect(screen.getByText(/No saves available/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Start New Game/i }).getAttribute("href"),
    ).toBe("/new/setup?mode=owner");
    unmount();
  });

  it("blocks new game at save limit while keep continue and load", () => {
    const { unmount } = render(
      <OwnerEntryActions
        continueSave={validSave()}
        hasAnySaves
        atSaveLimit
        maxSaveSlots={10}
        newGameHref="/new/setup?mode=owner"
      />,
    );
    expect(screen.getByRole("button", { name: /Continue/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Load Save/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^New Game/i })).toBeNull();
    expect(screen.getByText(/At most 10 saves are allowed/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Manage Saves/i }).getAttribute("href"),
    ).toBe("/saves?mode=owner");
    unmount();
  });
});
