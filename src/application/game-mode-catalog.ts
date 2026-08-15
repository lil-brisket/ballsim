import type { GameMode } from "@/state/game-state";

/**
 * Catalog ids for the mode-selection UI.
 * Playable entries use persisted GameMode ("owner").
 * "career" | "dynasty" are catalog-only and must never be written to GameState.user.mode.
 */
export type GameModeCatalogId = GameMode | "career" | "dynasty";

export type GameModeDefinition = {
  id: GameModeCatalogId;
  name: string;
  description: string;
  features: string[];
  available: boolean;
  statusLabel: "Available" | "Coming Soon";
  href: string | null;
};

const OWNER_DEFINITION: GameModeDefinition = {
  id: "owner",
  name: "Owner Mode",
  description:
    "Own and operate a basketball franchise. Control franchise-level decisions, manage finances, and guide the organization over multiple seasons.",
  features: [
    "Franchise ownership and organizational decisions",
    "Finances, payroll, and cap management",
    "Staff, facilities, marketing, and sponsorships",
    "Multi-season franchise guidance",
    "League, schedule, and roster oversight",
  ],
  available: true,
  statusLabel: "Available",
  href: "/new/setup?mode=owner",
};

const CAREER_DEFINITION: GameModeDefinition = {
  id: "career",
  name: "Career Mode",
  description:
    "Player or staff career progression through the league. Not available yet.",
  features: [
    "Player or staff career path",
    "Season-to-season progression",
    "Role-based gameplay",
  ],
  available: false,
  statusLabel: "Coming Soon",
  href: null,
};

const DYNASTY_DEFINITION: GameModeDefinition = {
  id: "dynasty",
  name: "Dynasty Mode",
  description:
    "Long-horizon franchise legacy play across generations. Not available yet.",
  features: [
    "Multi-decade franchise legacy",
    "Long-horizon planning",
    "Dynasty milestones",
  ],
  available: false,
  statusLabel: "Coming Soon",
  href: null,
};

const BY_ID: Record<GameModeCatalogId, GameModeDefinition> = {
  owner: OWNER_DEFINITION,
  career: CAREER_DEFINITION,
  dynasty: DYNASTY_DEFINITION,
};

/** All modes shown on the mode-selection screen (available and coming soon). */
export function listGameModeDefinitions(): readonly GameModeDefinition[] {
  return [OWNER_DEFINITION, CAREER_DEFINITION, DYNASTY_DEFINITION];
}

/**
 * Resolve UI copy for a persisted GameMode only.
 * Never pass catalog-only ids ("career" | "dynasty") here.
 */
export function getGameModeDefinition(mode: GameMode): GameModeDefinition {
  return BY_ID[mode];
}
