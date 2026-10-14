import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type {
  OwnerObjective,
  OwnerObjectiveCategory,
  OwnerObjectiveLifecycle,
  OwnerObjectiveRole,
  OwnerObjectiveType,
} from "@/domain/entities/owner-objective";
import { reconstructGameSettingsFromState } from "@/state/reconstruct-game-settings";
import { DEFAULT_OWNER_PHILOSOPHY } from "@/domain/entities/owner-philosophy";
import { defaultOwnerPatience } from "@/systems/owner-philosophy-config";
import {
  type FranchiseOps,
  type AiProfile,
  isAiProfile,
} from "@/domain/entities/franchise-ops";
import { generateAxesForExistingProfile } from "@/systems/franchise-identity-generation";
import {
  type TeamFinances,
  normalizeTeamFinanceBooks,
} from "@/domain/entities/finances";
import {
  type GameSettings,
  isTradeDeadlineRule,
  DEFAULT_TRADE_DEADLINE_RULE,
  type AiManagementMode,
  type AiAssistanceDomains,
} from "@/domain/game-settings";
import type { SeasonPhase, OffseasonStage } from "@/domain/entities/season";
import { createDefaultOwnershipConfidence } from "@/domain/entities/ownership-confidence";
import {
  type CompetitionSlicePreV49,
  legacyUserRecord,
  hasModernOwnershipUser,
  legacyUserArray,
  resolveLegacyControlledTeamId,
} from "@/persistence/mappers/game-state-migrations/shared";
import type { GameStateV34 } from "@/persistence/mappers/game-state-migrations/v34-v41";

export type UserSlicePreV26 = {
  controlledTeamId: TeamId;
  mode: GameState["user"]["mode"];
  objectives: Array<
    Omit<
      OwnerObjective,
      "category" | "lifecycle" | "role" | "horizonYears" | "baseline"
    > & {
      category?: OwnerObjectiveCategory;
      lifecycle?: OwnerObjectiveLifecycle;
      role?: OwnerObjectiveRole;
      horizonYears?: number;
      baseline?: number;
    }
  >;
  notifications: GameState["user"]["ownedFranchises"][string]["notifications"];
  eventLog: GameState["user"]["ownedFranchises"][string]["eventLog"];
  appliedGameplayConsequenceKeys: GameState["user"]["ownedFranchises"][string]["appliedGameplayConsequenceKeys"];
};

/** Dual-shaped user blob while v26–v40 still pass through legacy and modern ownership. */
export type UserSliceV26ToV40 = Record<string, unknown> & {
  ownerStartSeasonYear?: number;
  explicitDecisions?: Record<string, true>;
  phaseSkips?: unknown[];
  pendingOwnerDecisions?: unknown[];
  ownerDecisionHistory?: unknown[];
  citySelectionConfirmed?: boolean;
};

export type GameStateV24 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 24;
    rngState: number;
  };
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSlicePreV26;
};

export type GameStateV25 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 25;
    rngState: number;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSlicePreV26;
};

/**
 * Deterministic v24 → v25: add top-level GameSettings reconstructed from league.
 * Does not overwrite old CBL careers with Standard 30/82/16.
 * Emits literal schemaVersion 25. No RNG.
 */
