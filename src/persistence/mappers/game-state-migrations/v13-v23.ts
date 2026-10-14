import type { GameState } from "@/state/game-state";
import type { TeamId, SeasonId } from "@/domain/ids";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import type { Team } from "@/domain/entities/team";
import { generateDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import {
  type TeamFinances,
  createEmptyTeamFinanceBooks,
} from "@/domain/entities/finances";
import { addCalendarDays } from "@/domain/calendar-date";
import type { SeasonPhase, OffseasonStage } from "@/domain/entities/season";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";
import { hydrateStaffFromPersisted } from "@/systems/staff-ratings";
import type {
  BusinessSliceV14,
  UserSliceV14,
  BusinessSliceV15,
  BusinessSliceV16,
  TeamFinancesV15ThroughV19,
  TeamFinancesV14,
} from "@/persistence/mappers/game-state-migrations/v08-v12";
import {
  type CompetitionSlicePreV49,
  hasModernOwnershipUser,
  legacyUserRecord,
  resolveLegacyControlledTeamId,
  legacyUserArray,
} from "@/persistence/mappers/game-state-migrations/shared";
import type {
  UserSlicePreV26,
  GameStateV24,
} from "@/persistence/mappers/game-state-migrations/v24-v33";

export type GameStateV13 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 13;
    rngState: number;
  };
  world: GameState["world"];
  competition: {
    season: GameState["competition"]["season"];
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
  };
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV14 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 14;
    rngState: number;
  };
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV15 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 15;
    rngState: number;
  };
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: BusinessSliceV15;
  user: UserSliceV21;
};

/** Schema 15–21 user objectives before status/notifications/consequence keys. */
type OwnerObjectiveV21 = {
  id: string;
  type: string;
  description: string;
  completed: boolean;
  target?: number;
  progress?: number;
  seasonYear?: number;
};

type UserSliceV21 = {
  controlledTeamId: TeamId;
  mode: GameState["user"]["mode"];
  objectives: OwnerObjectiveV21[];
};

export type GameStateV16 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 16;
    rngState: number;
  };
  world: WorldSliceV17;
  competition: CompetitionSlicePreV49;
  business: BusinessSliceV16;
  user: UserSliceV21;
};

/** Schema 17 world before draftPicks. */
type WorldSliceV17 = {
  calendar: GameState["world"]["calendar"];
  league: GameState["world"]["league"];
  conferences: GameState["world"]["conferences"];
  divisions: GameState["world"]["divisions"];
  teams: GameState["world"]["teams"];
  players: GameState["world"]["players"];
  coaches: GameState["world"]["coaches"];
  staff: GameState["world"]["staff"];
};

/** Schema 17 business before tradeBlocks. */
type BusinessSliceV17 = {
  contracts: GameState["business"]["contracts"];
  finances: Record<string, TeamFinancesV15ThroughV19>;
  freeAgency: GameState["business"]["freeAgency"];
};

export type GameStateV17 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 17;
    rngState: number;
  };
  world: WorldSliceV17;
  competition: CompetitionSlicePreV49;
  business: BusinessSliceV17;
  user: UserSliceV21;
};

/** Schema 18 world before drafts. */
type WorldSliceV18 = {
  calendar: GameState["world"]["calendar"];
  league: GameState["world"]["league"];
  conferences: GameState["world"]["conferences"];
  divisions: GameState["world"]["divisions"];
  teams: GameState["world"]["teams"];
  players: GameState["world"]["players"];
  coaches: GameState["world"]["coaches"];
  staff: GameState["world"]["staff"];
  draftPicks: GameState["world"]["draftPicks"];
};

/** Schema 18–19 business before booksByYear. */
type BusinessSliceV18 = {
  contracts: GameState["business"]["contracts"];
  finances: Record<string, TeamFinancesV15ThroughV19>;
  freeAgency: GameState["business"]["freeAgency"];
  tradeBlocks: GameState["business"]["tradeBlocks"];
};

export type GameStateV18 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 18;
    rngState: number;
  };
  world: WorldSliceV18;
  competition: CompetitionSlicePreV49;
  business: BusinessSliceV18;
  user: UserSliceV21;
};

export type GameStateV19 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 19;
    rngState: number;
  };
  world: {
    calendar: { currentDate: string };
    league: GameState["world"]["league"];
    conferences: GameState["world"]["conferences"];
    divisions: GameState["world"]["divisions"];
    teams: GameState["world"]["teams"];
    players: GameState["world"]["players"];
    coaches: GameState["world"]["coaches"];
    staff: GameState["world"]["staff"];
    draftPicks: GameState["world"]["draftPicks"];
    drafts: GameState["world"]["drafts"];
  };
  competition: {
    season: {
      id: SeasonId;
      year: number;
      phase: string;
    };
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
  };
  business: BusinessSliceV18;
  user: UserSliceV21;
};

