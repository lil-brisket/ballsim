/**
 * Curated team logo catalog for franchise identity.
 * Quality over quantity — expand once visual style is proven.
 */

export const TEAM_LOGO_CATEGORIES = [
  { id: "mascots", label: "Mascots" },
  { id: "sports", label: "Sports" },
  { id: "power", label: "Power" },
  { id: "classic", label: "Classic" },
  { id: "regional", label: "Regional" },
] as const;

export type TeamLogoCategory = (typeof TEAM_LOGO_CATEGORIES)[number]["id"];

export type TeamLogoDefinition = {
  id: string;
  label: string;
  category: TeamLogoCategory;
};

export const TEAM_LOGO_CATALOG = [
  // Mascots (14)
  { id: "wolf", label: "Wolf", category: "mascots" },
  { id: "bear", label: "Bear", category: "mascots" },
  { id: "eagle", label: "Eagle", category: "mascots" },
  { id: "lion", label: "Lion", category: "mascots" },
  { id: "panther", label: "Panther", category: "mascots" },
  { id: "falcon", label: "Falcon", category: "mascots" },
  { id: "bull", label: "Bull", category: "mascots" },
  { id: "ram", label: "Ram", category: "mascots" },
  { id: "stag", label: "Stag", category: "mascots" },
  { id: "shark", label: "Shark", category: "mascots" },
  { id: "fox", label: "Fox", category: "mascots" },
  { id: "bison", label: "Bison", category: "mascots" },
  { id: "snake", label: "Snake", category: "mascots" },
  { id: "owl", label: "Owl", category: "mascots" },

  // Sports (9)
  { id: "basketball", label: "Basketball", category: "sports" },
  { id: "basketball-hoop", label: "Hoop", category: "sports" },
  { id: "basketball-speed", label: "Speed Ball", category: "sports" },
  { id: "basketball-wings", label: "Winged Ball", category: "sports" },
  { id: "basketball-flame", label: "Flame Ball", category: "sports" },
  { id: "basketball-claw", label: "Claw Ball", category: "sports" },
  { id: "basketball-crown", label: "Crown Ball", category: "sports" },
  { id: "basketball-lightning", label: "Lightning Ball", category: "sports" },
  { id: "basketball-star", label: "Star Ball", category: "sports" },

  // Power (10)
  { id: "lightning", label: "Lightning", category: "power" },
  { id: "flame", label: "Flame", category: "power" },
  { id: "claw-marks", label: "Claw Marks", category: "power" },
  { id: "fang", label: "Fang", category: "power" },
  { id: "horns", label: "Horns", category: "power" },
  { id: "meteor", label: "Meteor", category: "power" },
  { id: "tornado", label: "Tornado", category: "power" },
  { id: "mountain-peak", label: "Peak", category: "power" },
  { id: "wave-surge", label: "Surge", category: "power" },
  { id: "starburst", label: "Starburst", category: "power" },

  // Classic (9)
  { id: "shield", label: "Shield", category: "classic" },
  { id: "crown", label: "Crown", category: "classic" },
  { id: "star", label: "Star", category: "classic" },
  { id: "monogram", label: "Monogram", category: "classic" },
  { id: "crest", label: "Crest", category: "classic" },
  { id: "laurel", label: "Laurel", category: "classic" },
  { id: "pennant", label: "Pennant", category: "classic" },
  { id: "roundel", label: "Roundel", category: "classic" },
  { id: "diamond", label: "Diamond", category: "classic" },

  // Regional (10)
  { id: "mountain", label: "Mountain", category: "regional" },
  { id: "wave", label: "Wave", category: "regional" },
  { id: "skyline", label: "Skyline", category: "regional" },
  { id: "bridge", label: "Bridge", category: "regional" },
  { id: "palm-tree", label: "Palm", category: "regional" },
  { id: "pine-tree", label: "Pine", category: "regional" },
  { id: "lighthouse", label: "Lighthouse", category: "regional" },
  { id: "compass", label: "Compass", category: "regional" },
  { id: "sun", label: "Sun", category: "regional" },
  { id: "globe", label: "Globe", category: "regional" },
] as const satisfies readonly TeamLogoDefinition[];

export type TeamLogoId = (typeof TEAM_LOGO_CATALOG)[number]["id"];

export const TEAM_LOGO_IDS: readonly TeamLogoId[] = TEAM_LOGO_CATALOG.map(
  (entry) => entry.id,
);

const LOGO_BY_ID = new Map(
  TEAM_LOGO_CATALOG.map((entry) => [entry.id, entry]),
);

export function isTeamLogoId(value: unknown): value is TeamLogoId {
  return typeof value === "string" && LOGO_BY_ID.has(value as TeamLogoId);
}

export function getTeamLogoDefinition(id: TeamLogoId): TeamLogoDefinition {
  const definition = LOGO_BY_ID.get(id);
  if (!definition) {
    throw new Error(`Unknown team logo "${id}".`);
  }
  return definition;
}

export function getLogosByCategory(
  category: TeamLogoCategory,
): readonly (typeof TEAM_LOGO_CATALOG)[number][] {
  return TEAM_LOGO_CATALOG.filter((logo) => logo.category === category);
}
