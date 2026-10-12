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

describe("team theme contrast across extreme palettes", () => {
  const PALETTES: Array<[string, string, string]> = [
    ["white", "#FFFFFF", "#FFFFFF"],
    ["near-white yellow", "#FFFFE0", "#FFF8B0"],
    ["black", "#000000", "#000000"],
    ["navy on navy", "#0B1F3A", "#0A1A33"],
    ["pure red", "#FF0000", "#FF0000"],
    ["pure blue", "#0000FF", "#0000FF"],
    ["dark purple", "#2A0A3A", "#1E0830"],
  ];
  // Raised/arena panels as defined in globals.css, and the deepest page surface.
  const SURFACES = ["#18181B", "#0F0F12", "#050507"];
  // The heaviest team tint used by components (bg-team/30, ring/hover states).
  const TINT_ALPHAS = [0.15, 0.2, 0.25, 0.3];

  function blend(fg: string, bg: string, alpha: number): string {
    const f = fg.replace("#", "");
    const b = bg.replace("#", "");
    const mix = (i: number) =>
      Math.round(
        parseInt(f.slice(i, i + 2), 16) * alpha +
          parseInt(b.slice(i, i + 2), 16) * (1 - alpha),
      );
    return `#${[0, 2, 4]
      .map((i) => mix(i).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  it.each(PALETTES)("keeps ink and plate text readable: %s", (_n, p, s) => {
    const vars = teamThemeVars({ primaryColor: p, secondaryColor: s });
    const ink = vars["--team-ink"];
    for (const surface of SURFACES) {
      expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(
        TEAM_INK_MIN_CONTRAST,
      );
      for (const alpha of TINT_ALPHAS) {
        expect(
          contrastRatio(ink, blend(p, surface, alpha)),
        ).toBeGreaterThanOrEqual(TEAM_INK_MIN_CONTRAST);
      }
    }
    expect(contrastRatio(vars["--team-on-primary"], p)).toBeGreaterThanOrEqual(
      TEAM_INK_MIN_CONTRAST,
    );
  });
});