/** Schema v20 before simulation backbone fields (calendar progress, offseason stage, scheduled events). */
export type GameStateV20 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 20;
    rngState: number;
  };
  world: GameStateV19["world"];
  competition: GameStateV19["competition"];
  business: GameStateV23["business"];
  user: UserSliceV21;
};

/** Schema v21 before owner gameplay notifications / objective status. */
export type GameStateV21 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 21;
    rngState: number;
  };
  world: GameStateV23["world"];
  competition: CompetitionSlicePreV49;
  business: GameStateV23["business"];
  user: UserSliceV21;
};

/**
 * Deterministic v13 → v14: add empty playoff tournament under competition.
 */
export function migrateV13ToV14(state: GameStateV13): GameStateV14 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 13.",
    );
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 14,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: {
      season: state.competition.season,
      schedule: state.competition.schedule,
      games: state.competition.games,
      standings: state.competition.standings,
      playoffs: createEmptyPlayoffTournament(),
      seasonEventLog: [],
    } as unknown as CompetitionSlicePreV49,
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v14 → v15: add empty owner objectives and finance revenue/expenses.
 * Emits literal schemaVersion 15 (not GAME_STATE_SCHEMA_VERSION).
 */
export function migrateV14ToV15(state: GameStateV14): GameStateV15 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 14.",
    );
  }

  const finances: Record<string, TeamFinancesV15ThroughV19> =
    Object.fromEntries(
      Object.entries(state.business.finances).map(([teamId, finance]) => [
        teamId,
        {
          teamId: finance.teamId,
          cash:
            finance.cash ??
            (finance as TeamFinancesV14 & { businessFunds?: number })
              .businessFunds ??
            0,
          revenue: 0,
          expenses: 0,
          payroll: finance.payroll,
        },
      ]),
    );

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 15,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      contracts: state.business.contracts,
      finances,
    },
    user: (hasModernOwnershipUser(legacyUserRecord(state.user))
      ? state.user
      : {
          controlledTeamId: resolveLegacyControlledTeamId(
            legacyUserRecord(state.user),
          ) as TeamId,
          mode: state.user.mode,
          objectives: [],
        }) as GameStateV15["user"],
  };
}

/**
 * Deterministic v15 → v16: expand contracts to startYear/endYear/salaryByYear.
 * v15 has no options; migrated contracts never include teamOption or playerOption.
 * Emits literal schemaVersion 16.
 */
export function migrateV15ToV16(state: GameStateV15): GameStateV16 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 15.",
    );
  }

  const startYear = state.competition.season.year;
  const contracts: GameState["business"]["contracts"] = {};

  for (const [contractId, legacy] of Object.entries(state.business.contracts)) {
    const yearsRemaining =
      typeof legacy.yearsRemaining === "number" &&
      Number.isInteger(legacy.yearsRemaining) &&
      legacy.yearsRemaining >= 1
        ? legacy.yearsRemaining
        : 1;
    const endYear = startYear + yearsRemaining - 1;
    const salaryByYear: Record<string, number> = {};
    for (let year = startYear; year <= endYear; year += 1) {
      salaryByYear[String(year)] = legacy.salaryPerYear;
    }
    contracts[contractId] = {
      id: legacy.id,
      playerId: legacy.playerId,
      teamId: legacy.teamId,
      startYear,
      endYear,
      salaryByYear,
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 16,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      contracts,
      finances: state.business.finances,
    },
    user: state.user,
  };
}

/**
 * Deterministic v16 → v17: add empty freeAgency offers under business.
 * Emits literal schemaVersion 17.
 */
export function migrateV16ToV17(state: GameStateV16): GameStateV17 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 16.",
    );
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 17,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      contracts: state.business.contracts,
      finances: state.business.finances,
      freeAgency: {
        offers: {},
      },
    },
    user: state.user,
  };
}

/**
 * Deterministic v17 → v18: add world.draftPicks and business.tradeBlocks.
 * Uses pure generateDraftPicksForSeason (no RNG, no bootstrap).
 * Emits literal schemaVersion 18.
 */
