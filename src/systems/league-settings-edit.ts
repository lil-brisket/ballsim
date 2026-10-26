/**
 * Mid-career edits to the league settings chosen at setup (Issue #191).
 *
 * Most rules are read live by the simulation, so a change applies from the
 * next time it is read. Two groups are guarded because other state was built
 * from them:
 * - Season format (games per team, playoff teams, series length) feeds the
 *   regular-season schedule and the playoff calendar, so it only changes
 *   before the next schedule is made.
 * - Restricted free agency drives qualifying offers and offer sheets, so it
 *   does not change while that offseason window is running.
 */

import {
  MANAGEMENT_PHASE_KEYS,
  isInjuryFrequency,
  isSupportedGamesPerTeam,
  isSupportedPlayoffTeamCount,
  isSupportedSeriesLength,
  isValidPhaseMode,
  type AiAssistancePhases,
  type GameSettings,
  type InjuryFrequency,
} from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";
import type { OffseasonStage } from "@/domain/entities/season";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnerTeamId,
  withOwnedFranchise,
} from "@/state/owner-context";
import { getActiveParticipant, isOnlineLeague } from "@/systems/participation";

export const LEAGUE_NAME_MAX_LENGTH = 60;

/** Settings the in-game Settings page may change. */
export type LeagueSettingsChanges = {
  injuryFrequency?: InjuryFrequency;
  seasonFormat?: {
    gamesPerTeam: number;
    playoffTeams: number;
    seriesLength: number;
  };
  financialRules?: Partial<
    Pick<
      GameSettings["financialRules"],
      | "salaryCapEnabled"
      | "salaryCap"
      | "staffBudget"
      | "luxuryTaxEnabled"
      | "salaryFloorEnabled"
      | "veteranRightsEnabled"
      | "revenueSharingEnabled"
    >
  >;
  draftLotteryEnabled?: boolean;
  restrictedFreeAgency?: boolean;
};

const FINANCIAL_TOGGLE_KEYS = [
  "salaryCapEnabled",
  "luxuryTaxEnabled",
  "salaryFloorEnabled",
  "veteranRightsEnabled",
  "revenueSharingEnabled",
] as const;

const FINANCIAL_AMOUNT_KEYS = ["salaryCap", "staffBudget"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Narrow an untrusted payload (form JSON) to {@link LeagueSettingsChanges}.
 * Unknown keys are dropped; known keys with the wrong type throw.
 */
export function parseLeagueSettingsChanges(
  raw: unknown,
): LeagueSettingsChanges {
  if (!isRecord(raw)) {
    throw new Error("Settings changes are invalid.");
  }
  const changes: LeagueSettingsChanges = {};
  if (raw.injuryFrequency !== undefined) {
    if (!isInjuryFrequency(raw.injuryFrequency)) {
      throw new Error("Injury frequency must be low, medium, or high.");
    }
    changes.injuryFrequency = raw.injuryFrequency;
  }
  if (raw.seasonFormat !== undefined) {
    const format = raw.seasonFormat;
    if (
      !isRecord(format) ||
      typeof format.gamesPerTeam !== "number" ||
      typeof format.playoffTeams !== "number" ||
      typeof format.seriesLength !== "number"
    ) {
      throw new Error("Season format is invalid.");
    }
    changes.seasonFormat = {
      gamesPerTeam: format.gamesPerTeam,
      playoffTeams: format.playoffTeams,
      seriesLength: format.seriesLength,
    };
  }
  if (raw.financialRules !== undefined) {
    const rules = raw.financialRules;
    if (!isRecord(rules)) {
      throw new Error("Financial rules are invalid.");
    }
    const financialRules: NonNullable<LeagueSettingsChanges["financialRules"]> =
      {};
    for (const key of FINANCIAL_TOGGLE_KEYS) {
      if (rules[key] === undefined) continue;
      if (typeof rules[key] !== "boolean") {
        throw new Error("Financial rules are invalid.");
      }
      financialRules[key] = rules[key];
    }
    for (const key of FINANCIAL_AMOUNT_KEYS) {
      if (rules[key] === undefined) continue;
      if (typeof rules[key] !== "number") {
        throw new Error("Financial rules are invalid.");
      }
      financialRules[key] = rules[key];
    }
    changes.financialRules = financialRules;
  }
  for (const key of ["draftLotteryEnabled", "restrictedFreeAgency"] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "boolean") {
      throw new Error("Settings changes are invalid.");
    }
    changes[key] = raw[key];
  }
  return changes;
}

/** Offseason stages from expiring contracts through free agency. */
const RFA_WINDOW_STAGES: readonly OffseasonStage[] = [
  "contract_expiration",
  "roster_decisions",
  "draft_preparation",
  "free_agency",
];

/** Null when the caller may change league-wide rules. */
export function leagueSettingsAccessError(state: GameState): string | null {
  if (isOnlineLeague(state) && getActiveParticipant(state)?.isHost !== true) {
    return "Only the league host can change this.";
  }
  return null;
}

/** True once this season's regular-season schedule has been made. */
function hasRegularSeasonSchedule(state: GameState): boolean {
  return state.competition.schedule.gameIds.some(
    (gameId) =>
      state.competition.games[gameId]?.competitionType === "regular_season",
  );
}

/** Null when season format may change; otherwise why it cannot. */
export function seasonFormatLockReason(state: GameState): string | null {
  if (hasRegularSeasonSchedule(state)) {
    return "Season format can change in the offseason, before next season's schedule is made.";
  }
  return null;
}

