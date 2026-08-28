import { describe, expect, it } from "vitest";
import { brandingFromPalette, validateTeamBranding } from "@/domain/entities/team-branding";
import {
  evaluateTeamIdentityContrast,
  readableTextOnBackground,
  contrastRatio,
} from "@/domain/color-contrast";
import { getTeamIdentityFingerprint } from "@/domain/team-identity";
import { createTeam } from "../factories/team";
import {
  deriveDefaultTeamBranding,
  generateTeamBranding,
  hashTeamIdentitySeed,
} from "@/systems/team-branding-generation";
import { createSeededRng } from "@/domain/rng";
import { resolvePaletteIdFromBranding } from "@/domain/entities/team-branding";
import { paletteLogoKey } from "@/domain/team-identity";
import {
  findPaletteIdByColors,
  TEAM_COLOR_PALETTES,
} from "@/data/team-branding/color-palettes";

describe("validateTeamBranding", () => {
  it("accepts palette-derived branding", () => {
    const branding = brandingFromPalette("midnight_navy", "wolf");
    const result = validateTeamBranding(branding);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.logoId).toBe("wolf");
      expect(result.value.primaryColor).toBe("#0B1F3A");
    }
  });

  it("accepts and normalizes custom hex colours", () => {
    const result = validateTeamBranding({
      primaryColor: "#123456",
      secondaryColor: "#f5f5f5",
      accentColor: "#ffb000",
      logoId: "monogram",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.primaryColor).toBe("#123456");
      expect(result.value.secondaryColor).toBe("#F5F5F5");
      expect(result.value.accentColor).toBe("#FFB000");
    }
  });

  it("rejects unknown logo", () => {
    const result = validateTeamBranding({
      primaryColor: "#0B1F3A",
      secondaryColor: "#C4CED4",
      accentColor: "#F5B800",
      logoId: "dragon",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid hex", () => {
    const result = validateTeamBranding({
      primaryColor: "navy",
      secondaryColor: "#C4CED4",
      accentColor: "#F5B800",
      logoId: "wolf",
    });
    expect(result.ok).toBe(false);
  });
});

describe("findPaletteIdByColors", () => {
  it("returns the palette id for an exact ordered match", () => {
    const palette = TEAM_COLOR_PALETTES.find((entry) => entry.id === "royal_purple")!;
    expect(
      findPaletteIdByColors(
        palette.primaryColor,
        palette.secondaryColor,
        palette.accentColor,
      ),
    ).toBe("royal_purple");
  });

  it("matches after HEX case normalization", () => {
    expect(
      findPaletteIdByColors("#4a1c6b", "#f0e6f7", "#e8b923"),
    ).toBe("royal_purple");
  });

  it("returns null when the same colours are in a different order", () => {
    const palette = TEAM_COLOR_PALETTES.find((entry) => entry.id === "royal_purple")!;
    expect(
      findPaletteIdByColors(
        palette.secondaryColor,
        palette.primaryColor,
        palette.accentColor,
      ),
    ).toBeNull();
  });

  it("returns null for custom colours", () => {
    expect(
      findPaletteIdByColors("#123456", "#F5F5F5", "#FFB000"),
    ).toBeNull();
  });

  it("returns null for invalid colours without throwing", () => {
    expect(findPaletteIdByColors("navy", "#F5F5F5", "#FFB000")).toBeNull();
    expect(findPaletteIdByColors("#12345", "#F5F5F5", "#FFB000")).toBeNull();
  });
});

describe("getTeamIdentityFingerprint", () => {
  it("captures city name abbreviation and branding", () => {
    const team = createTeam({
      city: "Toronto",
      name: "Huskies",
      abbreviation: "TOR",
      branding: brandingFromPalette("crimson_gold", "bear"),
    });
    expect(getTeamIdentityFingerprint(team)).toEqual({
      city: "Toronto",
      name: "Huskies",
      abbreviation: "TOR",
      primaryColor: brandingFromPalette("crimson_gold", "bear").primaryColor,
      secondaryColor: brandingFromPalette("crimson_gold", "bear").secondaryColor,
      accentColor: brandingFromPalette("crimson_gold", "bear").accentColor,
      logoId: "bear",
    });
  });
});