export function migrateV24ToV25(state: GameStateV24): GameStateV25 {
  const settings = reconstructGameSettingsFromState(state);
  return {
    meta: {
      ...state.meta,
      schemaVersion: 25,
    },
    settings,
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

function legacyObjectiveMeta(type: OwnerObjectiveType): {
  category: OwnerObjectiveCategory;
  lifecycle: OwnerObjectiveLifecycle;
  role: OwnerObjectiveRole;
} {
  switch (type) {
    case "make_playoffs":
    case "minimum_win_total":
    case "playoff_round":
    case "win_championship":
    case "playoff_seed":
      return {
        category: "competitive",
        lifecycle: "seasonal",
        role:
          type === "make_playoffs" || type === "minimum_win_total"
            ? "primary"
            : "secondary",
      };
    case "improve_finances":
    case "payroll_limit":
    case "revenue_target":
    case "positive_cash":
      return {
        category: "financial",
        lifecycle: "seasonal",
        role: type === "payroll_limit" ? "secondary" : "primary",
      };
    case "develop_young_players":
    case "roster_direction":
      return {
        category: "strategic",
        lifecycle: "seasonal",
        role: "secondary",
      };
    case "attendance":
    case "fan_sentiment":
    case "awareness":
    case "reputation":
    case "arena_level":
      return {
        category: "franchise",
        lifecycle: "seasonal",
        role: "secondary",
      };
    case "franchise_value":
    case "championship_count":
    case "playoff_count":
      return {
        category: "long_term",
        lifecycle: "career",
        role: "long_term",
      };
  }
}

/**
 * Deterministic v25 → v26: owner philosophy + patience; backfill objective
 * category/lifecycle/role. Does not regenerate seasonal objectives.
 * Emits literal schemaVersion 26. No RNG.
 */
export function migrateV25ToV26(state: GameStateV25): GameStateV26 {
  const userRecord = legacyUserRecord(state.user);
  if (hasModernOwnershipUser(userRecord)) {
    return {
      ...state,
      meta: {
        ...state.meta,
        schemaVersion: 26,
      },
    } as GameStateV26;
  }

  const objectives = legacyUserArray<UserSlicePreV26["objectives"][number]>(
    userRecord.objectives,
  ).map((objective) => {
    const meta = legacyObjectiveMeta(objective.type);
    return {
      id: objective.id,
      type: objective.type,
      description: objective.description,
      status: objective.status,
      seasonYear: objective.seasonYear,
      consequenceApplied: objective.consequenceApplied,
      category: objective.category ?? meta.category,
      lifecycle: objective.lifecycle ?? meta.lifecycle,
      role: objective.role ?? meta.role,
      ...(objective.target !== undefined ? { target: objective.target } : {}),
      ...(objective.progress !== undefined
        ? { progress: objective.progress }
        : {}),
      ...(objective.horizonYears !== undefined
        ? { horizonYears: objective.horizonYears }
        : {}),
      ...(objective.baseline !== undefined
        ? { baseline: objective.baseline }
        : {}),
    } satisfies OwnerObjective;
  });

  return {
    meta: {
      ...state.meta,
      schemaVersion: 26,
    },
    settings: state.settings,
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: {
      controlledTeamId: resolveLegacyControlledTeamId(userRecord) as TeamId,
      mode: state.user.mode,
      ownerPhilosophy: DEFAULT_OWNER_PHILOSOPHY,
      ownerPatience: defaultOwnerPatience(DEFAULT_OWNER_PHILOSOPHY),
      objectives,
      notifications: legacyUserArray(userRecord.notifications),
      eventLog: legacyUserArray(userRecord.eventLog),
      appliedGameplayConsequenceKeys:
        (userRecord.appliedGameplayConsequenceKeys as Record<string, true>) ??
        {},
    },
  } as GameStateV26;
}

/** Schema v26 before franchise ownership axes on FranchiseOps. */
export type GameStateV26 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 26;
    rngState: number;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v26 → v27: add spendingTolerance / patience / riskTolerance
 * on every FranchiseOps. Keeps existing aiProfile; fills axes from seed+teamId.
 * Allows "rebuild" in the type system for new saves only (does not rewrite
 * legacy profiles). Emits literal schemaVersion 27. No RNG stream consumption.
 */
export function migrateV26ToV27(state: GameStateV26): GameStateV27 {
  const franchiseOps: Record<string, FranchiseOps> = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    const raw = ops as FranchiseOps & {
      spendingTolerance?: number;
      patience?: number;
      riskTolerance?: number;
      premiumTicketPrice?: number;
    };
    const profile: AiProfile = isAiProfile(raw.aiProfile)
      ? raw.aiProfile
      : "conservative";
    const axes = generateAxesForExistingProfile({
      rngSeed: state.meta.rngSeed,
      teamId,
      aiProfile: profile,
    });
    franchiseOps[teamId] = {
      ...raw,
      aiProfile: profile,
      spendingTolerance:
        typeof raw.spendingTolerance === "number"
          ? raw.spendingTolerance
          : axes.spendingTolerance,
      patience: typeof raw.patience === "number" ? raw.patience : axes.patience,
      riskTolerance:
        typeof raw.riskTolerance === "number"
          ? raw.riskTolerance
          : axes.riskTolerance,
      premiumTicketPrice:
        typeof raw.premiumTicketPrice === "number"
          ? raw.premiumTicketPrice
          : 180,
    };
  }

  return {
    meta: {
      ...state.meta,
      schemaVersion: 27,
    },
    settings: state.settings,
    world: state.world,
    competition: state.competition,
    business: {
      ...state.business,
      franchiseOps,
    },
    user: state.user,
  };
}

/** Schema v27 before chart-of-accounts expansion / booksByMonth. */
export type GameStateV27 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 27;
    rngState: number;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v27 → v28: expand finance categories, add booksByMonth and
 * cashLedgerByMonth, ensure premiumTicketPrice on FranchiseOps.
 * Does not rewrite historical "other" lumping. Emits schemaVersion 28.
 */
export function migrateV27ToV28(state: GameStateV27): GameStateV28 {
  const finances: Record<string, unknown> = {};
  for (const [teamId, finance] of Object.entries(state.business.finances)) {
    const booksByYear: TeamFinances["booksByYear"] = {};
    for (const [yearKey, books] of Object.entries(finance.booksByYear ?? {})) {
      booksByYear[yearKey] = normalizeTeamFinanceBooks(
        books as Parameters<typeof normalizeTeamFinanceBooks>[0],
      );
    }
    const booksByMonth: TeamFinances["booksByMonth"] = {};
    const rawMonths =
      (
        finance as TeamFinances & {
          booksByMonth?: TeamFinances["booksByMonth"];
        }
      ).booksByMonth ?? {};
    for (const [monthKey, books] of Object.entries(rawMonths)) {
      booksByMonth[monthKey] = normalizeTeamFinanceBooks(
        books as Parameters<typeof normalizeTeamFinanceBooks>[0],
      );
    }
    const legacy = finance as TeamFinances & {
      cash?: number;
      cashLedgerByMonth?: Record<string, unknown>;
    };
    finances[teamId] = {
      teamId: finance.teamId,
      cash: legacy.cash,
      payroll: finance.payroll,
      booksByYear,
      booksByMonth,
      cashLedgerByMonth: legacy.cashLedgerByMonth ?? {},
    };
  }

  const franchiseOps: Record<string, FranchiseOps> = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    const raw = ops as FranchiseOps & { premiumTicketPrice?: number };
    franchiseOps[teamId] = {
      ...raw,
      premiumTicketPrice:
        typeof raw.premiumTicketPrice === "number"
          ? raw.premiumTicketPrice
          : 180,
    };
  }

  return {
    meta: {
      ...state.meta,
      schemaVersion: 28,
    },
    settings: state.settings as GameStateV28["settings"],
    world: state.world,
    competition: state.competition as GameStateV28["competition"],
    business: {
      ...state.business,
      finances: finances as GameStateV28["business"]["finances"],
      franchiseOps,
    },
    user: state.user,
  };
}

