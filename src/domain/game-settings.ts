/**
 * Canonical Owner Mode career configuration.
 * Settings describe how the league works; runtime state lives on other GameState slices.
 */

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

export type SimulationFrequency = "daily" | "weekly";
export type AiDifficulty = "easy" | "normal" | "hard";
export type LeagueArea = "north_america" | "europe" | "global";
export type DraftMode = "standard" | "fantasy";
export type LeagueHistoryMode = "new" | "generated";

export type GameSettings = {
  league: {
    teamCount: number;
    conferenceCount: number;
    divisionsEnabled: boolean;
    area?: LeagueArea;
  };
  injuriesEnabled: boolean;
  regularSeason: {
    gamesPerTeam: number;
  };
  playoffs: {
    playoffTeams: number;
    seriesLength: SeriesLength;
    playInEnabled: boolean;
  };
  simulation: {
    frequency: SimulationFrequency;
  };
  /**
   * AI difficulty is persisted for future consumption.
   * Current AI uses franchise profiles, not this slider.
   */
  ai: {
    difficulty: AiDifficulty;
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
};

/** Standard new-save defaults: 30 teams / 82 games / 16 playoff teams. */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  league: {
    teamCount: 30,
    conferenceCount: 2,
    divisionsEnabled: true,
    area: "north_america",
  },
  injuriesEnabled: true,
  regularSeason: {
    gamesPerTeam: 82,
  },
  playoffs: {
    playoffTeams: 16,
    seriesLength: 7,
    playInEnabled: false,
  },
  simulation: {
    frequency: "daily",
  },
  ai: {
    difficulty: "normal",
  },
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
};

/** Classic CBL: 12 teams / 22 games / 8 playoff teams. */
export const CBL_GAME_SETTINGS: GameSettings = {
  league: {
    teamCount: 12,
    conferenceCount: 2,
    divisionsEnabled: true,
    area: "north_america",
  },
  injuriesEnabled: true,
  regularSeason: {
    gamesPerTeam: 22,
  },
  playoffs: {
    playoffTeams: 8,
    seriesLength: 7,
    playInEnabled: false,
  },
  simulation: {
    frequency: "daily",
  },
  ai: {
    difficulty: "normal",
  },
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

export function cloneGameSettings(settings: GameSettings): GameSettings {
  return {
    league: { ...settings.league },
    injuriesEnabled: settings.injuriesEnabled ?? true,
    regularSeason: { ...settings.regularSeason },
    playoffs: { ...settings.playoffs },
    simulation: { ...settings.simulation },
    ai: { ...settings.ai },
    financialRules: { ...settings.financialRules },
    draft: { ...settings.draft },
    history: { ...settings.history },
  };
}
