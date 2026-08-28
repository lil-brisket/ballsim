import { describe, expect, it, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  confirmTeamIdentityAction: vi.fn(),
}));

import { TeamIdentityBuilder } from "@/components/owner/TeamIdentityBuilder";
import { getTeamColorPalette } from "@/data/team-branding/color-palettes";
import type { TeamLogoId } from "@/data/team-branding/logo-catalog";

const ROYAL = getTeamColorPalette("royal_purple");
const MIDNIGHT = getTeamColorPalette("midnight_navy");

afterEach(() => {
  cleanup();
});

function renderBuilder(
  overrides: Partial<{
    initialNickname: string;
    initialPrimaryColor: string;
    initialSecondaryColor: string;
    initialAccentColor: string;
    initialLogoId: TeamLogoId;
    city: string;
    abbreviation: string;
  }> = {},
) {
  return render(
    <TeamIdentityBuilder
      saveId="save_1"
      city={overrides.city ?? "Toronto"}
      abbreviation={overrides.abbreviation ?? "TOR"}
      initialNickname={overrides.initialNickname ?? "Huskies"}
      initialPrimaryColor={
        overrides.initialPrimaryColor ?? MIDNIGHT.primaryColor
      }
      initialSecondaryColor={
        overrides.initialSecondaryColor ?? MIDNIGHT.secondaryColor
      }
      initialAccentColor={overrides.initialAccentColor ?? MIDNIGHT.accentColor}
      initialLogoId={overrides.initialLogoId ?? "wolf"}
      teamId="team_1"
      existingTeams={[{ id: "team_1", city: "Toronto", name: "Huskies" }]}
    />,
  );
}

