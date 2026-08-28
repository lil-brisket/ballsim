/**
 * View-layer branding shape for UI components.
 * Always prefer persisted Team.branding / GameTeamSnapshot.branding —
 * never invent logos in render.
 */

import { isTeamLogoId } from "@/data/team-branding/logo-catalog";
import {
  isHexColor,
  normalizeHexColor,
} from "@/domain/entities/team-branding";

export type TeamBrandingView = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: string;
};

type BrandingLike = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: string;
};

/**
 * Normalize and validate branding for UI consumption.
 * Returns null for missing/invalid legacy data (safe fallback in components).
 */
export function toBrandingView(
  branding: BrandingLike | null | undefined,
): TeamBrandingView | null {
  if (!branding) {
    return null;
  }
  if (!isTeamLogoId(branding.logoId)) {
    return null;
  }
  const primaryColor = normalizeHexColor(branding.primaryColor);
  const secondaryColor = normalizeHexColor(branding.secondaryColor);
  const accentColor = normalizeHexColor(branding.accentColor);
  if (
    !isHexColor(primaryColor) ||
    !isHexColor(secondaryColor) ||
    !isHexColor(accentColor)
  ) {
    return null;
  }
  return {
    primaryColor,
    secondaryColor,
    accentColor,
    logoId: branding.logoId,
  };
}