/** Schema v28 before calendar-context season start + trade deadline rule. */
export type GameStateV28 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 28;
    rngState: number;
  };
  settings: {
    league: GameSettings["league"];
    /** Present on historical v28 JSON; normalized to injuryFrequency on load. */
    injuriesEnabled?: boolean;
    injuryFrequency?: GameSettings["injuryFrequency"];
    regularSeason: {
      gamesPerTeam: number;
      tradeDeadlineRule?: GameSettings["regularSeason"]["tradeDeadlineRule"];
    };
    playoffs: GameSettings["playoffs"];
    simulation: GameSettings["simulation"];
    ai: GameSettings["ai"];
    financialRules: GameSettings["financialRules"];
    draft: GameSettings["draft"];
    history: GameSettings["history"];
  };
  world: GameState["world"];
  competition: {
    season: {
      id: GameState["competition"]["season"]["id"];
      year: number;
      phase: SeasonPhase;
      offseasonStage: OffseasonStage;
      regularSeasonStartDate?: string | null;
    };
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
  };
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v28 → v29: regularSeasonStartDate + tradeDeadlineRule defaults.
 * Emits schemaVersion 29. No RNG.
 */
export function migrateV28ToV29(state: GameStateV28): GameStateV29 {
  let regularSeasonStartDate: string | null =
    state.competition.season.regularSeasonStartDate ?? null;
  if (
    regularSeasonStartDate === null &&
    state.competition.season.phase === "regular"
  ) {
    let earliest: string | null = null;
    for (const gameId of state.competition.schedule.gameIds) {
      const game = state.competition.games[gameId];
      if (!game) {
        continue;
      }
      if (earliest === null || game.date < earliest) {
        earliest = game.date;
      }
    }
    regularSeasonStartDate = earliest;
  }

  const tradeDeadlineRule = isTradeDeadlineRule(
    state.settings.regularSeason.tradeDeadlineRule,
  )
    ? state.settings.regularSeason.tradeDeadlineRule
    : DEFAULT_TRADE_DEADLINE_RULE;

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 29,
    },
    settings: {
      ...state.settings,
      ai: {
        difficulty: state.settings.ai.difficulty,
        managementMode:
          (state.settings.ai as { managementMode?: AiManagementMode })
            .managementMode ?? "smart_assist",
        assistance: {
          freeAgency: "inherit",
          draft: "inherit",
          contracts: "inherit",
          rosterFilling: "inherit",
          rotations: "inherit",
          staffHiring: "inherit",
          trades: "inherit",
          injuryReplacement: "inherit",
          ...((
            state.settings.ai as { assistance?: Partial<AiAssistanceDomains> }
          ).assistance ?? {}),
        } as AiAssistanceDomains,
      },
      offseason: {
        freeAgency: {
          durationDays:
            (state.settings as { offseason?: GameSettings["offseason"] })
              .offseason?.freeAgency.durationDays ?? 30,
          allowExtension:
            (state.settings as { offseason?: GameSettings["offseason"] })
              .offseason?.freeAgency.allowExtension ?? true,
        },
      },
      regularSeason: {
        gamesPerTeam: state.settings.regularSeason.gamesPerTeam,
        tradeDeadlineRule,
      },
    },
    competition: {
      ...state.competition,
      season: {
        id: state.competition.season.id,
        year: state.competition.season.year,
        phase: state.competition.season.phase,
        offseasonStage: state.competition.season.offseasonStage,
        regularSeasonStartDate,
        offseasonStageEnteredDate:
          (
            state.competition.season as {
              offseasonStageEnteredDate?: string | null;
            }
          ).offseasonStageEnteredDate ?? null,
        freeAgencyExtendedUntil:
          (
            state.competition.season as {
              freeAgencyExtendedUntil?: string | null;
            }
          ).freeAgencyExtendedUntil ?? null,
      },
    },
  } as unknown as GameStateV29;
}

