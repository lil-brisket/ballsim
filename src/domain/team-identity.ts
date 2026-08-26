/**
 * Stable identity fingerprint for regression tests across save/load and simulation.
 */

import type { Team } from "@/domain/entities/team";
import type { TeamBranding } from "@/domain/entities/team-branding";

export type TeamIdentityFingerprint = {
  city: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: string;
};

export function getTeamIdentityFingerprint(
  team: Pick<Team, "city" | "name" | "abbreviation" | "branding">,
): TeamIdentityFingerprint {
  return {
    city: team.city,
    name: team.name,
    abbreviation: team.abbreviation,
    primaryColor: team.branding.primaryColor,
    secondaryColor: team.branding.secondaryColor,
    accentColor: team.branding.accentColor,
    logoId: team.branding.logoId,
  };
}

export function brandingFingerprintKey(branding: TeamBranding): string {
  return [
    branding.logoId,
    branding.primaryColor,
    branding.secondaryColor,
    branding.accentColor,
  ].join("|");
}

export function paletteLogoKey(
  paletteId: string,
  logoId: string,
): string {
  return `${paletteId}|${logoId}`;
}
