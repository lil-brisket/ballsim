import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/domain/color-contrast";
import {
  DEFAULT_TEAM_THEME,
  TEAM_INK_MIN_CONTRAST,
  TEAM_INK_SURFACE,
  resolveTeamInk,
  teamThemeVars,
} from "@/presentation/team-theme";

describe("teamThemeVars", () => {
  it("falls back to the neutral amber theme without branding", () => {
    expect(teamThemeVars(null)).toEqual(DEFAULT_TEAM_THEME);
    expect(
      teamThemeVars({ primaryColor: "red", secondaryColor: "#FFFFFF" }),
    ).toEqual(DEFAULT_TEAM_THEME);
  });

  it("emits team colours and an rgb triplet for alpha use", () => {
    const vars = teamThemeVars({
      primaryColor: "#c8102e",
      secondaryColor: "#ffffff",
    });
    expect(vars["--team-primary"]).toBe("#C8102E");
    expect(vars["--team-secondary"]).toBe("#FFFFFF");
    expect(vars["--team-primary-rgb"]).toBe("200 16 46");
  });

  it("picks readable text for very light and very dark plates", () => {
    expect(
      teamThemeVars({ primaryColor: "#F8F8F2", secondaryColor: "#000000" })[
        "--team-on-primary"
      ],
    ).toBe("#0A0A0A");
    expect(
      teamThemeVars({ primaryColor: "#0B1F3A", secondaryColor: "#C4CED4" })[
        "--team-on-primary"
      ],
    ).toBe("#FFFFFF");
  });
});

describe("resolveTeamInk", () => {
  it("uses the primary colour when it is already readable", () => {
    expect(
      resolveTeamInk({ primaryColor: "#F5B800", secondaryColor: "#000000" }),
    ).toBe("#F5B800");
  });

  it("falls through to secondary for a dark primary", () => {
    expect(
      resolveTeamInk({ primaryColor: "#0B1F3A", secondaryColor: "#C4CED4" }),
    ).toBe("#C4CED4");
  });

  it("lightens the primary when no team colour is readable", () => {
    const ink = resolveTeamInk({
      primaryColor: "#0B1F3A",
      secondaryColor: "#111111",
      accentColor: "#222244",
    });
    expect(contrastRatio(ink, TEAM_INK_SURFACE)).toBeGreaterThanOrEqual(
      TEAM_INK_MIN_CONTRAST,
    );
  });
});
