import { describe, expect, it } from "vitest";
import { TEAM_LOGO_IDS } from "@/data/team-branding/logo-catalog";
import { contrastRatio } from "@/domain/color-contrast";
import {
  buildCourtPalette,
  COURT_LINE_MIN_CONTRAST,
  COURT_TEXT_MIN_CONTRAST,
  tokenOutline,
  type CourtPalette,
} from "@/state/court-palette";
import type { TeamBrandingView } from "@/state/team-branding-view";

const LOGO_ID = TEAM_LOGO_IDS[0]!;

function brand(
  primaryColor: string,
  secondaryColor: string,
  accentColor: string,
): TeamBrandingView {
  return { primaryColor, secondaryColor, accentColor, logoId: LOGO_ID };
}

const FIXTURES: Array<[string, TeamBrandingView]> = [
  ["white", brand("#FFFFFF", "#0B1F3A", "#F5B800")],
  ["yellow", brand("#FDE047", "#1D6B44", "#C8102E")],
  ["navy", brand("#0B1F3A", "#C4CED4", "#F5B800")],
  ["black", brand("#000000", "#111111", "#222222")],
  ["neon green", brand("#39FF14", "#39FF14", "#39FF14")],
  ["magenta", brand("#FF00FF", "#FF00FF", "#FF77FF")],
  ["lowercase hex", brand("#0b1f3a", "#c4ced4", "#f5b800")],
];

const HEX = /^#[0-9A-F]{6}$/;

function ratio(a: string, b: string): number {
  return contrastRatio(a, b) ?? 0;
}

describe("buildCourtPalette", () => {
  describe.each(FIXTURES)("%s", (name, branding) => {
    const palette = buildCourtPalette(branding);

    it("keeps lines readable on floor and lane", () => {
      expect(ratio(palette.line, palette.floor)).toBeGreaterThanOrEqual(
        COURT_LINE_MIN_CONTRAST,
      );
      expect(ratio(palette.line, palette.lane)).toBeGreaterThanOrEqual(
        COURT_LINE_MIN_CONTRAST,
      );
    });

    it("keeps apron and ribbon text readable", () => {
      expect(ratio(palette.wordmark, palette.apron)).toBeGreaterThanOrEqual(
        COURT_TEXT_MIN_CONTRAST,
      );
      expect(ratio(palette.ribbonInk, palette.ribbon)).toBeGreaterThanOrEqual(
        COURT_TEXT_MIN_CONTRAST,
      );
    });

    it("keeps the ring visible on the floor", () => {
      expect([branding.accentColor, palette.line]).toContain(palette.ring);
      expect(ratio(palette.ring, palette.floor)).toBeGreaterThanOrEqual(
        COURT_LINE_MIN_CONTRAST,
      );
    });

    it("emits valid hex and carries the logo", () => {
      expect(palette.floor).toMatch(HEX);
      expect(palette.lane).toMatch(HEX);
      expect(palette.apron).toMatch(HEX);
      expect(palette.logo).toEqual(branding);
      expect(palette.logoOpacity).toBe(0.35);
    });

    it("is deterministic", () => {
      expect(buildCourtPalette(branding)).toEqual(palette);
    });

    it(`blends ${name} toward the wood`, () => {
      expect(palette.lane).not.toBe(branding.primaryColor.toUpperCase());
      expect(palette.apron).not.toBe(branding.primaryColor.toUpperCase());
    });
  });

  it("falls back to a neutral floor without branding", () => {
    const palette = buildCourtPalette(null);
    expect(palette.logo).toBeNull();
    expect(palette.line).toBe("#D4D4D8");
    expect(palette.ring).toBe(palette.line);
    expect(palette.apron).toBe(palette.floor);
    expect(palette.lane).toMatch(HEX);
    expect(ratio(palette.wordmark, palette.apron)).toBeGreaterThanOrEqual(
      COURT_TEXT_MIN_CONTRAST,
    );
    expect(ratio(palette.ribbonInk, palette.ribbon)).toBeGreaterThanOrEqual(
      COURT_TEXT_MIN_CONTRAST,
    );
  });
});

describe("tokenOutline", () => {
  const palettes: Array<[string, CourtPalette]> = [
    ...FIXTURES.map(([name, branding]): [string, CourtPalette] => [
      name,
      buildCourtPalette(branding),
    ]),
    ["neutral", buildCourtPalette(null)],
  ];

  it("needs a halo only when no single ring works", () => {
    const magenta = buildCourtPalette(brand("#FF00FF", "#FF00FF", "#FF77FF"));
    expect(tokenOutline("#FFFFFF", magenta).halo).not.toBeNull();
    expect(tokenOutline("#FF00FF", magenta)).toEqual({
      ring: "#FFFFFF",
      halo: null,
    });
  });

  describe.each(palettes)("%s palette", (name, palette) => {
    const fixture = FIXTURES.find(([n]) => n === name);
    const tokens = [
      "#FFFFFF",
      "#0A0A0A",
      "#808080",
      // Home primary, and an away token that clashes with it (same primary).
      ...(fixture ? [fixture[1].primaryColor, fixture[1].primaryColor] : []),
    ];

    it.each(tokens)("outlines token %s", (token) => {
      const { ring, halo } = tokenOutline(token, palette);
      expect(ratio(ring, token)).toBeGreaterThanOrEqual(
        COURT_LINE_MIN_CONTRAST,
      );
      // The outermost edge separates the token from the lane.
      expect(ratio(halo ?? ring, palette.lane)).toBeGreaterThanOrEqual(
        COURT_LINE_MIN_CONTRAST,
      );
      if (halo !== null) {
        expect(ratio(ring, halo)).toBeGreaterThanOrEqual(
          COURT_LINE_MIN_CONTRAST,
        );
        expect(ratio(ring, palette.lane)).toBeLessThan(COURT_LINE_MIN_CONTRAST);
      }
    });
  });
});