export type GameStateV29 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 29;
    rngState: number;
  };
  settings: GameSettings;
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v29 → v30: empty user.narrative store.
 * Emits schemaVersion 30. No RNG.
 */
export function migrateV29ToV30(state: GameStateV29): GameStateV30 {
  const userRecord = legacyUserRecord(state.user);
  if (hasModernOwnershipUser(userRecord)) {
    return {
      ...state,
      meta: {
        ...state.meta,
        schemaVersion: 30,
      },
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 30,
    },
    user: {
      ...state.user,
      narrative: {
        situations: [],
        snapshots: [],
        cooldowns: {},
      },
    },
  };
}

export type GameStateV30 = {
  meta: GameState["meta"];
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v30 → v31: relocation tenure fields + franchise history city/name.
 * Emits schemaVersion 31. No RNG.
 */
export function migrateV30ToV31(state: GameStateV30): GameState {
  const year = state.competition.season.year;
  const relocationByTeamId: GameState["business"]["relocationByTeamId"] = {};
  for (const teamId of Object.keys(state.world.teams)) {
    const existing = state.business.relocationByTeamId[teamId];
    const historyLen =
      state.business.franchiseHistory[teamId]?.seasons.length ?? 0;
    const inferredStart = Math.max(1, year - Math.max(0, historyLen - 1));
    relocationByTeamId[teamId] = {
      teamId: teamId as TeamId,
      stage: existing?.stage ?? "none",
      target: existing?.target ?? null,
      cooldownSeasonsRemaining: existing?.cooldownSeasonsRemaining ?? 0,
      fee: existing?.fee ?? 0,
      cityStartSeasonYear:
        existing &&
        typeof (existing as { cityStartSeasonYear?: number })
          .cityStartSeasonYear === "number" &&
        (existing as { cityStartSeasonYear: number }).cityStartSeasonYear > 0
          ? (existing as { cityStartSeasonYear: number }).cityStartSeasonYear
          : inferredStart,
      lastCompletedRelocationSeasonYear:
        (existing as { lastCompletedRelocationSeasonYear?: number | null })
          ?.lastCompletedRelocationSeasonYear ?? null,
      failedAttemptCooldownSeasonsRemaining:
        (existing as { failedAttemptCooldownSeasonsRemaining?: number })
          ?.failedAttemptCooldownSeasonsRemaining ?? 0,
    };
  }

  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const teamId of Object.keys(state.business.franchiseHistory)) {
    const history = state.business.franchiseHistory[teamId]!;
    const team = state.world.teams[teamId];
    franchiseHistory[teamId] = {
      teamId: history.teamId,
      seasons: history.seasons.map((season) => ({
        ...season,
        city:
          typeof (season as { city?: string }).city === "string"
            ? (season as { city: string }).city
            : (team?.city ?? "Unknown"),
        name:
          typeof (season as { name?: string }).name === "string"
            ? (season as { name: string }).name
            : (team?.name ?? "Unknown"),
      })),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 31,
    },
    business: {
      ...state.business,
      relocationByTeamId,
      franchiseHistory,
    },
  } as unknown as GameState;
}

