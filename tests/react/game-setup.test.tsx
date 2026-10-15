import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  createSaveAction: vi.fn(),
}));

import { createSaveAction } from "@/application/actions";
import { GameSetupForm } from "@/components/owner/GameSetupForm";
import { NEW_GAME_DRAFT_KEY } from "@/components/owner/game-setup/draft-storage";
import { settingsForPreset } from "@/domain/game-settings-presets";
import { makeFullRosterPackage } from "../helpers/custom-content";

function teamSelect(): HTMLSelectElement {
  return screen.getByLabelText("Number of teams") as HTMLSelectElement;
}

function isRadioChecked(name: string): boolean {
  return (screen.getByRole("radio", { name }) as HTMLInputElement).checked;
}

function goToAdvanced() {
  fireEvent.click(
    screen.getByRole("button", { name: "Next: Advanced settings" }),
  );
}

function uploadFile(contents: string) {
  const file = new File([contents], "roster.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Custom roster package"), {
    target: { files: [file] },
  });
}

describe("GameSetupForm", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("selects the Standard preset by default with its league values", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    expect(isRadioChecked("Standard")).toBe(true);
    expect(isRadioChecked("CBL")).toBe(false);
    expect(isRadioChecked("Custom")).toBe(false);
    expect(teamSelect().value).toBe("30");
    expect(
      (screen.getByLabelText("Games per team") as HTMLSelectElement).value,
    ).toBe("82");
    expect(
      (screen.getByLabelText("Playoff teams") as HTMLSelectElement).value,
    ).toBe("16");
    expect(
      (screen.getByLabelText("Series length") as HTMLSelectElement).value,
    ).toBe("7");
    unmount();
  });

  it("renders the three titled sections in order", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    const league = screen.getByRole("heading", { name: "League Format" });
    const roster = screen.getByRole("heading", { name: "Roster and Draft" });
    const save = screen.getByRole("heading", { name: "Save Details" });
    expect(
      league.compareDocumentPosition(roster) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      roster.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    unmount();
  });

  it("applies CBL, flips to Custom on edit, and Custom keeps values", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(screen.getByRole("radio", { name: "CBL" }));
    expect(isRadioChecked("CBL")).toBe(true);
    expect(teamSelect().value).toBe("12");
    expect(
      (screen.getByLabelText("Games per team") as HTMLSelectElement).value,
    ).toBe("22");
    expect(
      (screen.getByLabelText("Playoff teams") as HTMLSelectElement).value,
    ).toBe("8");

    fireEvent.change(screen.getByLabelText("Playoff teams"), {
      target: { value: "4" },
    });
    expect(isRadioChecked("Custom")).toBe(true);
    expect(isRadioChecked("CBL")).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "Standard" }));
    fireEvent.change(screen.getByLabelText("Games per team"), {
      target: { value: "60" },
    });
    expect(isRadioChecked("Custom")).toBe(true);
    expect(teamSelect().value).toBe("30");
    expect(
      (screen.getByLabelText("Games per team") as HTMLSelectElement).value,
    ).toBe("60");
    unmount();
  });

  it("offers advanced settings under Standard and flips to Custom on edit", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    expect(isRadioChecked("Standard")).toBe(true);
    expect(screen.queryByRole("checkbox", { name: "Luxury tax" })).toBeNull();
    goToAdvanced();

    expect(
      screen.getByRole("heading", { name: "Advanced settings", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText(/Current: Cap .*Luxury tax on/)).toBeTruthy();
    const luxury = screen.getByRole("checkbox", {
      name: "Luxury tax",
    }) as HTMLInputElement;
    expect(luxury.checked).toBe(true);
    fireEvent.click(luxury);

    expect(luxury.checked).toBe(false);
    expect(screen.getByText(/Current: Cap .*Luxury tax off/)).toBeTruthy();
    expect(screen.getByText("Custom")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(isRadioChecked("Custom")).toBe(true);
    unmount();
  });

  it("shows four steps with Setup current and moves to Advanced", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    const nav = screen.getByRole("navigation", { name: "New game steps" });
    expect(nav.textContent).toContain("1. Mode");
    expect(nav.textContent).toContain("4. Franchise");
    expect(screen.getByText("2. Setup").getAttribute("aria-current")).toBe(
      "step",
    );
    goToAdvanced();
    expect(screen.getByText("3. Advanced").getAttribute("aria-current")).toBe(
      "step",
    );
    expect(screen.getByRole("button", { name: "2. Setup" })).toBeTruthy();
    expect(document.activeElement?.id).toBe("onboarding-header");

    fireEvent.click(screen.getByRole("button", { name: "2. Setup" }));
    expect(screen.getByText("2. Setup").getAttribute("aria-current")).toBe(
      "step",
    );
    fireEvent.click(screen.getByRole("button", { name: "3. Advanced" }));
    expect(
      screen.getByRole("heading", { name: "Injuries", level: 2 }),
    ).toBeTruthy();
    unmount();
  });

  it("keeps advanced edits across Back and forward again", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    goToAdvanced();
    fireEvent.click(screen.getByRole("checkbox", { name: "Luxury tax" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    goToAdvanced();

    expect(
      (screen.getByRole("checkbox", { name: "Luxury tax" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    unmount();
  });

  it("goes straight to review with Skip to review, and Edit Advanced returns", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip to review" }));
    expect(
      screen.getByRole("heading", { name: "Review and create", level: 1 }),
    ).toBeTruthy();
    // Review shows Advanced as the active step.
    expect(screen.getByText("3. Advanced").getAttribute("aria-current")).toBe(
      "step",
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Advanced" }));
    expect(
      screen.getByRole("heading", { name: "Advanced settings", level: 1 }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Injuries" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Review and create" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("heading", { name: "Advanced settings", level: 1 }),
    ).toBeTruthy();
    unmount();
  });

  it("disables Next and Skip with a reason while the setup is blocked", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit />);

    expect(
      (
        screen.getByRole("button", {
          name: "Next: Advanced settings",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Skip to review",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/reached the save limit/)).toBeTruthy();
    unmount();
  });

  it("shows fantasy draft deferred-setup message", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(screen.getByRole("radio", { name: "Fantasy draft" }));

    expect(isRadioChecked("Fantasy draft")).toBe(true);
    expect(
      screen.getByText(/configured after you choose your franchises/i),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Your draft position")).toBeNull();
    unmount();
  });

  it("orders league format, roster source, then save details", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    const leagueHeading = screen.getByRole("heading", {
      name: "League Format",
    });
    const rosterGroup = screen.getByRole("radiogroup", {
      name: "Roster source",
    });
    expect(
      leagueHeading.compareDocumentPosition(rosterGroup) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(isRadioChecked("Generated rosters")).toBe(true);
    expect(screen.queryByLabelText("Custom roster package")).toBeNull();
    unmount();
  });

  it("loads an imported roster package and locks league size from it", async () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(
      screen.getByRole("radio", { name: "Imported roster package" }),
    );

    const fileInput = screen.getByLabelText("Custom roster package");
    const saveHeading = screen.getByRole("heading", { name: "Save Details" });
    expect(
      fileInput.compareDocumentPosition(saveHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    uploadFile(JSON.stringify(makeFullRosterPackage({ teamCount: 12 })));

    await waitFor(() => {
      expect(teamSelect().value).toBe("12");
    });
    expect(teamSelect().disabled).toBe(true);
    unmount();
  });

  it("blocks continuing on an invalid JSON file", async () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(
      screen.getByRole("radio", { name: "Imported roster package" }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Skip to review",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    uploadFile("{ not json");

    await waitFor(() => {
      expect(screen.getByText(/isn't valid JSON/)).toBeTruthy();
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Skip to review",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Upload a valid roster package.")).toBeTruthy();
    unmount();
  });

  it("explains an unsupported package team count", async () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(
      screen.getByRole("radio", { name: "Imported roster package" }),
    );
    uploadFile(JSON.stringify(makeFullRosterPackage({ teamCount: 14 })));

    await waitFor(() => {
      expect(
        screen.getByText(
          "This package has 14 teams. Supported league sizes are 8, 10, 12, 16, 20, 24, 30, 32 — add or remove teams in the package and upload it again.",
        ),
      ).toBeTruthy();
    });
    expect(teamSelect().disabled).toBe(false);
    unmount();
  });

  it("preserves changes when going Review then Back", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.change(screen.getByLabelText("Save name"), {
      target: { value: "My Dynasty" },
    });
    fireEvent.change(teamSelect(), { target: { value: "20" } });
    fireEvent.click(
      screen.getByRole("radio", { name: "Imported roster package" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip to review" }));
    // Imported roster without a package blocks review; use generated instead.
    expect(
      screen.queryByRole("heading", { name: "Review and create" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Generated rosters" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip to review" }));

    expect(
      screen.getByRole("heading", { name: "Review and create" }),
    ).toBeTruthy();
    expect(screen.getByText("My Dynasty")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Edit League Format" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Advanced" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect((screen.getByLabelText("Save name") as HTMLInputElement).value).toBe(
      "My Dynasty",
    );
    expect(teamSelect().value).toBe("20");
    expect(isRadioChecked("Generated rosters")).toBe(true);
    expect(isRadioChecked("Custom")).toBe(true);
    unmount();
  });

  it("goes back to the matching section from an Edit button", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip to review" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Save Details" }));

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Save Details" }),
    );
    unmount();
  });

  it("saves a draft on submit", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.change(screen.getByLabelText("Save name"), {
      target: { value: "Draft Me" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Skip to review" }));
    fireEvent.click(screen.getByRole("button", { name: "Create franchise" }));

    expect(createSaveAction).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(
      window.sessionStorage.getItem(NEW_GAME_DRAFT_KEY) ?? "null",
    );
    expect(stored.name).toBe("Draft Me");
    expect(stored.preset).toBe("standard");
    unmount();
  });

  it("offers Single Player and shows multiplayer formats as unavailable", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    const save = screen.getByRole("heading", { name: "Save Details" });
    const participants = screen.getByRole("heading", {
      name: "League Participants",
    });
    expect(
      save.compareDocumentPosition(participants) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const single = screen.getByRole("radio", { name: "Single Player" });
    const local = screen.getByRole("radio", { name: "Local Shared League" });
    const online = screen.getByRole("radio", { name: "Online Multiplayer" });
    expect((single as HTMLInputElement).checked).toBe(true);
    expect((local as HTMLInputElement).disabled).toBe(true);
    expect((online as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Planned")).toBeTruthy();
    unmount();
  });

  it("submits single-player participation and summarizes it on review", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip to review" }));
    const group = screen.getByRole("region", { name: "League Participants" });
    expect(group.textContent).toContain("Single Player");
    fireEvent.click(screen.getByRole("button", { name: "Create franchise" }));

    const formData = vi.mocked(createSaveAction).mock.calls[0]![0];
    expect(JSON.parse(String(formData.get("participationJson")))).toEqual({
      mode: "single",
    });
    unmount();
  });

  it("restores a stored draft when restoreDraft is set", async () => {
    window.sessionStorage.setItem(
      NEW_GAME_DRAFT_KEY,
      JSON.stringify({
        name: "Restored Save",
        preset: "cbl",
        settings: settingsForPreset("cbl"),
        useCustomRoster: false,
        rosterPackageJson: "",
        rosterDropped: false,
      }),
    );
    const { unmount } = render(
      <GameSetupForm atSaveLimit={false} restoreDraft />,
    );

    await waitFor(() => {
      expect(teamSelect().value).toBe("12");
    });
    expect((screen.getByLabelText("Save name") as HTMLInputElement).value).toBe(
      "Restored Save",
    );
    expect(isRadioChecked("CBL")).toBe(true);
    unmount();
  });

  it("tells the user when a restored roster package was dropped", async () => {
    window.sessionStorage.setItem(
      NEW_GAME_DRAFT_KEY,
      JSON.stringify({
        name: "Big",
        preset: "custom",
        settings: settingsForPreset("standard"),
        useCustomRoster: true,
        rosterPackageJson: "",
        rosterDropped: true,
      }),
    );
    const { unmount } = render(
      <GameSetupForm atSaveLimit={false} restoreDraft />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Your roster package was too large to keep — upload it again.",
        ),
      ).toBeTruthy();
    });
    unmount();
  });

  it("ignores an invalid stored draft", async () => {
    window.sessionStorage.setItem(
      NEW_GAME_DRAFT_KEY,
      JSON.stringify({ name: "Bad", preset: "cbl", settings: { nope: true } }),
    );
    const { unmount } = render(
      <GameSetupForm atSaveLimit={false} restoreDraft />,
    );

    await waitFor(() => {
      expect(teamSelect().value).toBe("30");
    });
    expect((screen.getByLabelText("Save name") as HTMLInputElement).value).toBe(
      "Harbor Franchise",
    );
    unmount();
  });

  it("removes a stored draft when there was no error", async () => {
    window.sessionStorage.setItem(NEW_GAME_DRAFT_KEY, "{}");
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    await waitFor(() => {
      expect(window.sessionStorage.getItem(NEW_GAME_DRAFT_KEY)).toBeNull();
    });
    unmount();
  });

  it("shows AI team management delegation cards instead of presets", () => {
    const { unmount } = render(<GameSetupForm atSaveLimit={false} />);

    goToAdvanced();

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
