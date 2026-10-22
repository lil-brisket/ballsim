import { type GameState, EMPTY_AI_ASSIST_STATE } from "@/state/game-state";
import {
  type GameSettings,
  type AiManagementMode,
  type AiAssistanceDomains,
  type AiManagementPreset,
  type AiAssistancePhases,
  legacyManagementModeToPreset,
  applyPreset,
  resolveAssistancePhasesLegacy,
} from "@/domain/game-settings";
import {
  type TeamBranding,
  resolvePaletteIdFromBranding,
} from "@/domain/entities/team-branding";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";
import { paletteLogoKey } from "@/domain/team-identity";
import {
  type CompetitionSlicePreV49,
  legacyUserRecord,
  backfillSnapshotBranding,
} from "@/persistence/mappers/game-state-migrations/shared";
import type { UserSliceV26ToV40 } from "@/persistence/mappers/game-state-migrations/v24-v33";
import type { GameStateV42 } from "@/persistence/mappers/game-state-migrations/v42-v47";

export type GameStateV34 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 34;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: Omit<GameState["business"], "gameArchive" | "playerHistory">;
  user: UserSliceV26ToV40;
};

export type GameStateV35 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 35;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: Omit<GameState["business"], "gameArchive" | "playerHistory"> & {
    gameArchive?: GameState["business"]["gameArchive"];
    playerHistory?: GameState["business"]["playerHistory"];
  };
  user: UserSliceV26ToV40;
};

export type GameStateV36 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 36;
  };
  settings: Omit<GameState["settings"], "offseason" | "ai"> & {
    ai: {
      difficulty: GameSettings["ai"]["difficulty"];
      managementMode?: AiManagementMode;
      assistance?: Partial<AiAssistanceDomains>;
    };
    offseason?: GameState["settings"]["offseason"];
  };
  world: GameState["world"];
  competition: {
    season: Omit<
      GameState["competition"]["season"],
      "offseasonStageEnteredDate" | "freeAgencyExtendedUntil"
    > & {
      offseasonStageEnteredDate?: string | null;
      freeAgencyExtendedUntil?: string | null;
    };
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
  };
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

export type GameStateV37 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 37;
  };
  settings: Omit<GameState["settings"], "ai"> & {
    ai: {
      difficulty: GameSettings["ai"]["difficulty"];
      managementMode: AiManagementMode;
      assistance: AiAssistanceDomains;
    };
  };
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

export type GameStateV38 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 38;
  };
  settings: Omit<GameState["settings"], "ai"> & {
    ai: {
      difficulty: GameSettings["ai"]["difficulty"];
      managementPreset: AiManagementPreset;
      assistance: AiAssistancePhases;
    };
  };
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

export type GameStateV39 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 39;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

export type GameStateV40 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 40;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v34 → v35: box-score historical identity fields on Game.
 * - competitionType inferred from id prefix only (playoff_/playin_ → playoffs)
 * - team snapshots null (do not backfill from live world.teams)
 * - playerStats teamId/firstName/lastName null (do not backfill from current roster)
 * Emits schemaVersion 35. No RNG.
 */
export function migrateV34ToV35(state: GameStateV34): GameStateV35 {
  const games: GameState["competition"]["games"] = {};
  for (const [gameId, game] of Object.entries(state.competition.games)) {
    const raw = game as typeof game & {
      competitionType?: string;
      homeTeamSnapshot?: unknown;
      awayTeamSnapshot?: unknown;
      playerStats: Array<
        (typeof game.playerStats)[number] & {
          teamId?: string | null;
          firstName?: string | null;
          lastName?: string | null;
        }
      >;
    };
    const competitionType =
      raw.competitionType === "regular_season" ||
      raw.competitionType === "playoffs" ||
      raw.competitionType === "preseason"
        ? raw.competitionType
        : gameId.startsWith("playoff_") || gameId.startsWith("playin_")
          ? "playoffs"
          : gameId.startsWith("game_pre_")
            ? "preseason"
            : "regular_season";

    games[gameId] = {
      ...raw,
      competitionType,
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
      playerStats: raw.playerStats.map((row) => ({
        ...row,
        teamId: null,
        firstName: null,
        lastName: null,
      })),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 35,
    },
    competition: {
      ...state.competition,
      games,
    },
  };
}