export function migrateV17ToV18(state: GameStateV17): GameStateV18 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 17.",
    );
  }

  const teams = Object.values(state.world.teams) as Team[];
  const draftPicks = generateDraftPicksForSeason(
    teams,
    state.competition.season.year,
  );

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 18,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: {
      ...state.world,
      draftPicks,
    },
    competition: state.competition,
    business: {
      contracts: state.business.contracts,
      finances: state.business.finances,
      freeAgency: state.business.freeAgency,
      tradeBlocks: {},
    },
    user: state.user,
  };
}

/**
 * Deterministic v18 → v19: add empty world.drafts.
 * Emits literal schemaVersion 19. No RNG.
 */
export function migrateV18ToV19(state: GameStateV18): GameStateV19 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 18.",
    );
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 19,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: {
      ...state.world,
      drafts: {},
    },
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v19 → v20: replace scalar revenue/expenses with booksByYear.
 * Non-zero legacy revenue maps to other; non-zero expenses map to operations.
 * Zero values are discarded. Emits literal schemaVersion 20. No RNG.
 */
export function migrateV19ToV20(state: GameStateV19): GameStateV20 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 19.",
    );
  }

  const seasonYear = state.competition.season.year;
  const yearKey = String(seasonYear);

  const finances = Object.fromEntries(
    Object.entries(state.business.finances).map(([teamId, finance]) => {
      const booksByYear: TeamFinances["booksByYear"] = {};
      const hasRevenue = finance.revenue > 0;
      const hasExpenses = finance.expenses > 0;

      if (hasRevenue || hasExpenses) {
        const books = createEmptyTeamFinanceBooks();
        if (hasRevenue) {
          books.revenue.other = finance.revenue;
        }
        if (hasExpenses) {
          books.expenses.operations = finance.expenses;
        }
        booksByYear[yearKey] = books;
      }

      return [
        teamId,
        {
          teamId: finance.teamId,
          cash: finance.cash,
          payroll: finance.payroll,
          booksByYear,
          booksByMonth: {},
          cashLedgerByMonth: {},
        },
      ];
    }),
  ) as unknown as Record<string, TeamFinances>;

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 20,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      ...state.business,
      finances,
    },
    user: state.user,
  };
}

/**
 * Deterministic v20 → v21: simulation backbone fields.
 * - calendar.lastSimulatedDate / lastSimulatedWeekId
 * - season.offseasonStage
 * - world.scheduledEvents
 * Emits literal schemaVersion 21. No RNG.
 */
export function migrateV20ToV21(state: GameStateV20): GameStateV21 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 20.",
    );
  }

  const currentDate = state.world.calendar.currentDate;
  const lastSimulatedDate = addCalendarDays(currentDate, -1);
  const phase = state.competition.season.phase as SeasonPhase;
  const offseasonStage: OffseasonStage =
    phase === "offseason" ? "season_finalization" : "none";

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 21,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: {
      ...state.world,
      calendar: {
        currentDate,
        lastSimulatedDate,
        lastSimulatedWeekId: null,
      },
      scheduledEvents: {},
    },
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase,
        offseasonStage,
        regularSeasonStartDate:
          (
            state.competition.season as {
              regularSeasonStartDate?: string | null;
            }
          ).regularSeasonStartDate ?? null,
        tradeDeadlineDate:
          (state.competition.season as { tradeDeadlineDate?: string | null })
            .tradeDeadlineDate ?? null,
        rfaQualificationComplete:
          (state.competition.season as { rfaQualificationComplete?: boolean })
            .rfaQualificationComplete === true,
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
      seasonEventLog: [],
    } as unknown as CompetitionSlicePreV49,
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v21 → v22: owner gameplay fields.
 * - objectives: status / seasonYear / consequenceApplied (drop completed)
 * - user.notifications
 * - user.appliedGameplayConsequenceKeys
 * Emits literal schemaVersion 22. No RNG.
 */
export function migrateV21ToV22(state: GameStateV21): GameStateV22 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 21.",
    );
  }

  const userRecord = legacyUserRecord(state.user);
  if (hasModernOwnershipUser(userRecord)) {
    return {
      ...state,
      meta: {
        ...state.meta,
        schemaVersion: 22,
      },
    } as unknown as GameStateV22;
  }

  const seasonYear = state.competition.season.year;
  const rawObjectives = legacyUserArray<OwnerObjectiveV21>(
    userRecord.objectives,
  );
  const objectives = rawObjectives.map((objective) => {
    const { completed, seasonYear: existingSeasonYear, ...rest } = objective;
    const nextSeasonYear =
      typeof existingSeasonYear === "number" &&
      Number.isInteger(existingSeasonYear)
        ? existingSeasonYear
        : seasonYear;
    return {
      id: rest.id,
      type: rest.type,
      description: rest.description,
      status: completed ? ("completed" as const) : ("active" as const),
      seasonYear: nextSeasonYear,
      consequenceApplied: false,
      ...(rest.target !== undefined ? { target: rest.target } : {}),
      ...(rest.progress !== undefined ? { progress: rest.progress } : {}),
    };
  });

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 22,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: {
      controlledTeamId: resolveLegacyControlledTeamId(userRecord) as TeamId,
      mode: state.user.mode,
      objectives: objectives as UserSlicePreV26["objectives"],
      notifications: [],
      appliedGameplayConsequenceKeys: {},
    },
  };
}

