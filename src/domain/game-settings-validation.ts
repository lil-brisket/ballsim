import {
  AI_ASSISTANCE_DOMAIN_KEYS,
  DEFAULT_AI_ASSISTANCE,
  DEFAULT_OFFSEASON_SETTINGS,
  DEFAULT_TRADE_DEADLINE_RULE,
  isAiAssistDomainMode,
  isAiManagementMode,
  isAiManagementPreset,
  isDraftMode,
  isInjuryFrequency,
  isLeagueArea,
  isLeagueHistoryMode,
  isSupportedConferenceCount,
  isSupportedGamesPerTeam,
  isSupportedPlayoffTeamCount,
  isSupportedSeriesLength,
  isSupportedTeamCount,
  isTradeDeadlineRule,
  isValidPhaseMode,
  legacyManagementModeToPreset,
  applyPreset,
  DEFAULT_AI_MANAGEMENT_PRESET,
  DEFAULT_DELEGATED_ASSISTANCE,
  MANAGEMENT_PHASE_KEYS,
  type AiAssistanceDomains,
  type AiAssistancePhases,
  type AiManagementPreset,
  type GameSettings,
  type InjuryFrequency,
  type ManagementPhase,
  type TradeDeadlineRule,
} from "@/domain/game-settings";
import { tryResolveLeagueShape } from "@/domain/league-shape";

export type GameSettingsValidationResult =
  | { ok: true; settings: GameSettings }
  | { ok: false; errors: string[] };

export type ValidateGameSettingsOptions = {
  /**
   * `newSave` (default): teamCount must be in the supported UI list.
   * `persisted`: any integer teamCount >= 4 that resolves a league shape
   * (fixtures / migrated odd sizes).
   */
  mode?: "newSave" | "persisted";
};

/**
 * Domain-authoritative settings validation.
 * UI should display errors from this function; do not re-implement rules in components.
 */
