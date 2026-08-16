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
  tagline: string;
  description: string;
  features: string[];
  available: boolean;
  statusLabel: "Available" | "Coming Soon";
  actionLabel: string;
  /** Mode-entry screen (Continue / Load / New Game). Null when coming soon. */
  entryHref: string | null;
  /** New-game setup destination. Null when coming soon. */
  href: string | null;
};

const OWNER_DEFINITION: GameModeDefinition = {
  id: "owner",
  name: "Owner Mode",
  tagline: "Run the franchise.",
  description:
    "Control the business. Make the decisions that shape your organization — finances, staff, facilities, marketing, and long-term franchise development.",
  features: [
    "Franchise ownership and organizational decisions",
    "Finances, payroll, and cap management",
    "Staff, facilities, marketing, and sponsorships",
    "Ticket pricing, fan sentiment, and media",
    "League economics and multi-season development",
  ],
  available: true,
  statusLabel: "Available",
  actionLabel: "Enter",
  entryHref: "/owner",
  href: "/new/setup?mode=owner",
};

const CAREER_DEFINITION: GameModeDefinition = {
  id: "career",
  name: "Career Mode",
  tagline: "Build your career.",
  description:
    "Start as a basketball professional and work your way through the league. Not available yet.",
  features: [
    "Player, coach, or general-manager path",
    "Personal decisions and reputation",
    "Career development and opportunities",
  ],
  available: false,
  statusLabel: "Coming Soon",
  actionLabel: "Coming Soon",
  entryHref: null,
  href: null,
};

const DYNASTY_DEFINITION: GameModeDefinition = {
  id: "dynasty",
  name: "Dynasty Mode",
  tagline: "Build something that lasts.",
  description:
    "Shape your franchise and create a legacy across generations. Not available yet.",
  features: [
    "Long-term franchise building",
    "Multiple eras and organizational legacy",
    "Historical records and generational progression",
  ],
  available: false,
  statusLabel: "Coming Soon",
  actionLabel: "Coming Soon",
  entryHref: null,
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
