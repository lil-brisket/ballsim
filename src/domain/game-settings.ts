/**
 * Canonical Owner Mode career configuration.
 * Settings describe how the league works; runtime state lives on other GameState slices.
 */

import {
  DEFAULT_AI_MANAGEMENT_PRESET,
  type AiAssistancePhases,
  type AiManagementPreset,
} from "@/domain/ai-management-presets";
import { DEFAULT_DELEGATED_ASSISTANCE } from "@/domain/ai-management-delegation";

export type {
  AiAssistancePhases,
  AiManagementPreset,
  ManagementPhase,
  OperationalPhaseMode,
  TradesPhaseMode,
  DraftPhaseMode,
  BinaryPhaseMode,
  WaiversPhaseMode,
} from "@/domain/ai-management-presets";

export {
  MANAGEMENT_PHASE_KEYS,
  AI_MANAGEMENT_PRESETS,
  PRESET_PHASE_TABLES,
  DEFAULT_AI_ASSISTANCE_PHASES,
  DEFAULT_AI_MANAGEMENT_PRESET,
  applyPreset,
  inferPreset,
  resolveAssistancePhases,
  resolveAssistancePhasesLegacy,
  phasesEqual,
  isAiManagementPreset,
  isOperationalPhaseMode,
  isTradesPhaseMode,
  isDraftPhaseMode,
  isBinaryPhaseMode,
  isWaiversPhaseMode,
  isValidPhaseMode,
  MANAGEMENT_PHASE_LABELS,
  AI_MANAGEMENT_PRESET_LABELS,
} from "@/domain/ai-management-presets";

