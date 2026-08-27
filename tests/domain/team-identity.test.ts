import { describe, expect, it } from "vitest";
import { getTeamIdentityFingerprint } from "@/domain/team-identity";
import { brandingFromPalette } from "@/domain/entities/team-branding";
import { createTeam } from "../factories/team";

describe("getTeamIdentityFingerprint", () => {
  it("captures city, name, abbreviation, and branding fields", () => {
    const branding = brandingFromPalette("ocean_coral", "eagle");
    const team = createTeam({
      city: "Miami",
      name: "Heatwave",
      abbreviation: "MIA",
      branding,
    });
    expect(getTeamIdentityFingerprint(team)).toEqual({
      city: "Miami",
      name: "Heatwave",
      abbreviation: "MIA",
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      logoId: "eagle",
    });
  });

  it("changes when branding changes", () => {
    const team = createTeam({
      branding: brandingFromPalette("midnight_navy", "shield"),
    });
    const before = getTeamIdentityFingerprint(team);
    const after = getTeamIdentityFingerprint({
      ...team,
      branding: brandingFromPalette("scarlet_black", "flame"),
    });
    expect(after).not.toEqual(before);
    expect(after.logoId).toBe("flame");
  });
});
