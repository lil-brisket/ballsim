import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  createSaveAction: vi.fn(),
}));

import { GameSetupForm } from "@/components/owner/GameSetupForm";

describe("GameSetupForm", () => {
  it("starts with an editable custom league configuration", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    expect(screen.getByRole("heading", { name: "League" })).toBeTruthy();
    expect(screen.getByLabelText("Number of teams")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Custom league" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Standard template — 30 / 82 / 16" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "CBL template — 12 / 22 / 8" }),
    ).toBeTruthy();
    unmount();
  });

  it("reveals fantasy draft position and randomizer controls", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.change(screen.getByLabelText("Startup draft"), {
      target: { value: "1" },
    });

    expect(screen.getByLabelText("Your draft position")).toBeTruthy();
    expect(screen.getByLabelText("Randomize my draft position")).toBeTruthy();
    unmount();
  });

  it("shows AI team management delegation cards instead of presets", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    expect(
      screen.getByRole("heading", { name: "AI Team Management" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: /Injuries & Emergency Roster/ }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Team management assistance")).toBeNull();
    expect(
      screen.queryByText(/Custom — configure individual phases/),
    ).toBeNull();

    unmount();
  });
});
