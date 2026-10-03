import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  createSaveAction: vi.fn(),
}));

import { GameSetupForm } from "@/components/owner/GameSetupForm";
import { makeFullRosterPackage } from "../helpers/custom-content";

describe("GameSetupForm", () => {
  it("starts with an editable custom league configuration", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    expect(screen.getByRole("heading", { name: "League" })).toBeTruthy();
    expect(screen.getByLabelText("Number of teams")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Custom league" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Standard template — 30 / 82 / 16" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "CBL template — 12 / 22 / 8" }),
    ).toBeTruthy();
    unmount();
  });

  it("shows fantasy draft deferred-setup message", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.change(screen.getByLabelText("Roster source"), {
      target: { value: "1" },
    });

    expect(
      screen.getByText(/configured after you choose your franchises/i),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Your draft position")).toBeNull();
    unmount();
  });

  it("shows roster source before league size", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    const rosterSource = screen.getByLabelText("Roster source");
    const teamCount = screen.getByLabelText("Number of teams");
    expect(
      rosterSource.compareDocumentPosition(teamCount) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByLabelText("Custom roster package")).toBeNull();
    unmount();
  });

  it("loads a custom roster package and locks league size from it", async () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.change(screen.getByLabelText("Roster source"), {
      target: { value: "2" },
    });

    const fileInput = screen.getByLabelText("Custom roster package");
    const leagueHeading = screen.getByRole("heading", { name: "League" });
    expect(
      fileInput.compareDocumentPosition(leagueHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const pkg = makeFullRosterPackage({ teamCount: 12 });
    const file = new File([JSON.stringify(pkg)], "roster.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Number of teams") as HTMLSelectElement).value,
      ).toBe("12");
    });
    expect(
      (screen.getByLabelText("Number of teams") as HTMLSelectElement).disabled,
    ).toBe(true);
    unmount();
  });

  it("shows AI team management delegation cards instead of presets", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    expect(
      screen.getAllByRole("heading", { name: "AI Team Management" }).length,
    ).toBeGreaterThan(0);
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
