import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  confirmControlledFranchisesAction: vi.fn(),
}));

import {
  ControlledFranchiseIdentityEditor,
  type ControlledFranchiseIdentityDraft,
} from "@/components/owner/ControlledFranchiseIdentityEditor";
import { getTeamColorPalette } from "@/data/team-branding/color-palettes";
import { TEAM_LOGO_CATALOG } from "@/data/team-branding/logo-catalog";

afterEach(() => {
  cleanup();
});

const INITIAL: ControlledFranchiseIdentityDraft = {
  teamId: "team_1",
  city: "Toronto",
  abbreviation: "TOR",
  nickname: "Wolves",
  primaryColor: "#112233",
  secondaryColor: "#ffffff",
  accentColor: "#f59e0b",
  logoId: "basketball",
};

function Harness() {
  const [draft, setDraft] = useState(INITIAL);
  return (
    <ControlledFranchiseIdentityEditor
      draft={draft}
      nicknameError={null}
      onChange={setDraft}
    />
  );
}

describe("ControlledFranchiseIdentityEditor", () => {
  it("shows city, nickname and read-only abbreviation in the preview", () => {
    render(<Harness />);
    expect(screen.getByTestId("identity-preview-title").textContent).toBe(
      "Toronto Wolves",
    );
    expect(
      screen.getByTestId("identity-preview-abbreviation").textContent,
    ).toBe("TOR");
    expect(
      screen.getByText("Abbreviation is set from your city."),
    ).toBeTruthy();
  });

  it("updates the preview title as the nickname changes", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Falcons" },
    });
    expect(screen.getByTestId("identity-preview-title").textContent).toBe(
      "Toronto Falcons",
    );
  });

  it("updates colour chips when a palette is chosen", () => {
    render(<Harness />);
    expect(screen.getByTestId("identity-preview-primary-hex").textContent).toBe(
      "#112233",
    );
    const palette = getTeamColorPalette("royal_purple");
    fireEvent.click(screen.getByRole("button", { name: palette.label }));
    const preview = screen.getByTestId("identity-preview");
    expect(
      within(preview)
        .getByTestId("identity-preview-primary-hex")
        .textContent?.toLowerCase(),
    ).toBe(palette.primaryColor.toLowerCase());
    expect(
      within(preview)
        .getByTestId("identity-preview-accent-hex")
        .textContent?.toLowerCase(),
    ).toBe(palette.accentColor.toLowerCase());
    expect(
      screen
        .getByRole("button", { name: new RegExp(palette.label) })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("marks the selected logo with aria-pressed", () => {
    render(<Harness />);
    const other = TEAM_LOGO_CATALOG.find((logo) => logo.id !== "basketball")!;
    const button = screen.getByRole("button", { name: other.label });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(
      screen
        .getByRole("button", { name: other.label })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
