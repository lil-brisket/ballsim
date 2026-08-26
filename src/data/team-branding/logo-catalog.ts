/**
 * Curated team logo catalog for franchise identity.
 * Quality over quantity — expand once visual style is proven.
 */

export type TeamLogoId =
  | "wolf"
  | "bear"
  | "eagle"
  | "lion"
  | "lightning"
  | "flame"
  | "crown"
  | "shield"
  | "star"
  | "monogram";

export type TeamLogoCategory = "animals" | "symbols" | "marks";

export type TeamLogoDefinition = {
  id: TeamLogoId;
  label: string;
  category: TeamLogoCategory;
};

export const TEAM_LOGO_CATALOG: readonly TeamLogoDefinition[] = [
  { id: "wolf", label: "Wolf", category: "animals" },
  { id: "bear", label: "Bear", category: "animals" },
  { id: "eagle", label: "Eagle", category: "animals" },
  { id: "lion", label: "Lion", category: "animals" },
  { id: "lightning", label: "Lightning", category: "symbols" },
  { id: "flame", label: "Flame", category: "symbols" },
  { id: "crown", label: "Crown", category: "symbols" },
  { id: "shield", label: "Shield", category: "marks" },
  { id: "star", label: "Star", category: "marks" },
  { id: "monogram", label: "Monogram", category: "marks" },
] as const;

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
