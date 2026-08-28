/**
 * Visual franchise / team identity (colours + logo).
 * Distinct from AI FranchiseIdentitySnapshot in franchise-ops.
 */

import {
  findPaletteIdByColors,
  getTeamColorPalette,
  isTeamColorPaletteId,
  type TeamColorPaletteId,
} from "@/data/team-branding/color-palettes";
import {
  isTeamLogoId,
  type TeamLogoId,
} from "@/data/team-branding/logo-catalog";

export type TeamBranding = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: TeamLogoId;
};

export type TeamBrandingValidation =
  | { ok: true; value: TeamBranding }
  | { ok: false; error: string };

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function normalizeHexColor(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Validates branding colours as #RRGGBB hex and a known logoId.
 */
export function validateTeamBranding(input: {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: string;
}): TeamBrandingValidation {
  if (!isTeamLogoId(input.logoId)) {
    return { ok: false, error: `Unknown logo "${input.logoId}".` };
  }
  const primaryColor = normalizeHexColor(input.primaryColor);
  const secondaryColor = normalizeHexColor(input.secondaryColor);
  const accentColor = normalizeHexColor(input.accentColor);
  if (!isHexColor(primaryColor)) {
    return { ok: false, error: "Primary colour must be a #RRGGBB hex value." };
  }
  if (!isHexColor(secondaryColor)) {
    return {
      ok: false,
      error: "Secondary colour must be a #RRGGBB hex value.",
    };
  }
  if (!isHexColor(accentColor)) {
    return { ok: false, error: "Accent colour must be a #RRGGBB hex value." };
  }
  return {
    ok: true,
    value: {
      primaryColor,
      secondaryColor,
      accentColor,
      logoId: input.logoId,
    },
  };
}

export function brandingFromPalette(
  paletteId: TeamColorPaletteId,
  logoId: TeamLogoId,
): TeamBranding {
  const palette = getTeamColorPalette(paletteId);
  return {
    primaryColor: normalizeHexColor(palette.primaryColor),
    secondaryColor: normalizeHexColor(palette.secondaryColor),
    accentColor: normalizeHexColor(palette.accentColor),
    logoId,
  };
}

export function resolvePaletteIdFromBranding(
  branding: TeamBranding,
): TeamColorPaletteId | null {
  return findPaletteIdByColors(
    branding.primaryColor,
    branding.secondaryColor,
    branding.accentColor,
  );
}

export function assertTeamBranding(value: unknown, field = "branding"): TeamBranding {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Team ${field} must be a non-null object.`);
  }
  const record = value as Record<string, unknown>;
  const result = validateTeamBranding({
    primaryColor: String(record.primaryColor ?? ""),
    secondaryColor: String(record.secondaryColor ?? ""),
    accentColor: String(record.accentColor ?? ""),
    logoId: String(record.logoId ?? ""),
  });
  if (!result.ok) {
    throw new Error(`Team ${field}: ${result.error}`);
  }
  return result.value;
}

export function isValidTeamBranding(value: unknown): value is TeamBranding {
  try {
    assertTeamBranding(value);
    return true;
  } catch {
    return false;
  }
}

export { isTeamColorPaletteId, isTeamLogoId };
export type { TeamColorPaletteId, TeamLogoId };
