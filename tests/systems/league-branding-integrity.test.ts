import { describe, expect, it } from "vitest";
import { resolvePaletteIdFromBranding } from "@/domain/entities/team-branding";
import { createSeededRng } from "@/domain/rng";
import { paletteLogoKey } from "@/domain/team-identity";
import { generateLeague } from "@/systems/league-generation";

const STANDARD_CONFIG = {
  leagueName: "Continental Basketball League",
  conferenceCount: 2,
  divisionsPerConference: 3,
  teamsPerDivision: 5,
  rosterSize: 12,
};

describe("league branding integrity", () => {
  it("assigns unique palette+logo combinations across a 30-team league", () => {
    const generated = generateLeague(STANDARD_CONFIG, createSeededRng(42));
    expect(generated.teams).toHaveLength(30);

    const keys = new Set<string>();
    for (const team of generated.teams) {
      expect(team.branding.logoId).toBeTruthy();
      expect(team.branding.primaryColor).toMatch(/^#[0-9A-F]{6}$/);
      expect(team.branding.secondaryColor).toMatch(/^#[0-9A-F]{6}$/);
      expect(team.branding.accentColor).toMatch(/^#[0-9A-F]{6}$/);

      const paletteId = resolvePaletteIdFromBranding(team.branding);
      expect(paletteId).not.toBeNull();
      const key = paletteLogoKey(paletteId!, team.branding.logoId);
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(keys.size).toBe(30);
  });

  it("is deterministic for the same seed", () => {
    const a = generateLeague(STANDARD_CONFIG, createSeededRng(77));
    const b = generateLeague(STANDARD_CONFIG, createSeededRng(77));
    expect(a.teams.map((team) => team.branding)).toEqual(
      b.teams.map((team) => team.branding),
    );
  });

  it("can differ across different seeds", () => {
    const a = generateLeague(STANDARD_CONFIG, createSeededRng(1));
    const b = generateLeague(STANDARD_CONFIG, createSeededRng(2));
    const aKeys = a.teams.map(
      (team) =>
        `${team.branding.logoId}|${team.branding.primaryColor}|${team.branding.secondaryColor}|${team.branding.accentColor}`,
    );
    const bKeys = b.teams.map(
      (team) =>
        `${team.branding.logoId}|${team.branding.primaryColor}|${team.branding.secondaryColor}|${team.branding.accentColor}`,
    );
    expect(aKeys).not.toEqual(bKeys);
  });
});