describe("TeamIdentityBuilder", () => {
  it("updates preview when nickname changes", () => {
    renderBuilder();
    const preview = screen.getByTestId("team-identity-preview");
    expect(within(preview).getByText("Huskies")).toBeTruthy();
    const input = screen.getByLabelText(/team name/i);
    fireEvent.change(input, { target: { value: "Titans" } });
    expect(within(preview).getByText("Titans")).toBeTruthy();
    expect(within(preview).getByText("Toronto")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Confirm Franchise" }),
    ).toBeTruthy();
  });

  it("fills colours from a palette and shows Custom after editing one colour", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Royal Purple" }));
    expect(
      (screen.getByLabelText("Primary HEX") as HTMLInputElement).value,
    ).toBe(ROYAL.primaryColor);
    expect(
      (screen.getByLabelText("Secondary HEX") as HTMLInputElement).value,
    ).toBe(ROYAL.secondaryColor);
    expect(
      (screen.getByLabelText("Accent HEX") as HTMLInputElement).value,
    ).toBe(ROYAL.accentColor);

    const accentHex = screen.getByLabelText("Accent HEX");
    fireEvent.change(accentHex, { target: { value: "#AABBCC" } });
    fireEvent.blur(accentHex);
    expect(
      screen.getByRole("button", { name: "Custom" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      (
        screen.getByRole("button", {
          name: "Confirm Franchise",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("does not change colours when Custom is clicked", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Royal Purple" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(
      (screen.getByLabelText("Primary HEX") as HTMLInputElement).value,
    ).toBe(ROYAL.primaryColor);
    expect(
      (screen.getByLabelText("Accent HEX") as HTMLInputElement).value,
    ).toBe(ROYAL.accentColor);
    expect(
      screen.getByRole("button", { name: "Custom" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });

  it("keeps preview on the last committed colour while HEX draft is incomplete", () => {
    renderBuilder({
      initialPrimaryColor: "#123456",
      initialSecondaryColor: "#F5F5F5",
      initialAccentColor: "#FFB000",
      initialLogoId: "shield",
    });
    const preview = screen.getByTestId("team-identity-preview");
    expect(preview.getAttribute("style") ?? "").toContain(
      "background-color: rgb(18, 52, 86)",
    );
    const primaryHex = screen.getByLabelText("Primary HEX");
    fireEvent.change(primaryHex, { target: { value: "#6B2" } });
    expect(preview.getAttribute("style") ?? "").toContain(
      "background-color: rgb(18, 52, 86)",
    );
    fireEvent.change(primaryHex, { target: { value: "#6B21A8" } });
    fireEvent.blur(primaryHex);
    expect(preview.getAttribute("style") ?? "").toContain(
      "background-color: rgb(107, 33, 168)",
    );
  });

  it("updates preview immediately from the native colour picker", () => {
    renderBuilder();
    const picker = screen.getByLabelText("Primary colour picker");
    fireEvent.change(picker, { target: { value: "#112233" } });
    expect(
      screen.getByTestId("team-identity-preview").getAttribute("style") ?? "",
    ).toContain("background-color: rgb(17, 34, 51)");
  });

  it("seeds custom initial colours as Custom", () => {
    renderBuilder({
      initialPrimaryColor: "#123456",
      initialSecondaryColor: "#F5F5F5",
      initialAccentColor: "#FFB000",
      initialLogoId: "monogram",
    });
    expect(
      screen.getByRole("button", { name: "Custom" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      (screen.getByLabelText("Primary HEX") as HTMLInputElement).value,
    ).toBe("#123456");
  });

  it("randomize identity changes fields without changing city", () => {
    renderBuilder();
    const preview = screen.getByTestId("team-identity-preview");
    expect(within(preview).getByText("Huskies")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Randomize Identity" }));
    expect(within(preview).getByText("Toronto")).toBeTruthy();
    expect(within(preview).getByText("Home")).toBeTruthy();
    expect(within(preview).getByText("Away")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Confirm Franchise" }),
    ).toBeTruthy();
  });

  it("reset restores the seeded identity, not empty defaults", () => {
    renderBuilder({
      initialNickname: "Falcons",
      initialPrimaryColor: ROYAL.primaryColor,
      initialSecondaryColor: ROYAL.secondaryColor,
      initialAccentColor: ROYAL.accentColor,
      initialLogoId: "crown",
    });
    fireEvent.click(screen.getByRole("button", { name: "Midnight Navy" }));
    fireEvent.change(screen.getByLabelText(/team name/i), {
      target: { value: "Titans" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reset to Generated Identity" }),
    );
    const preview = screen.getByTestId("team-identity-preview");
    expect(within(preview).getByText("Falcons")).toBeTruthy();
    const primaryHex = (
      screen.getByLabelText("Primary HEX") as HTMLInputElement
    ).value;
    expect(primaryHex).toBe(ROYAL.primaryColor);
    expect(primaryHex).not.toBe("#000000");
    expect(
      screen.getByRole("button", { name: "Crown" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });

  it("swap home/away exchanges body colours and leaves Custom selected", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Royal Purple" }));
    fireEvent.click(screen.getByRole("button", { name: "Swap Home/Away" }));
    expect(
      screen.getByTestId("home-uniform").getAttribute("data-body-color"),
    ).toBe(ROYAL.secondaryColor);
    expect(
      screen.getByTestId("away-uniform").getAttribute("data-body-color"),
    ).toBe(ROYAL.primaryColor);
    expect(
      screen.getByRole("button", { name: "Custom" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });

  it("shows a contrast warning without blocking confirm", () => {
    renderBuilder({
      initialPrimaryColor: "#6B21A8",
      initialSecondaryColor: "#F5F5F5",
      initialAccentColor: "#6B21A0",
    });
    expect(
      screen.getByText(
        /Accent colour may be difficult to distinguish from primary/i,
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Confirm Franchise",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("randomize logo changes the selected logo", () => {
    renderBuilder({ initialLogoId: "wolf" });
    fireEvent.click(screen.getByRole("button", { name: "Randomize Logo" }));
    expect(
      screen.getByRole("button", { name: "Wolf" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("applies a branding preset without locking further edits", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Elite" }));
    expect(
      screen.getByRole("button", { name: "Crown" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Wolf" }));
    expect(
      screen.getByRole("button", { name: "Wolf" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Confirm Franchise" }),
    ).toBeTruthy();
  });

  it("shows scoreboard abbreviation from seeded identity", () => {
    renderBuilder({ abbreviation: "BKK" });
    const preview = screen.getByTestId("team-identity-preview");
    expect(within(preview).getByText("BKK")).toBeTruthy();
  });
});