/**
 * Deterministic v22 → v23: add empty user.eventLog for Owner activity history.
 * Emits literal schemaVersion 23. No RNG.
 */
export function migrateV22ToV23(state: GameStateV22): GameStateV23 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error(
      "GameState meta.rngState is required for schemaVersion 22.",
    );
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 23,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: {
      ...state.user,
      eventLog: [],
    },
  };
}

export type GameStateV22 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 22;
    rngState: number;
  };
  world: GameStateV23["world"];
  competition: CompetitionSlicePreV49;
  business: GameStateV23["business"];
  user: {
    controlledTeamId: TeamId;
    mode: GameState["user"]["mode"];
    objectives: UserSlicePreV26["objectives"];
    notifications: GameState["user"]["ownedFranchises"][string]["notifications"];
    appliedGameplayConsequenceKeys: GameState["user"]["ownedFranchises"][string]["appliedGameplayConsequenceKeys"];
  };
};

export type GameStateV23 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 23;
    rngState: number;
  };
  world: {
    calendar: {
      currentDate: string;
      lastSimulatedDate: string | null;
      lastSimulatedWeekId: string | null;
    };
    league: GameState["world"]["league"];
    conferences: GameState["world"]["conferences"];
    divisions: GameState["world"]["divisions"];
    teams: GameState["world"]["teams"];
    players: GameState["world"]["players"];
    coaches: GameState["world"]["coaches"];
    staff: GameState["world"]["staff"];
    draftPicks: GameState["world"]["draftPicks"];
    drafts: GameState["world"]["drafts"];
    scheduledEvents: GameState["world"]["scheduledEvents"];
  };
  competition: CompetitionSlicePreV49;
  business: {
    contracts: GameState["business"]["contracts"];
    finances: GameState["business"]["finances"];
    freeAgency: GameState["business"]["freeAgency"];
    tradeBlocks: GameState["business"]["tradeBlocks"];
  };
  user: UserSlicePreV26;
};

/**
 * Deterministic v23 → v24: Phase E franchise business slices + calendar month id.
 * Emits literal schemaVersion 24. No RNG.
 */
export function migrateV23ToV24(state: GameStateV23): GameStateV24 {
  const teamIds = Object.keys(state.world.teams) as TeamId[];
  const phaseE = createPhaseEBusinessDefaults(teamIds);

  // Upgrade legacy staff role "other" → "assistant_coach" and fill missing attrs.
  // Orphan teamIds (common when fixtures strip teams) become unemployed.
  const staff: GameState["world"]["staff"] = {};
  for (const [id, raw] of Object.entries(state.world.staff)) {
    const s = raw as Record<string, unknown>;
    const member = hydrateStaffFromPersisted(s, id);
    let teamId = member.teamId;
    if (teamId !== null && !(teamId in state.world.teams)) {
      teamId = null;
    }
    staff[id] = teamId === member.teamId ? member : { ...member, teamId };
  }

  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    teams[teamId] = {
      ...team,
      staff: team.staff.filter((staffId) => {
        const member = staff[staffId];
        return member !== undefined && member.teamId === teamId;
      }),
    };
  }

  // Drop orphan coaches whose teamId is missing.
  const coaches: GameState["world"]["coaches"] = {};
  for (const [coachId, coach] of Object.entries(state.world.coaches)) {
    if (coach.teamId !== null && !(coach.teamId in state.world.teams)) {
      coaches[coachId] = { ...coach, teamId: null };
    } else {
      coaches[coachId] = coach;
    }
  }

  return {
    meta: {
      ...state.meta,
      schemaVersion: 24,
    },
    world: {
      ...state.world,
      calendar: {
        ...state.world.calendar,
        lastSimulatedMonthId: null,
      },
      teams,
      staff,
      coaches,
    },
    competition: state.competition,
    business: {
      ...state.business,
      ...phaseE,
    },
    user: state.user,
  } as unknown as GameStateV24;
}
