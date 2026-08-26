import { describe, expect, it } from "vitest";
import { brandingFromPalette, validateTeamBranding } from "@/domain/entities/team-branding";
import { readableTextOnBackground, contrastRatio } from "@/domain/color-contrast";
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
