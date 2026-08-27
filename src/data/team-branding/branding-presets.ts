/**
 * Quick identity presets: coherent palette + logo pairs.
 * Selecting a preset never locks further manual customization.
 */

import type { TeamColorPaletteId } from "@/data/team-branding/color-palettes";
import type { TeamLogoId } from "@/data/team-branding/logo-catalog";

export type TeamBrandingPresetId =
  | "classic"
  | "modern"
  | "aggressive"
  | "city"
  | "elite";

export type TeamBrandingPreset = {
  id: TeamBrandingPresetId;
  label: string;
  paletteId: TeamColorPaletteId;
  logoId: TeamLogoId;
};

export const TEAM_BRANDING_PRESETS: readonly TeamBrandingPreset[] = [
  {
    id: "classic",
    label: "Classic",
    paletteId: "midnight_navy",
    logoId: "shield",
  },
  {
    id: "modern",
    label: "Modern",
    paletteId: "arctic_teal",
    logoId: "monogram",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    paletteId: "scarlet_black",
    logoId: "wolf",
  },
  {
    id: "city",
    label: "City",
    paletteId: "ocean_coral",
    logoId: "star",
  },
  {
    id: "elite",
    label: "Elite",
    paletteId: "royal_purple",
    logoId: "crown",
  },
] as const;