/**
 * Deterministic v35 → v36: player history + game archive.
 * Defaults empty; no backfill of prior seasons.
 * Emits schemaVersion 36. No RNG.
 */
export function migrateV35ToV36(state: GameStateV35): GameStateV36 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 36,
    },
    business: {
      ...state.business,
      gameArchive: state.business.gameArchive ?? {},
      playerHistory: state.business.playerHistory ?? {},
    },
  } as unknown as GameStateV36;
}

/**
 * Deterministic v36 → v37: offseason stage dates, AI assist settings,
 * free-agency duration settings, explicit decisions / phase skips.
 * Emits schemaVersion 37. No RNG.
 */
export function migrateV36ToV37(state: GameStateV36): GameStateV37 {
  const season = state.competition.season;
  const inOffseasonStage =
    season.phase === "offseason" && season.offseasonStage !== "none";
  const offseasonStageEnteredDate =
    season.offseasonStageEnteredDate !== undefined
      ? season.offseasonStageEnteredDate
      : inOffseasonStage
        ? state.world.calendar.currentDate
        : null;

  const previousAi = state.settings.ai;
  const ai = {
    difficulty: previousAi.difficulty,
    managementMode: previousAi.managementMode ?? ("smart_assist" as const),
    assistance: {
      freeAgency: previousAi.assistance?.freeAgency ?? ("inherit" as const),
      draft: previousAi.assistance?.draft ?? ("inherit" as const),
      contracts: previousAi.assistance?.contracts ?? ("inherit" as const),
      rosterFilling:
        previousAi.assistance?.rosterFilling ?? ("inherit" as const),
      rotations: previousAi.assistance?.rotations ?? ("inherit" as const),
      staffHiring: previousAi.assistance?.staffHiring ?? ("inherit" as const),
      trades: previousAi.assistance?.trades ?? ("inherit" as const),
      injuryReplacement:
        previousAi.assistance?.injuryReplacement ?? ("inherit" as const),
    },
  };

  const offseason = {
    freeAgency: {
      durationDays: state.settings.offseason?.freeAgency.durationDays ?? 30,
      allowExtension:
        state.settings.offseason?.freeAgency.allowExtension ?? true,
    },
  };

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 37,
    },
    settings: {
      ...state.settings,
      ai,
      // Pre-v73 shape: restrictedFreeAgency arrives in the v72 -> v73 step.
      offseason: offseason as GameState["settings"]["offseason"],
    },
    competition: {
      ...state.competition,
      season: {
        ...season,
        offseasonStageEnteredDate,
        freeAgencyExtendedUntil: season.freeAgencyExtendedUntil ?? null,
      },
      seasonEventLog:
        (
          state.competition as {
            seasonEventLog?: GameState["competition"]["seasonEventLog"];
          }
        ).seasonEventLog ?? [],
    } as unknown as CompetitionSlicePreV49,
    user: {
      ...state.user,
      explicitDecisions: state.user.explicitDecisions ?? {},
      phaseSkips: state.user.phaseSkips ?? [],
    },
  };
}

/**
 * Deterministic v37 → v38: phase-based management presets + aiAssistState.
 * Cheap mapping: smart_assist → smart preset. No RNG.
 */
export function migrateV37ToV38(state: GameStateV37): GameStateV38 {
  const userRecord = legacyUserRecord(state.user);
  const preset = legacyManagementModeToPreset(state.settings.ai.managementMode);
  const assistance = applyPreset(preset);

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 38,
    },
    settings: {
      ...state.settings,
      ai: {
        difficulty: state.settings.ai.difficulty,
        managementPreset: preset,
        assistance,
      },
    },
    user: {
      ...state.user,
      aiAssistState: userRecord.aiAssistState ?? {
        resolvedNeeds: {},
        seasonCounters: { ...EMPTY_AI_ASSIST_STATE.seasonCounters },
      },
    },
  };
}

/**
 * Deterministic v38 → v39: make assistance canonical for delegation UI.
 * Preserves exact phase modes (no upgrade to full). Preset kept for audit only.
 */