export {
  DEFAULT_DELEGATED_ASSISTANCE,
  PLAYER_VISIBLE_DELEGATION_PHASES,
  isPhaseDelegated,
  setPhaseDelegated,
  countDelegatedVisiblePhases,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";

export const SUPPORTED_TEAM_COUNTS = [8, 10, 12, 16, 20, 24, 30, 32] as const;
export type SupportedTeamCount = (typeof SUPPORTED_TEAM_COUNTS)[number];

export const SUPPORTED_GAMES_PER_TEAM = [
  14, 20, 22, 30, 40, 60, 72, 82,
] as const;
export type SupportedGamesPerTeam = (typeof SUPPORTED_GAMES_PER_TEAM)[number];

export const SUPPORTED_PLAYOFF_TEAM_COUNTS = [4, 6, 8, 12, 16] as const;
export type SupportedPlayoffTeamCount =
  (typeof SUPPORTED_PLAYOFF_TEAM_COUNTS)[number];

export const SUPPORTED_SERIES_LENGTHS = [1, 3, 5, 7] as const;
export type SeriesLength = (typeof SUPPORTED_SERIES_LENGTHS)[number];

/** UI / new-save conference counts. Engine may retain 4 on migrated saves. */
export const SUPPORTED_CONFERENCE_COUNTS_UI = [1, 2] as const;
export const SUPPORTED_CONFERENCE_COUNTS = [1, 2, 4] as const;
export type SupportedConferenceCount =
  (typeof SUPPORTED_CONFERENCE_COUNTS)[number];

/**
 * @deprecated Legacy save compatibility. Not user-configurable. Always "daily".
 * Advance pacing is a player control, not a league setting.
 */
export type SimulationFrequency = "daily" | "weekly";

/**
 * @deprecated Legacy save compatibility. Not user-configurable. Always "normal".
 */
export type AiDifficulty = "easy" | "normal" | "hard";

/**
 * How frequently players become injured during simulation.
 *
 * - `low` — injuries occur less frequently (very rare)
 * - `medium` — baseline / default injury rate
 * - `high` — injuries occur more frequently
 *
 * Persisted now but does not currently alter injury generation.
 * Future injury simulation work will consume this field.
 */
export type InjuryFrequency = "low" | "medium" | "high";

export const INJURY_FREQUENCIES = ["low", "medium", "high"] as const;

export const INJURY_FREQUENCY_LABELS: Record<InjuryFrequency, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * @deprecated Prefer {@link AiManagementPreset}. Kept for cheap v37→v38 mapping.
 */
export type AiManagementMode = "off" | "smart_assist" | "full_management";

/**
 * @deprecated Prefer {@link AiAssistancePhases}. Kept for cheap v37→v38 mapping.
 */
export type AiAssistDomainMode = "inherit" | "off" | "smart" | "full";

/**
 * @deprecated Prefer {@link AiAssistancePhases}.
 */
export type AiAssistanceDomains = {
  freeAgency: AiAssistDomainMode;
  draft: AiAssistDomainMode;
  contracts: AiAssistDomainMode;
  rosterFilling: AiAssistDomainMode;
  rotations: AiAssistDomainMode;
  staffHiring: AiAssistDomainMode;
  trades: AiAssistDomainMode;
  injuryReplacement: AiAssistDomainMode;
};

export type LeagueArea = "north_america" | "europe" | "global";
export type DraftMode = "standard" | "fantasy";
export type LeagueHistoryMode = "new" | "generated";

/** @deprecated Use MANAGEMENT_PHASE_KEYS. */
export const AI_ASSISTANCE_DOMAIN_KEYS = [
  "freeAgency",
  "draft",
  "contracts",
  "rosterFilling",
  "rotations",
  "staffHiring",
  "trades",
  "injuryReplacement",
] as const satisfies ReadonlyArray<keyof AiAssistanceDomains>;

/** @deprecated Use DEFAULT_AI_ASSISTANCE_PHASES. */
export const DEFAULT_AI_ASSISTANCE: AiAssistanceDomains = {
  freeAgency: "inherit",
  draft: "inherit",
  contracts: "inherit",
  rosterFilling: "inherit",
  rotations: "inherit",
  staffHiring: "inherit",
  trades: "inherit",
  injuryReplacement: "inherit",
};

/**
 * League-calendar rule for the trade deadline.
 * Not derived from schedule completion fraction — schedule remaining is urgency only.
 */
export type TradeDeadlineRule =
  | {
      kind: "days_after_season_start";
      daysAfterSeasonStart: number;
    }
  | {
      kind: "fraction_of_season_span";
      /** 0–1 along [regularSeasonStartDate, lastRegularSeasonGameDate]. */
      seasonSpanFraction: number;
    };

export type GameSettings = {
  league: {
    teamCount: number;
    conferenceCount: number;
    divisionsEnabled: boolean;
    area?: LeagueArea;
  };
  /**
   * Injury occurrence rate for future injury simulation.
   * Persisted now; not yet consumed by the sim engine.
   */
  injuryFrequency: InjuryFrequency;
  regularSeason: {
    gamesPerTeam: number;
    tradeDeadlineRule: TradeDeadlineRule;
  };
  playoffs: {
    playoffTeams: number;
    seriesLength: SeriesLength;
    /** @deprecated Legacy save compatibility. Not user-configurable. Always false. */
    playInEnabled: boolean;
  };
  simulation: {
    /** @deprecated Legacy save compatibility. Not user-configurable. Always "daily". */
    frequency: SimulationFrequency;
  };
  ai: {
    /** @deprecated Legacy save compatibility. Not user-configurable. Always "normal". */
    difficulty: AiDifficulty;
    /**
     * Legacy compatibility field. Canonical config is {@link assistance}.
     * Kept for migration of pre-v39 saves; policy/UI must not branch on this.
     */
    managementPreset: AiManagementPreset;
    /**
     * Canonical per-phase AI assistance modes.
     * Player UI exposes boolean delegation; modes remain policy internals.
     */
    assistance: AiAssistancePhases;
  };
  financialRules: {
    salaryCapEnabled: boolean;
    /** Persisted only; luxury tax engine is not implemented yet. */
    luxuryTaxEnabled: boolean;
    revenueSharingEnabled: boolean;
  };
  draft: {
    mode: DraftMode;
    userPickPosition: number | null;
    randomizeUserPick: boolean;
  };
  history: {
    mode: LeagueHistoryMode;
  };
  offseason: {
    freeAgency: {
      /** Canonical free-agency length. Always 30; not user-configurable. */
      durationDays: number;
      allowExtension: boolean;
    };
  };
};

export const DEFAULT_OFFSEASON_SETTINGS: GameSettings["offseason"] = {
  freeAgency: {
    durationDays: 30,
    allowExtension: true,
  },
};

function defaultAiSettings(): GameSettings["ai"] {
  return {
    difficulty: "normal",
    managementPreset: DEFAULT_AI_MANAGEMENT_PRESET,
    assistance: { ...DEFAULT_DELEGATED_ASSISTANCE },
  };
}

/** Standard new-save defaults: 30 teams / 82 games / 16 playoff teams. */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  league: {
    teamCount: 30,
    conferenceCount: 2,
    divisionsEnabled: true,
    area: "north_america",
  },
  injuryFrequency: "medium",
  regularSeason: {
    gamesPerTeam: 82,
    tradeDeadlineRule: {
      kind: "fraction_of_season_span",
      seasonSpanFraction: 0.55,
    },
  },
  playoffs: {
    playoffTeams: 16,
    seriesLength: 7,
    playInEnabled: false,
  },
  simulation: {
    frequency: "daily",
  },
  ai: defaultAiSettings(),
  financialRules: {
    salaryCapEnabled: true,
    luxuryTaxEnabled: true,
    revenueSharingEnabled: true,
  },
  draft: {
    mode: "standard",
    userPickPosition: null,
    randomizeUserPick: false,
  },
  history: {
    mode: "new",
  },
  offseason: {
    freeAgency: {
      durationDays: DEFAULT_OFFSEASON_SETTINGS.freeAgency.durationDays,
      allowExtension: DEFAULT_OFFSEASON_SETTINGS.freeAgency.allowExtension,
    },
  },
};

