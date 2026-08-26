/**
 * Curated team colour palettes for franchise identity.
 * Players select a palette; custom hex is deferred.
 */

export type TeamColorPaletteId =
  | "midnight_navy"
  | "crimson_gold"
  | "forest_silver"
  | "royal_purple"
  | "sunset_orange"
  | "arctic_teal"
  | "iron_steel"
  | "scarlet_black"
  | "emerald_gold"
  | "ocean_coral";

export type TeamColorPalette = {
  id: TeamColorPaletteId;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export const TEAM_COLOR_PALETTES: readonly TeamColorPalette[] = [
  {
    id: "midnight_navy",
    label: "Midnight Navy",
    primaryColor: "#0B1F3A",
    secondaryColor: "#C4CED4",
    accentColor: "#F5B800",
  },
  {
    id: "crimson_gold",
    label: "Crimson Gold",
    primaryColor: "#8B1A1A",
    secondaryColor: "#F5E6C8",
    accentColor: "#D4A017",
  },
  {
    id: "forest_silver",
    label: "Forest Silver",
    primaryColor: "#1B4332",
    secondaryColor: "#E8E8E8",
    accentColor: "#95A5A6",
  },
  {
    id: "royal_purple",
    label: "Royal Purple",
    primaryColor: "#4A1C6B",
    secondaryColor: "#F0E6F7",
    accentColor: "#E8B923",
  },
  {
    id: "sunset_orange",
    label: "Sunset Orange",
    primaryColor: "#C2410C",
    secondaryColor: "#1C1917",
    accentColor: "#FDBA74",
  },
  {
    id: "arctic_teal",
    label: "Arctic Teal",
    primaryColor: "#0F766E",
    secondaryColor: "#F0FDFA",
    accentColor: "#14B8A6",
  },
  {
    id: "iron_steel",
    label: "Iron Steel",
    primaryColor: "#374151",
    secondaryColor: "#F3F4F6",
    accentColor: "#9CA3AF",
  },
  {
    id: "scarlet_black",
    label: "Scarlet Black",
    primaryColor: "#DC2626",
    secondaryColor: "#0A0A0A",
    accentColor: "#FCA5A5",
  },
  {
    id: "emerald_gold",
    label: "Emerald Gold",
    primaryColor: "#047857",
    secondaryColor: "#FEF3C7",
    accentColor: "#F59E0B",
  },
  {
    id: "ocean_coral",
    label: "Ocean Coral",
    primaryColor: "#1E3A5F",
    secondaryColor: "#FFF1F2",
    accentColor: "#FB7185",
  },
] as const;

const PALETTE_BY_ID = new Map(
  TEAM_COLOR_PALETTES.map((palette) => [palette.id, palette]),
);

export function isTeamColorPaletteId(value: unknown): value is TeamColorPaletteId {
  return typeof value === "string" && PALETTE_BY_ID.has(value as TeamColorPaletteId);
}

export function getTeamColorPalette(
  id: TeamColorPaletteId,
): TeamColorPalette {
  const palette = PALETTE_BY_ID.get(id);
  if (!palette) {
    throw new Error(`Unknown team colour palette "${id}".`);
  }
  return palette;
}

export function findPaletteIdByColors(
  primaryColor: string,
  secondaryColor: string,
  accentColor: string,
): TeamColorPaletteId | null {
  const primary = primaryColor.toUpperCase();
  const secondary = secondaryColor.toUpperCase();
  const accent = accentColor.toUpperCase();
  for (const palette of TEAM_COLOR_PALETTES) {
    if (
      palette.primaryColor.toUpperCase() === primary &&
      palette.secondaryColor.toUpperCase() === secondary &&
      palette.accentColor.toUpperCase() === accent
    ) {
      return palette.id;
    }
  }
  return null;
}