export function migrateV38ToV39(state: GameStateV38): GameStateV39 {
  const assistance = resolveAssistancePhasesLegacy(
    state.settings.ai.managementPreset,
    state.settings.ai.assistance,
  );

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 39,
    },
    settings: {
      ...state.settings,
      ai: {
        difficulty: state.settings.ai.difficulty,
        // Keep last preset name for audit; policy/UI use assistance only.
        managementPreset: state.settings.ai.managementPreset,
        assistance,
      },
    },
  };
}

/**
 * Deterministic v39 → v40: owner decision queue + history for sim interrupts.
 */
export function migrateV39ToV40(state: GameStateV39): GameStateV40 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 40,
    },
    user: {
      ...state.user,
      pendingOwnerDecisions: state.user.pendingOwnerDecisions ?? [],
      ownerDecisionHistory: state.user.ownerDecisionHistory ?? [],
    },
  };
}

/**
 * Deterministic v40 → v41: city selection confirmation flag for new-game pick.
 * Existing saves already past team pick are treated as confirmed.
 */
export function migrateV40ToV41(state: GameStateV40): GameStateV41 {
  const locked = state.world.calendar.lastSimulatedDate !== null;
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 41,
    },
    user: {
      ...state.user,
      citySelectionConfirmed: state.user.citySelectionConfirmed ?? locked,
    },
  } as unknown as GameStateV41;
}

type TeamV41 = {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  branding?: TeamBranding;
  [key: string]: unknown;
};

export type GameTeamSnapshotV41 = {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  branding?: TeamBranding;
};

export type GameStateV41 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 41;
  };
  settings: GameState["settings"];
  world: Omit<GameState["world"], "teams"> & {
    teams: Record<string, TeamV41>;
  };
  competition: {
    season: GameState["competition"]["season"];
    schedule: GameState["competition"]["schedule"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
    games: Record<
      string,
      Omit<
        GameState["competition"]["games"][string],
        "homeTeamSnapshot" | "awayTeamSnapshot"
      > & {
        homeTeamSnapshot: GameTeamSnapshotV41 | null;
        awayTeamSnapshot: GameTeamSnapshotV41 | null;
      }
    >;
  };
  business: GameState["business"];
  user: {
    controlledTeamId: string;
    mode: GameState["user"]["mode"];
    citySelectionConfirmed: boolean;
    franchiseIdentityConfirmed?: boolean;
    ownerStartSeasonYear: number;
    ownerPhilosophy: string;
    ownerPatience: number;
    ownershipConfidence: unknown;
    objectives: unknown[];
    notifications: unknown[];
    eventLog: unknown[];
    appliedGameplayConsequenceKeys: Record<string, true>;
    explicitDecisions: Record<string, true>;
    phaseSkips: unknown[];
    aiAssistState: unknown;
    pendingOwnerDecisions: unknown[];
    ownerDecisionHistory: unknown[];
    narrative: unknown;
  };
};

/**
 * Deterministic v41 → v42: team branding + franchise identity onboarding flag.
 */
export function migrateV41ToV42(state: GameStateV41): GameStateV42 {
  const usedPaletteLogoKeys = new Set<string>();
  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    let branding = team.branding;
    if (!branding) {
      branding = deriveDefaultTeamBranding(
        teamId,
        String(team.city ?? ""),
        String(team.name ?? ""),
        usedPaletteLogoKeys,
      );
    }
    const paletteId = resolvePaletteIdFromBranding(branding);
    if (paletteId) {
      usedPaletteLogoKeys.add(paletteLogoKey(paletteId, branding.logoId));
    }
    teams[teamId] = {
      ...(team as unknown as GameState["world"]["teams"][string]),
      branding: {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        logoId: branding.logoId,
      },
    };
  }

  const games: GameState["competition"]["games"] = {};
  for (const [gameId, game] of Object.entries(state.competition.games)) {
    games[gameId] = {
      ...game,
      homeTeamSnapshot: backfillSnapshotBranding(game.homeTeamSnapshot, teams),
      awayTeamSnapshot: backfillSnapshotBranding(game.awayTeamSnapshot, teams),
    } as GameState["competition"]["games"][string];
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 42,
    },
    world: {
      ...state.world,
      teams,
    },
    competition: {
      ...state.competition,
      games,
    },
    user: {
      ...state.user,
      franchiseIdentityConfirmed:
        state.user.franchiseIdentityConfirmed ??
        state.user.citySelectionConfirmed === true,
    },
  } as unknown as GameStateV42;
}