/** Classic CBL: 12 teams / 22 games / 8 playoff teams. */
export const CBL_GAME_SETTINGS: GameSettings = {
  league: {
    teamCount: 12,
    conferenceCount: 2,
    divisionsEnabled: true,
    area: "north_america",
  },
  injuryFrequency: "medium",
  regularSeason: {
    gamesPerTeam: 22,
    tradeDeadlineRule: {
      kind: "fraction_of_season_span",
      seasonSpanFraction: 0.55,
    },
  },
  playoffs: {
    playoffTeams: 8,
    seriesLength: 7,
    playInEnabled: false,
  },
  simulation: {
    frequency: "daily",
  },
  ai: defaultAiSettings(),
  financialRules: {
    salaryCapEnabled: true,
    luxuryTaxEnabled: true,
    revenueSharingEnabled: true,
  },
  draft: {
    mode: "standard",
    userPickPosition: null,
    randomizeUserPick: false,
  },
  history: {
    mode: "new",
  },
  offseason: {
    freeAgency: {
      durationDays: DEFAULT_OFFSEASON_SETTINGS.freeAgency.durationDays,
      allowExtension: DEFAULT_OFFSEASON_SETTINGS.freeAgency.allowExtension,
    },
  },
};

/** Wins required to clinch a best-of-N series. */
export function seriesWinsToClinch(seriesLength: SeriesLength): number {
  return (seriesLength + 1) / 2;
}

export function isSupportedTeamCount(
  value: number,
): value is SupportedTeamCount {
  return (SUPPORTED_TEAM_COUNTS as readonly number[]).includes(value);
}

export function isSupportedGamesPerTeam(
  value: number,
): value is SupportedGamesPerTeam {
  return (SUPPORTED_GAMES_PER_TEAM as readonly number[]).includes(value);
}

export function isSupportedPlayoffTeamCount(
  value: number,
): value is SupportedPlayoffTeamCount {
  return (SUPPORTED_PLAYOFF_TEAM_COUNTS as readonly number[]).includes(value);
}

export function isSupportedSeriesLength(
  value: number,
): value is SeriesLength {
  return (SUPPORTED_SERIES_LENGTHS as readonly number[]).includes(value);
}

export function isSupportedConferenceCount(
  value: number,
): value is SupportedConferenceCount {
  return (SUPPORTED_CONFERENCE_COUNTS as readonly number[]).includes(value);
}

export function isSimulationFrequency(
  value: unknown,
): value is SimulationFrequency {
  return value === "daily" || value === "weekly";
}

export function isAiDifficulty(value: unknown): value is AiDifficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

export function isInjuryFrequency(value: unknown): value is InjuryFrequency {
  return value === "low" || value === "medium" || value === "high";
}

export function isAiManagementMode(value: unknown): value is AiManagementMode {
  return (
    value === "off" || value === "smart_assist" || value === "full_management"
  );
}

export function isAiAssistDomainMode(
  value: unknown,
): value is AiAssistDomainMode {
  return (
    value === "inherit" ||
    value === "off" ||
    value === "smart" ||
    value === "full"
  );
}

/**
 * Map legacy v37 managementMode to a v38 preset.
 * Cheap migration only — no extensive legacy matrix.
 */
export function legacyManagementModeToPreset(
  mode: AiManagementMode | undefined,
): Exclude<AiManagementPreset, "custom"> {
  switch (mode) {
    case "off":
      return "off";
    case "full_management":
      return "full_management";
    case "smart_assist":
      return "smart";
    default:
      return "continuity";
  }
}

export function isLeagueArea(value: unknown): value is LeagueArea {
  return value === "north_america" || value === "europe" || value === "global";
}

export function isDraftMode(value: unknown): value is DraftMode {
  return value === "standard" || value === "fantasy";
}

export function isLeagueHistoryMode(
  value: unknown,
): value is LeagueHistoryMode {
  return value === "new" || value === "generated";
}

export const DEFAULT_TRADE_DEADLINE_RULE: TradeDeadlineRule = {
  kind: "fraction_of_season_span",
  seasonSpanFraction: 0.55,
};

export function isTradeDeadlineRule(
  value: unknown,
): value is TradeDeadlineRule {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  if (raw.kind === "days_after_season_start") {
    return (
      typeof raw.daysAfterSeasonStart === "number" &&
      Number.isInteger(raw.daysAfterSeasonStart) &&
      raw.daysAfterSeasonStart >= 0
    );
  }
  if (raw.kind === "fraction_of_season_span") {
    return (
      typeof raw.seasonSpanFraction === "number" &&
      raw.seasonSpanFraction >= 0 &&
      raw.seasonSpanFraction <= 1
    );
  }
  return false;
}

export function cloneGameSettings(settings: GameSettings): GameSettings {
  return {
    league: { ...settings.league },
    injuryFrequency: settings.injuryFrequency ?? "medium",
    regularSeason: {
      ...settings.regularSeason,
      tradeDeadlineRule: { ...settings.regularSeason.tradeDeadlineRule },
    },
    playoffs: { ...settings.playoffs },
    simulation: { ...settings.simulation },
    ai: {
      ...settings.ai,
      assistance: { ...settings.ai.assistance },
    },
    financialRules: { ...settings.financialRules },
    draft: { ...settings.draft },
    history: { ...settings.history },
    offseason: {
      freeAgency: { ...settings.offseason.freeAgency },
    },
  };
}