/** Null when restricted free agency may be toggled; otherwise why not. */
export function restrictedFreeAgencyLockReason(
  state: GameState,
): string | null {
  const season = state.competition.season;
  if (
    season.phase === "offseason" &&
    RFA_WINDOW_STAGES.includes(season.offseasonStage)
  ) {
    return "Restricted free agency can change after free agency ends.";
  }
  return null;
}

function assertSeasonFormat(
  state: GameState,
  format: NonNullable<LeagueSettingsChanges["seasonFormat"]>,
): void {
  if (!isSupportedGamesPerTeam(format.gamesPerTeam)) {
    throw new Error("Choose a supported number of games per team.");
  }
  if (!isSupportedPlayoffTeamCount(format.playoffTeams)) {
    throw new Error("Choose a supported number of playoff teams.");
  }
  const liveTeamCount = Object.keys(state.world.teams).length;
  if (format.playoffTeams > liveTeamCount) {
    throw new Error(
      `Playoff teams cannot exceed the ${liveTeamCount} teams in the league.`,
    );
  }
  if (!isSupportedSeriesLength(format.seriesLength)) {
    throw new Error("Series length must be 1, 3, 5, or 7.");
  }
}

function seasonFormatChanged(
  settings: GameSettings,
  format: NonNullable<LeagueSettingsChanges["seasonFormat"]>,
): boolean {
  return (
    settings.regularSeason.gamesPerTeam !== format.gamesPerTeam ||
    settings.playoffs.playoffTeams !== format.playoffTeams ||
    settings.playoffs.seriesLength !== format.seriesLength
  );
}

/**
 * Apply setting changes to a working state. Throws with a player-facing
 * message when a change is not allowed right now or is out of range.
 */
export function applyLeagueSettingsChanges(
  state: GameState,
  changes: LeagueSettingsChanges,
): GameState {
  const accessError = leagueSettingsAccessError(state);
  if (accessError) {
    throw new Error(accessError);
  }
  const settings = state.settings;
  const next: GameSettings = {
    ...settings,
    regularSeason: { ...settings.regularSeason },
    playoffs: { ...settings.playoffs },
    financialRules: { ...settings.financialRules },
    draftLottery: { ...settings.draftLottery },
    offseason: { ...settings.offseason },
  };

  if (changes.injuryFrequency !== undefined) {
    if (!isInjuryFrequency(changes.injuryFrequency)) {
      throw new Error("Injury frequency must be low, medium, or high.");
    }
    next.injuryFrequency = changes.injuryFrequency;
  }

  const format = changes.seasonFormat;
  if (format !== undefined && seasonFormatChanged(settings, format)) {
    const lock = seasonFormatLockReason(state);
    if (lock) {
      throw new Error(lock);
    }
    assertSeasonFormat(state, format);
    next.regularSeason.gamesPerTeam = format.gamesPerTeam;
    next.playoffs.playoffTeams = format.playoffTeams;
    next.playoffs.seriesLength =
      format.seriesLength as GameSettings["playoffs"]["seriesLength"];
  }

  if (changes.financialRules !== undefined) {
    Object.assign(next.financialRules, changes.financialRules);
  }

  if (changes.draftLotteryEnabled !== undefined) {
    next.draftLottery.enabled = changes.draftLotteryEnabled;
  }

  if (
    changes.restrictedFreeAgency !== undefined &&
    changes.restrictedFreeAgency !== settings.offseason.restrictedFreeAgency
  ) {
    const lock = restrictedFreeAgencyLockReason(state);
    if (lock) {
      throw new Error(lock);
    }
    next.offseason.restrictedFreeAgency = changes.restrictedFreeAgency;
  }

  const validated = validateGameSettings(next, { mode: "persisted" });
  if (!validated.ok) {
    throw new Error(validated.errors.join(" "));
  }
  return { ...state, settings: validated.settings };
}

export function renameLeague(state: GameState, rawName: string): GameState {
  const accessError = leagueSettingsAccessError(state);
  if (accessError) {
    throw new Error(accessError);
  }
  const name = rawName.trim().replace(/\s+/g, " ");
  if (name.length === 0) {
    throw new Error("League name cannot be empty.");
  }
  if (name.length > LEAGUE_NAME_MAX_LENGTH) {
    throw new Error(
      `League name must be ${LEAGUE_NAME_MAX_LENGTH} characters or fewer.`,
    );
  }
  return {
    ...state,
    world: { ...state.world, league: { ...state.world.league, name } },
  };
}

/**
 * Replace the active franchise's AI delegation. Per-franchise, so any
 * member of an online league may change their own.
 */
export function setActiveFranchiseAiAssistance(
  state: GameState,
  assistance: unknown,
): GameState {
  if (
    assistance === null ||
    typeof assistance !== "object" ||
    Array.isArray(assistance)
  ) {
    throw new Error("AI delegation is invalid.");
  }
  const record = assistance as Record<string, unknown>;
  const next = {} as Record<string, unknown>;
  for (const phase of MANAGEMENT_PHASE_KEYS) {
    if (!isValidPhaseMode(phase, record[phase])) {
      throw new Error("AI delegation is invalid.");
    }
    next[phase] = record[phase];
  }
  return withOwnedFranchise(state, getActiveOwnerTeamId(state), (current) => ({
    ...current,
    // Matches the setup form: any hand-picked delegation is a custom preset.
    managementPreset: "custom",
    aiAssistance: next as AiAssistancePhases,
  }));
}