export function validateGameSettings(
  settings: unknown,
  options: ValidateGameSettingsOptions = {},
): GameSettingsValidationResult {
  const mode = options.mode ?? "newSave";
  const errors: string[] = [];

  if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
    return { ok: false, errors: ["settings must be an object."] };
  }

  const raw = settings as Record<string, unknown>;
  const league = asRecord(raw.league, "league", errors);
  const regularSeason = asRecord(raw.regularSeason, "regularSeason", errors);
  const playoffs = asRecord(raw.playoffs, "playoffs", errors);
  const simulation = asRecord(raw.simulation, "simulation", errors);
  const ai = asRecord(raw.ai, "ai", errors);
  const financialRules = asRecord(raw.financialRules, "financialRules", errors);
  const draft =
    raw.draft === undefined ? {} : asRecord(raw.draft, "draft", errors);
  const history =
    raw.history === undefined ? {} : asRecord(raw.history, "history", errors);
  const offseason =
    raw.offseason === undefined
      ? null
      : asRecord(raw.offseason, "offseason", errors);

  if (
    errors.length > 0 ||
    !league ||
    !regularSeason ||
    !playoffs ||
    !simulation ||
    !ai ||
    !financialRules ||
    !draft ||
    !history ||
    (raw.offseason !== undefined && !offseason)
  ) {
    return { ok: false, errors };
  }

  const teamCount = league.teamCount;
  if (mode === "newSave") {
    if (typeof teamCount !== "number" || !isSupportedTeamCount(teamCount)) {
      errors.push(
        `league.teamCount must be one of ${[8, 10, 12, 16, 20, 24, 30, 32].join(", ")}.`,
      );
    }
  } else if (
    typeof teamCount !== "number" ||
    !Number.isInteger(teamCount) ||
    teamCount < 2
  ) {
    errors.push("league.teamCount must be an integer >= 2.");
  }

  const conferenceCount = league.conferenceCount;
  if (
    typeof conferenceCount !== "number" ||
    !isSupportedConferenceCount(conferenceCount)
  ) {
    errors.push("league.conferenceCount must be 1, 2, or 4.");
  }

  const divisionsEnabled = league.divisionsEnabled;
  if (typeof divisionsEnabled !== "boolean") {
    errors.push("league.divisionsEnabled must be a boolean.");
  }

  if (league.area !== undefined && !isLeagueArea(league.area)) {
    errors.push(
      'league.area must be "north_america", "europe", "africa", "asia", "south_america", or "global".',
    );
  }

  const injuryFrequency = resolveInjuryFrequency(raw);

  const gamesPerTeam = regularSeason.gamesPerTeam;
  if (typeof gamesPerTeam !== "number" || !isSupportedGamesPerTeam(gamesPerTeam)) {
    errors.push(
      `regularSeason.gamesPerTeam must be one of ${[14, 20, 22, 30, 40, 60, 72, 82].join(", ")}.`,
    );
  }

  let tradeDeadlineRule: TradeDeadlineRule = DEFAULT_TRADE_DEADLINE_RULE;
  if (regularSeason.tradeDeadlineRule !== undefined) {
    if (!isTradeDeadlineRule(regularSeason.tradeDeadlineRule)) {
      errors.push(
        'regularSeason.tradeDeadlineRule must be { kind: "days_after_season_start", daysAfterSeasonStart } or { kind: "fraction_of_season_span", seasonSpanFraction }.',
      );
    } else {
      tradeDeadlineRule = regularSeason.tradeDeadlineRule;
    }
  }

  const playoffTeams = playoffs.playoffTeams;
  if (typeof playoffTeams !== "number" || !Number.isInteger(playoffTeams)) {
    errors.push("playoffs.playoffTeams must be an integer.");
  } else if (mode === "newSave") {
    if (!isSupportedPlayoffTeamCount(playoffTeams)) {
      errors.push(
        `playoffs.playoffTeams must be one of ${[4, 6, 8, 12, 16].join(", ")}.`,
      );
    }
  } else if (
    playoffTeams < 0 ||
    (playoffTeams > 0 &&
      !isSupportedPlayoffTeamCount(playoffTeams) &&
      playoffTeams !== teamCount)
  ) {
    if (typeof teamCount === "number" && playoffTeams !== teamCount) {
      errors.push(
        `playoffs.playoffTeams must be a supported size or equal teamCount for legacy saves.`,
      );
    }
  }

  const seriesLength = playoffs.seriesLength;
  if (typeof seriesLength !== "number" || !isSupportedSeriesLength(seriesLength)) {
    errors.push("playoffs.seriesLength must be 1, 3, 5, or 7.");
  }

  // Canonical invariants: these fields are not user-configurable.
  // Input values are ignored; validated output always uses fixed values.
  const playInEnabled = false;
  const frequency = "daily" as const;
  const difficulty = "normal" as const;

  const { managementPreset, assistance } = resolveAiSettings(ai, errors);

  let freeAgencyAllowExtension =
    DEFAULT_OFFSEASON_SETTINGS.freeAgency.allowExtension;
  if (offseason !== null) {
    const freeAgency =
      offseason.freeAgency === undefined
        ? null
        : asRecord(offseason.freeAgency, "offseason.freeAgency", errors);
    if (freeAgency) {
      if (freeAgency.allowExtension !== undefined) {
        if (typeof freeAgency.allowExtension !== "boolean") {
          errors.push(
            "offseason.freeAgency.allowExtension must be a boolean.",
          );
        } else {
          freeAgencyAllowExtension = freeAgency.allowExtension;
        }
      }
    }
  }
  const freeAgencyDurationDays =
    DEFAULT_OFFSEASON_SETTINGS.freeAgency.durationDays;

  const salaryCapEnabled = financialRules.salaryCapEnabled;
  const luxuryTaxEnabled = financialRules.luxuryTaxEnabled;
  const revenueSharingEnabled = financialRules.revenueSharingEnabled;
  if (typeof salaryCapEnabled !== "boolean") {
    errors.push("financialRules.salaryCapEnabled must be a boolean.");
  }
  if (typeof luxuryTaxEnabled !== "boolean") {
    errors.push("financialRules.luxuryTaxEnabled must be a boolean.");
  }
  if (typeof revenueSharingEnabled !== "boolean") {
    errors.push("financialRules.revenueSharingEnabled must be a boolean.");
  }

  const draftMode = draft.mode;
  const userPickPosition = draft.userPickPosition;
  const randomizeUserPick = draft.randomizeUserPick;
  if (draftMode !== undefined && !isDraftMode(draftMode)) {
    errors.push('draft.mode must be "standard" or "fantasy".');
  }
  if (
    userPickPosition !== undefined &&
    userPickPosition !== null &&
    (typeof userPickPosition !== "number" ||
      !Number.isInteger(userPickPosition) ||
      userPickPosition < 1 ||
      (typeof teamCount === "number" && userPickPosition > teamCount))
  ) {
    errors.push("draft.userPickPosition must be null or within the league.");
  }
  if (
    randomizeUserPick !== undefined &&
    typeof randomizeUserPick !== "boolean"
  ) {
    errors.push("draft.randomizeUserPick must be a boolean.");
  }
  if (
    draftMode === "standard" &&
    userPickPosition !== undefined &&
    userPickPosition !== null
  ) {
    errors.push("draft.userPickPosition requires fantasy draft mode.");
  }
  if (draftMode === "standard" && randomizeUserPick === true) {
    errors.push("draft.randomizeUserPick requires fantasy draft mode.");
  }

  if (history.mode !== undefined && !isLeagueHistoryMode(history.mode)) {
    errors.push('history.mode must be "new" or "generated".');
  }

  if (
    typeof teamCount === "number" &&
    typeof playoffTeams === "number" &&
    Number.isInteger(teamCount) &&
    Number.isInteger(playoffTeams) &&
    playoffTeams > teamCount
  ) {
    errors.push(
      `playoffs.playoffTeams (${playoffTeams}) cannot exceed league.teamCount (${teamCount}).`,
    );
  }

  if (
    typeof teamCount === "number" &&
    typeof conferenceCount === "number" &&
    typeof divisionsEnabled === "boolean" &&
    Number.isInteger(teamCount) &&
    teamCount >= 2 &&
    isSupportedConferenceCount(conferenceCount)
  ) {
    if (teamCount % conferenceCount !== 0) {
      errors.push(
        `league.teamCount (${teamCount}) must be divisible by conferenceCount (${conferenceCount}).`,
      );
    } else {
      const shape = tryResolveLeagueShape({
        teamCount,
        conferenceCount,
        divisionsEnabled,
      });
      if (!shape.ok) {
        errors.push(shape.error);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const validated: GameSettings = {
    league: {
      teamCount: teamCount as number,
      conferenceCount: conferenceCount as number,
      divisionsEnabled: divisionsEnabled as boolean,
      area: (league.area as GameSettings["league"]["area"] | undefined) ??
        "north_america",
    },
    injuryFrequency,
    regularSeason: {
      gamesPerTeam: gamesPerTeam as number,
      tradeDeadlineRule,
    },
    playoffs: {
      playoffTeams: playoffTeams as number,
      seriesLength: seriesLength as GameSettings["playoffs"]["seriesLength"],
      playInEnabled,
    },
    simulation: {
      frequency,
    },
    ai: {
      difficulty,
      managementPreset,
      assistance,
    },
    financialRules: {
      salaryCapEnabled: salaryCapEnabled as boolean,
      luxuryTaxEnabled: luxuryTaxEnabled as boolean,
      revenueSharingEnabled: revenueSharingEnabled as boolean,
    },
    draft: {
      mode: (draftMode as GameSettings["draft"]["mode"] | undefined) ?? "standard",
      userPickPosition: (userPickPosition as number | null | undefined) ?? null,
      randomizeUserPick: (randomizeUserPick as boolean | undefined) ?? false,
    },
    history: {
      mode:
        (history.mode as GameSettings["history"]["mode"] | undefined) ?? "new",
    },
    offseason: {
      freeAgency: {
        durationDays: freeAgencyDurationDays,
        allowExtension: freeAgencyAllowExtension,
      },
    },
  };

  return { ok: true, settings: validated };
}

/**
 * Resolve injury frequency from canonical or legacy payload fields.
 *
 * 1. Valid `injuryFrequency` → use it
 * 2. Legacy `injuriesEnabled: false` → "low" (intentional: old "off" → very rare)
 * 3. Legacy `injuriesEnabled: true` → "medium"
 * 4. Invalid / missing → "medium"
 */
function resolveInjuryFrequency(raw: Record<string, unknown>): InjuryFrequency {
  if (isInjuryFrequency(raw.injuryFrequency)) {
    return raw.injuryFrequency;
  }
  if (raw.injuriesEnabled === false) {
    return "low";
  }
  if (raw.injuriesEnabled === true) {
    return "medium";
  }
  return "medium";
}

function resolveAiSettings(
  ai: Record<string, unknown>,
  errors: string[],
): { managementPreset: AiManagementPreset; assistance: AiAssistancePhases } {
  let managementPreset: AiManagementPreset = DEFAULT_AI_MANAGEMENT_PRESET;

  if (ai.managementPreset !== undefined) {
    if (!isAiManagementPreset(ai.managementPreset)) {
      errors.push(
        'ai.managementPreset must be "off", "continuity", "smart", "full_management", or "custom".',
      );
    } else {
      managementPreset = ai.managementPreset;
    }
  } else if (ai.managementMode !== undefined) {
    // Cheap legacy acceptance during validation of pre-v38 payloads.
    if (!isAiManagementMode(ai.managementMode)) {
      errors.push(
        'ai.managementMode must be "off", "smart_assist", or "full_management".',
      );
    } else {
      managementPreset = legacyManagementModeToPreset(ai.managementMode);
    }
  }

  // Default base: named presets expand from tables; custom uses delegation defaults.
  let assistance: AiAssistancePhases =
    managementPreset === "custom"
      ? { ...DEFAULT_DELEGATED_ASSISTANCE }
      : applyPreset(managementPreset);

  if (ai.assistance !== undefined) {
    const assistanceRecord = asRecord(ai.assistance, "ai.assistance", errors);
    if (assistanceRecord) {
      // Phase-keyed shape is canonical — use it as the source of truth.
      if (MANAGEMENT_PHASE_KEYS.some((key) => key in assistanceRecord)) {
        const next = { ...assistance };
        for (const key of MANAGEMENT_PHASE_KEYS) {
          const value = assistanceRecord[key];
          if (value === undefined) {
            continue;
          }
          if (!isValidPhaseMode(key, value)) {
            errors.push(`ai.assistance.${key} has an invalid mode.`);
          } else {
            (next as Record<string, string>)[key] = value as string;
          }
        }
        assistance = next;
      } else {
        // Legacy domain keys — map cheaply into phases for migration acceptance.
        const legacy = parseLegacyAssistance(assistanceRecord, errors);
        assistance = mapLegacyDomainsToPhases(managementPreset, legacy);
      }
    }
  } else if (managementPreset !== "custom") {
    assistance = applyPreset(managementPreset);
  }

  return { managementPreset, assistance };
}

function parseLegacyAssistance(
  record: Record<string, unknown>,
  errors: string[],
): AiAssistanceDomains {
  const next: Partial<AiAssistanceDomains> = {};
  for (const key of AI_ASSISTANCE_DOMAIN_KEYS) {
    const value = record[key];
    if (value === undefined) {
      next[key] = "inherit";
      continue;
    }
    if (!isAiAssistDomainMode(value)) {
      errors.push(
        `ai.assistance.${key} must be "inherit", "off", "smart", or "full".`,
      );
    } else {
      next[key] = value;
    }
  }
  return { ...DEFAULT_AI_ASSISTANCE, ...next } as AiAssistanceDomains;
}

/**
 * Cheap legacy domain → phase mapping for validation of pre-v38 payloads.
 */
function mapLegacyDomainsToPhases(
  preset: AiManagementPreset,
  legacy: AiAssistanceDomains,
): AiAssistancePhases {
  const base =
    preset === "custom"
      ? applyPreset("continuity")
      : applyPreset(preset);

  const mapDomain = (
    mode: AiAssistanceDomains[keyof AiAssistanceDomains],
  ): "off" | "continuity" | "routine" | "full" => {
    if (mode === "inherit") {
      return "continuity";
    }
    if (mode === "off") {
      return "off";
    }
    if (mode === "smart") {
      return "continuity";
    }
    return "full";
  };

  return {
    ...base,
    freeAgency: mapDomain(legacy.freeAgency),
    injuriesEmergencyRoster: mapDomain(
      legacy.injuryReplacement !== "inherit"
        ? legacy.injuryReplacement
        : legacy.rosterFilling,
    ),
    rotationsDepthChart: mapDomain(legacy.rotations),
    contracts: mapDomain(legacy.contracts),
    coachingStaff: mapDomain(legacy.staffHiring),
    frontOfficeStaff: mapDomain(legacy.staffHiring),
    draftSelection:
      legacy.draft === "off"
        ? "off"
        : legacy.draft === "full"
          ? "full"
          : legacy.draft === "smart"
            ? "recommend"
            : base.draftSelection,
    trades:
      legacy.trades === "full"
        ? "full"
        : legacy.trades === "off"
          ? "off"
          : base.trades,
  };
}

function asRecord(
  value: unknown,
  path: string,
  errors: string[],
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  return value as Record<string, unknown>;
}