describe("color contrast", () => {
  it("picks readable text on dark and light backgrounds", () => {
    expect(readableTextOnBackground("#0B1F3A")).toBe("#FFFFFF");
    expect(readableTextOnBackground("#F5E6C8")).toBe("#0A0A0A");
  });

  it("computes contrast ratio", () => {
    const ratio = contrastRatio("#FFFFFF", "#000000");
    expect(ratio).toBeGreaterThan(20);
  });

  it("produces no warnings for all curated palettes", () => {
    for (const palette of TEAM_COLOR_PALETTES) {
      expect(
        evaluateTeamIdentityContrast({
          primaryColor: palette.primaryColor,
          secondaryColor: palette.secondaryColor,
          accentColor: palette.accentColor,
        }),
      ).toEqual([]);
    }
  });

  it("warns with readability copy for hard-to-distinguish accents", () => {
    const warnings = evaluateTeamIdentityContrast({
      primaryColor: "#6B21A8",
      secondaryColor: "#F5F5F5",
      accentColor: "#6B21A0",
    });
    expect(warnings.some((entry) => entry.kind === "primary_accent")).toBe(
      true,
    );
    expect(
      warnings.every(
        (entry) =>
          !/wcag|accessibility/i.test(entry.message) &&
          /distinguish|hard to tell/i.test(entry.message),
      ),
    ).toBe(true);
  });

  it("warns when home and away colours are hard to tell apart", () => {
    const warnings = evaluateTeamIdentityContrast({
      primaryColor: "#101010",
      secondaryColor: "#181818",
      accentColor: "#FACC15",
    });
    expect(warnings.some((entry) => entry.kind === "primary_secondary")).toBe(
      true,
    );
    expect(
      warnings.find((entry) => entry.kind === "primary_secondary")?.message,
    ).toMatch(/home and away/i);
  });

  it("does not warn for a clearly distinct custom triple", () => {
    expect(
      evaluateTeamIdentityContrast({
        primaryColor: "#123456",
        secondaryColor: "#F5F5F5",
        accentColor: "#FFB000",
      }),
    ).toEqual([]);
  });
});

describe("team branding generation", () => {
  it("is deterministic for the same seed", () => {
    const a = generateTeamBranding(
      { teamId: "team_a", city: "Toronto", name: "Huskies" },
      createSeededRng(42),
    );
    const b = generateTeamBranding(
      { teamId: "team_a", city: "Toronto", name: "Huskies" },
      createSeededRng(42),
    );
    expect(a).toEqual(b);
  });

  it("deriveDefaultTeamBranding is stable for the same identity", () => {
    const a = deriveDefaultTeamBranding("team_1", "Toronto", "Huskies");
    const b = deriveDefaultTeamBranding("team_1", "Toronto", "Huskies");
    expect(a).toEqual(b);
    expect(hashTeamIdentitySeed("team_1", "Toronto", "Huskies")).toBe(
      hashTeamIdentitySeed("team_1", "Toronto", "Huskies"),
    );
  });

  it("avoids duplicate palette+logo when used keys are provided", () => {
    const first = deriveDefaultTeamBranding("team_1", "A", "One");
    const firstPalette = resolvePaletteIdFromBranding(first)!;
    const used = new Set([paletteLogoKey(firstPalette, first.logoId)]);
    const second = deriveDefaultTeamBranding("team_1", "A", "One", used);
    const secondPalette = resolvePaletteIdFromBranding(second)!;
    expect(paletteLogoKey(secondPalette, second.logoId)).not.toBe(
      paletteLogoKey(firstPalette, first.logoId),
    );
  });
});