export type GameStateV31 = {
  meta: GameState["meta"];
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v31 → v32: ownerStartSeasonYear, season attendance nulls,
 * finances.attendanceByYear. Emits schemaVersion 32. No RNG.
 */
export function migrateV31ToV32(state: GameStateV31): GameStateV32 {
  const seasonYear = state.competition.season.year;
  const rawOwnerStart = (state.user as { ownerStartSeasonYear?: unknown })
    .ownerStartSeasonYear;
  const ownerStartSeasonYear =
    typeof rawOwnerStart === "number" &&
    Number.isFinite(rawOwnerStart) &&
    Number.isInteger(rawOwnerStart)
      ? rawOwnerStart
      : seasonYear;

  const finances: GameState["business"]["finances"] = {};
  for (const [teamId, finance] of Object.entries(state.business.finances)) {
    const attendanceByYear =
      finance &&
      typeof finance === "object" &&
      "attendanceByYear" in finance &&
      finance.attendanceByYear != null &&
      typeof finance.attendanceByYear === "object" &&
      !Array.isArray(finance.attendanceByYear)
        ? (finance.attendanceByYear as Record<string, number>)
        : {};
    finances[teamId] = {
      ...finance,
      attendanceByYear,
    };
  }

  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const [teamId, history] of Object.entries(
    state.business.franchiseHistory,
  )) {
    franchiseHistory[teamId] = {
      teamId: history.teamId,
      seasons: history.seasons.map((season) => {
        const rawAttendance = (season as { attendance?: unknown }).attendance;
        const attendance =
          rawAttendance === null
            ? null
            : typeof rawAttendance === "number" &&
                Number.isFinite(rawAttendance)
              ? rawAttendance
              : null;
        return {
          ...season,
          attendance,
        };
      }),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 32,
    },
    business: {
      ...state.business,
      finances,
      franchiseHistory,
    },
    user: {
      ...state.user,
      ownerStartSeasonYear,
    },
  };
}

export type GameStateV32 = {
  meta: GameState["meta"];
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v32 → v33: add ownershipConfidence defaults.
 * Emits schemaVersion 33. No RNG.
 */
export function migrateV32ToV33(state: GameStateV32): GameStateV33 {
  const userRecord = legacyUserRecord(state.user);
  if (hasModernOwnershipUser(userRecord)) {
    return {
      ...state,
      meta: {
        ...state.meta,
        schemaVersion: 33,
      },
    };
  }

  const date = state.world.calendar.currentDate;
  const existing = userRecord.ownershipConfidence;
  const ownershipConfidence =
    existing != null && typeof existing === "object"
      ? existing
      : createDefaultOwnershipConfidence(date);

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 33,
    },
    user: {
      ...state.user,
      ownershipConfidence,
    },
  };
}

export type GameStateV33 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 33;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: UserSliceV26ToV40;
};

/**
 * Deterministic v33 → v34:
 * - foundedSeasonYear on FranchiseOps
 * - expenses / netIncome / payroll / leagueRank on FranchiseSeasonRecord
 * Emits schemaVersion 34. No RNG.
 */
export function migrateV33ToV34(state: GameStateV33): GameStateV34 {
  const leagueStart =
    state.user.ownerStartSeasonYear ?? state.competition.season.year;
  const franchiseOps: GameState["business"]["franchiseOps"] = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    const raw = ops as FranchiseOps & { foundedSeasonYear?: number };
    const history = state.business.franchiseHistory[teamId];
    const firstYear = history?.seasons[0]?.seasonYear;
    franchiseOps[teamId] = {
      ...raw,
      foundedSeasonYear:
        typeof raw.foundedSeasonYear === "number"
          ? raw.foundedSeasonYear
          : (firstYear ?? leagueStart),
    };
  }

  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const [teamId, history] of Object.entries(
    state.business.franchiseHistory,
  )) {
    franchiseHistory[teamId] = {
      teamId: history.teamId,
      seasons: history.seasons.map((season) => {
        const raw = season as typeof season & {
          expenses?: number;
          netIncome?: number;
          payroll?: number;
          leagueRank?: number | null;
        };
        return {
          ...season,
          expenses: typeof raw.expenses === "number" ? raw.expenses : 0,
          netIncome: typeof raw.netIncome === "number" ? raw.netIncome : 0,
          payroll: typeof raw.payroll === "number" ? raw.payroll : 0,
          leagueRank:
            raw.leagueRank === null || typeof raw.leagueRank === "number"
              ? raw.leagueRank
              : null,
        };
      }),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 34,
    },
    business: {
      ...state.business,
      franchiseOps,
      franchiseHistory,
      franchiseReportCache: state.business.franchiseReportCache ?? {},
    },
  };
}
