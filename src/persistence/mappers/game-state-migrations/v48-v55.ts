import { type GameState, EMPTY_STAFF_MARKET } from "@/state/game-state";
import { leaguePhaseIdFromLegacy } from "@/systems/phase-engine/resolve-current-phase";
import type { SeasonPhase, OffseasonStage } from "@/domain/entities/season";
import { hydrateStaffFromPersisted } from "@/systems/staff-ratings";
import { depthForPhilosophy } from "@/domain/entities/team-roster-management";
import {
  type Player,
  type PlayerInjury,
  primaryActiveInjury,
  defaultDurabilityForAge,
  type InjuryStatus,
  migrateLegacyInjuryStatus,
  migrateLegacySeverity,
  createLegacyUndisclosedInjury,
} from "@/domain/entities/player";
import { addCalendarDays } from "@/domain/calendar-date";
import { createDefaultDevelopmentLeagueProfile } from "@/domain/entities/development-league";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { createEmptyPlayerSeasonStatLine } from "@/domain/entities/player-history";
import type { GameStateV56 } from "@/persistence/mappers/game-state-migrations/v56-v65";

export type GameStateV48 = Omit<GameState, "meta" | "competition" | "user"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 48 };
  competition: Omit<GameState["competition"], "phase" | "seasonEvents">;
  user: Omit<GameState["user"], "franchisePhaseState">;
};

/**
 * Deterministic v48 → v49: add competition.phase and user.franchisePhaseState.
 * Maps legacy SeasonPhase + OffseasonStage → LeaguePhaseId.
 * Emits literal schemaVersion 49. No RNG.
 */
export function migrateV48ToV49(state: GameStateV48): GameStateV49 {
  const season = state.competition.season;
  const activePhaseId = leaguePhaseIdFromLegacy(
    season.phase as SeasonPhase,
    season.offseasonStage as OffseasonStage,
  );
  const enteredDate =
    season.offseasonStageEnteredDate ?? state.world.calendar.currentDate;

  const franchisePhaseState: GameState["user"]["franchisePhaseState"] = {};
  for (const teamId of state.user.ownedTeamIds) {
    franchisePhaseState[teamId] = { dismissed: [] };
  }

  return {
    ...(state as unknown as GameStateV49),
    meta: {
      ...(state as unknown as GameStateV49).meta,
      schemaVersion: 49,
    },
    competition: {
      ...state.competition,
      phase: {
        activePhaseId,
        enteredDate,
      },
    } as unknown as GameState["competition"],
    user: {
      ...state.user,
      franchisePhaseState,
    },
  };
}

export type GameStateV49 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 49 };
};

/**
 * Deterministic v49 → v50: staff overhaul (attributes/overall) + staffMarket.
 * Migrates marketing → public_relations. Emits literal schemaVersion 50.
 */
export function migrateV49ToV50(state: GameStateV49): GameStateV50 {
  const staff: GameState["world"]["staff"] = {};
  for (const [id, raw] of Object.entries(state.world.staff)) {
    const member = hydrateStaffFromPersisted(
      raw as unknown as Record<string, unknown>,
      id,
    );
    let teamId = member.teamId;
    if (teamId !== null && !(teamId in state.world.teams)) {
      teamId = null;
    }
    staff[id] = teamId === member.teamId ? member : { ...member, teamId };
  }

  const worldRecord = state.world as GameState["world"] & {
    staffMarket?: GameState["world"]["staffMarket"];
  };

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 50,
    },
    world: {
      ...state.world,
      staff,
      staffMarket: worldRecord.staffMarket ?? EMPTY_STAFF_MARKET,
    },
  };
}

export type GameStateV50 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 50 };
};

/**
 * Deterministic v50 → v51: scouting overhaul.
 * Adds teamDraftState + pickResults to each DraftClass; keeps legacy scouting array.
 */
export function migrateV50ToV51(state: GameStateV50): GameState {
  const drafts: GameState["world"]["drafts"] = {};
  for (const [draftId, draft] of Object.entries(state.world.drafts)) {
    const raw = draft as typeof draft & {
      teamDraftState?: GameState["world"]["drafts"][string]["teamDraftState"];
      pickResults?: GameState["world"]["drafts"][string]["pickResults"];
    };
    drafts[draftId] = {
      ...draft,
      teamDraftState: raw.teamDraftState ?? {},
      pickResults: raw.pickResults ?? [],
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 51,
    },
    world: {
      ...state.world,
      drafts,
    },
  };
}

export type GameStateV51 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 51 };
};

/**
 * Deterministic v51 → v52: fantasy draft queues, auto-pick strategies,
 * settings, and post-draft analysis containers.
 */
export function migrateV51ToV52(state: GameStateV51): GameStateV52 {
  const fantasyDraft = state.world.fantasyDraft;
  if (fantasyDraft === null) {
    return {
      ...state,
      meta: {
        ...state.meta,
        schemaVersion: 52,
      },
    };
  }

  const raw = fantasyDraft as Record<string, unknown>;

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 52,
    },
    world: {
      ...state.world,
      fantasyDraft: {
        ...fantasyDraft,
        version: Math.max(
          typeof fantasyDraft.version === "number" ? fantasyDraft.version : 1,
          2,
        ),
        teamQueues:
          raw.teamQueues && typeof raw.teamQueues === "object"
            ? (raw.teamQueues as NonNullable<
                GameState["world"]["fantasyDraft"]
              >["teamQueues"])
            : {},
        autoPickStrategy:
          raw.autoPickStrategy && typeof raw.autoPickStrategy === "object"
            ? (raw.autoPickStrategy as NonNullable<
                GameState["world"]["fantasyDraft"]
              >["autoPickStrategy"])
            : {},
        settings: {
          confirmPicks:
            raw.settings &&
            typeof raw.settings === "object" &&
            (raw.settings as { confirmPicks?: unknown }).confirmPicks === false
              ? false
              : true,
        },
        pickAnalyses: Array.isArray(raw.pickAnalyses)
          ? (raw.pickAnalyses as NonNullable<
              GameState["world"]["fantasyDraft"]
            >["pickAnalyses"])
          : [],
        teamSummaries:
          raw.teamSummaries && typeof raw.teamSummaries === "object"
            ? (raw.teamSummaries as NonNullable<
                GameState["world"]["fantasyDraft"]
              >["teamSummaries"])
            : {},
        leagueRecap:
          raw.leagueRecap && typeof raw.leagueRecap === "object"
            ? (raw.leagueRecap as NonNullable<
                GameState["world"]["fantasyDraft"]
              >["leagueRecap"])
            : null,
      },
    },
  };
}

export type GameStateV52 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 52 };
};

/**
 * Deterministic v52 → v53: separate player availability / injury / suspension.
 * Legacy `{ kind: "healthy" | "injured" }` maps conservatively — no fabricated
 * severity or return timelines.
 */
export function migrateV52ToV53(state: GameStateV52): GameState {
  const players: GameState["world"]["players"] = {};
  for (const [playerId, raw] of Object.entries(state.world.players)) {
    players[playerId] = migratePlayerInjuryFields(
      raw as unknown as Record<string, unknown>,
    );
  }

  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    const management = team.rosterManagement;
    teams[teamId] = {
      ...team,
      rosterManagement: {
        ...management,
        rotationDepth: Math.max(
          management.rotationDepth,
          depthForPhilosophy(management.rotationPhilosophy),
        ),
        closingLineupPolicy:
          management.closingLineupPolicy === "auto" ||
          management.closingLineupPolicy === "best_five" ||
          management.closingLineupPolicy === "starters" ||
          management.closingLineupPolicy === "custom"
            ? management.closingLineupPolicy
            : "auto",
        rotation: management.rotation.map((entry) => ({
          ...entry,
          role: entry.role === "deep_bench" ? "bench" : entry.role,
          overrideMedicalRecommendation:
            entry.overrideMedicalRecommendation === true,
        })),
      },
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 53,
    },
    world: {
      ...state.world,
      players,
      teams,
    },
  };
}

function migratePlayerInjuryFields(raw: Record<string, unknown>): Player {
  const base = raw as unknown as Player;
  // Already migrated shape
  if (
    typeof raw.availability === "string" &&
    (raw.injury === null ||
      (typeof raw.injury === "object" &&
        raw.injury !== null &&
        !("kind" in (raw.injury as object))))
  ) {
    const injury = (raw.injury as Player["injury"]) ?? null;
    const activeInjuries = Array.isArray(raw.activeInjuries)
      ? (raw.activeInjuries as PlayerInjury[])
      : injury != null
        ? [injury]
        : [];
    return {
      ...base,
      availability: raw.availability as Player["availability"],
      activeInjuries,
      injury: primaryActiveInjury(activeInjuries),
      suspension: (raw.suspension as Player["suspension"]) ?? null,
      physical: (raw.physical as Player["physical"]) ?? {
        durability: defaultDurabilityForAge(
          typeof base.age === "number" ? base.age : 25,
        ),
      },
      conditioning:
        typeof raw.conditioning === "number" ? raw.conditioning : 100,
      injuryHistory: Array.isArray(raw.injuryHistory)
        ? (raw.injuryHistory as Player["injuryHistory"])
        : [],
    };
  }

  const legacyInjury = raw.injury as InjuryStatus | undefined;
  const migrated = migrateLegacyInjuryStatus(
    legacyInjury ?? { kind: "healthy" },
  );
  return {
    ...base,
    availability: migrated.availability,
    activeInjuries: migrated.activeInjuries,
    injury: migrated.injury,
    suspension: migrated.suspension,
    physical: {
      durability: defaultDurabilityForAge(
        typeof base.age === "number" ? base.age : 25,
      ),
    },
    conditioning: 100,
    injuryHistory: [],
  };
}

export type GameStateV53 = Omit<
  GameState,
  "meta" | "business" | "competition"
> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 53 };
  competition: {
    season: Omit<
      GameState["competition"]["season"],
      "tradeDeadlineDate" | "rfaQualificationComplete"
    > & {
      tradeDeadlineDate?: string | null;
      rfaQualificationComplete?: boolean;
    };
    phase: GameState["competition"]["phase"];
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
    seasonEventLog: GameState["competition"]["seasonEventLog"];
  };
  business: Omit<GameState["business"], "rfaStatuses"> & {
    rfaStatuses?: GameState["business"]["rfaStatuses"];
  };
};

/**
 * Deterministic v53 → v54: hard-lock fields —
 * tradeDeadlineDate snapshot, rfaStatuses, DraftPick.status, season.rfaQualificationComplete.
 */
export function migrateV53ToV54(state: GameStateV53): GameState {
  const draftPicks: GameState["world"]["draftPicks"] = {};
  for (const [id, pick] of Object.entries(state.world.draftPicks)) {
    let status: "available" | "used" =
      (pick as { status?: "available" | "used" }).status ?? "available";
    for (const draft of Object.values(state.world.drafts)) {
      const slot = draft.order.find((entry) => entry.draftPickId === id);
      if (slot?.status === "used") {
        status = "used";
        break;
      }
    }
    draftPicks[id] = {
      ...pick,
      status,
    };
  }

  let tradeDeadlineDate: string | null =
    state.competition.season.tradeDeadlineDate ?? null;
  if (
    tradeDeadlineDate === null &&
    state.competition.season.phase === "regular"
  ) {
    let earliest = state.competition.season.regularSeasonStartDate ?? null;
    let latest: string | null = null;
    for (const gameId of state.competition.schedule.gameIds) {
      const game = state.competition.games[gameId];
      if (!game) continue;
      if (earliest === null || game.date < earliest) earliest = game.date;
      if (latest === null || game.date > latest) latest = game.date;
    }
    if (earliest !== null && latest !== null && latest >= earliest) {
      // Inline 60% calendar-span calculation (avoid circular import at migrate time)
      const start = earliest;
      const end = latest;
      const startMs = Date.parse(`${start}T00:00:00Z`);
      const endMs = Date.parse(`${end}T00:00:00Z`);
      const spanDays = Math.round((endMs - startMs) / 86_400_000);
      const offset = Math.max(0, Math.round(spanDays * 0.6));
      const deadlineMs = startMs + offset * 86_400_000;
      tradeDeadlineDate = new Date(deadlineMs).toISOString().slice(0, 10);
    }
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 54,
    },
    world: {
      ...state.world,
      draftPicks,
    },
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        tradeDeadlineDate,
        rfaQualificationComplete:
          state.competition.season.rfaQualificationComplete === true,
      },
    } as unknown as GameState["competition"],
    business: {
      ...state.business,
      rfaStatuses: state.business.rfaStatuses ?? {},
    },
  };
}

export type GameStateV54 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 54 };
};

/**
 * Deterministic v54 → v55: activeInjuries[], expanded PlayerInjury,
 * durability, conditioning, injuryHistory.
 */
export function migrateV54ToV55(state: GameStateV54): GameState {
  const currentDate = state.world.calendar?.currentDate ?? "2000-01-01";
  const players: GameState["world"]["players"] = {};

  for (const [playerId, raw] of Object.entries(state.world.players)) {
    players[playerId] = migratePlayerToV55InjuryModel(
      raw as unknown as Record<string, unknown>,
      currentDate,
    );
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 55,
    },
    world: {
      ...state.world,
      players,
    },
  };
}

function migratePlayerToV55InjuryModel(
  raw: Record<string, unknown>,
  currentDate: string,
): Player {
  const base = raw as unknown as Player;
  const age = typeof base.age === "number" ? base.age : 25;

  // Already on v55 shape
  if (Array.isArray(raw.activeInjuries) && raw.physical != null) {
    return {
      ...base,
      activeInjuries: raw.activeInjuries as PlayerInjury[],
      injury: primaryActiveInjury(raw.activeInjuries as PlayerInjury[]),
      physical: raw.physical as Player["physical"],
      conditioning:
        typeof raw.conditioning === "number" ? raw.conditioning : 100,
      injuryHistory: Array.isArray(raw.injuryHistory)
        ? (raw.injuryHistory as Player["injuryHistory"])
        : [],
    };
  }

  const legacyInjury = raw.injury as
    | PlayerInjury
    | { kind?: string; type?: string; severity?: string }
    | null
    | undefined;

  let activeInjuries: PlayerInjury[] = [];

  if (Array.isArray(raw.activeInjuries)) {
    activeInjuries = (raw.activeInjuries as PlayerInjury[]).map((injury) =>
      expandLegacyPlayerInjury(
        injury as unknown as Record<string, unknown>,
        currentDate,
      ),
    );
  } else if (
    legacyInjury != null &&
    typeof legacyInjury === "object" &&
    "kind" in legacyInjury
  ) {
    const migrated = migrateLegacyInjuryStatus(legacyInjury as InjuryStatus);
    activeInjuries = migrated.activeInjuries.map((injury) => ({
      ...injury,
      injuredOn: estimateLegacyInjuredOn(currentDate, 10),
    }));
  } else if (
    legacyInjury != null &&
    typeof legacyInjury === "object" &&
    "type" in legacyInjury
  ) {
    activeInjuries = [
      expandLegacyPlayerInjury(
        legacyInjury as unknown as Record<string, unknown>,
        currentDate,
      ),
    ];
  }

  return {
    ...base,
    activeInjuries,
    injury: primaryActiveInjury(activeInjuries),
    physical: {
      durability:
        (raw.physical as { durability?: number } | undefined)?.durability ??
        defaultDurabilityForAge(age),
    },
    conditioning: typeof raw.conditioning === "number" ? raw.conditioning : 100,
    injuryHistory: Array.isArray(raw.injuryHistory)
      ? (raw.injuryHistory as Player["injuryHistory"])
      : [],
  };
}

function estimateLegacyInjuredOn(
  currentDate: string,
  estimatedDaysAgo: number,
): string {
  try {
    return addCalendarDays(currentDate, -estimatedDaysAgo);
  } catch {
    return currentDate;
  }
}

function expandLegacyPlayerInjury(
  raw: Record<string, unknown>,
  currentDate: string,
): PlayerInjury {
  if (
    typeof raw.injuryId === "string" &&
    typeof raw.catalogKey === "string" &&
    typeof raw.bodyPart === "string"
  ) {
    return {
      ...(raw as unknown as PlayerInjury),
      severity: migrateLegacySeverity(String(raw.severity)),
      isLegacyData: raw.isLegacyData === true ? true : undefined,
    };
  }

  const type =
    typeof raw.type === "string" && raw.type.length > 0
      ? raw.type
      : "Undisclosed";
  const severity = migrateLegacySeverity(
    typeof raw.severity === "string" ? raw.severity : "unknown",
  );
  const isUndisclosed = type === "Undisclosed";
  const gamesRemaining = raw.gamesRemaining as
    { min: number; max: number } | null | undefined;
  const estimatedDays =
    gamesRemaining != null
      ? Math.max(
          3,
          Math.round(((gamesRemaining.min + gamesRemaining.max) / 2) * 2),
        )
      : 10;
  const injuredOn = estimateLegacyInjuredOn(currentDate, estimatedDays);

  if (isUndisclosed) {
    return {
      ...createLegacyUndisclosedInjury(injuredOn),
      recoveryProgress:
        typeof raw.recoveryProgress === "number" ? raw.recoveryProgress : 0,
      recommendedWorkloadMpg:
        typeof raw.recommendedWorkloadMpg === "number"
          ? raw.recommendedWorkloadMpg
          : null,
      maximumWorkloadMpg:
        typeof raw.maximumWorkloadMpg === "number" ? raw.maximumWorkloadMpg : 0,
    };
  }

  const maxMpg =
    typeof raw.maximumWorkloadMpg === "number" ? raw.maximumWorkloadMpg : null;
  const gameRestriction =
    maxMpg === 0
      ? "out"
      : maxMpg != null && maxMpg < 28
        ? "limited"
        : "monitor";

  return {
    injuryId: `legacy_${type.replace(/\s+/g, "_").toLowerCase()}_${injuredOn}`,
    catalogKey: "undisclosed",
    type,
    bodyPart: "unknown",
    severity,
    injuredOn,
    expectedReturnWindow: {
      earliest: addCalendarDays(injuredOn, Math.max(1, estimatedDays - 2)),
      latest: addCalendarDays(injuredOn, estimatedDays + 4),
    },
    recoveryProgress:
      typeof raw.recoveryProgress === "number" ? raw.recoveryProgress : 0,
    practiceRestriction: gameRestriction === "out" ? "none" : "rehab",
    gameRestriction,
    minutesRestriction: maxMpg,
    recommendedWorkloadMpg:
      typeof raw.recommendedWorkloadMpg === "number"
        ? raw.recommendedWorkloadMpg
        : null,
    maximumWorkloadMpg: maxMpg,
    reinjuryRisk: 0.12,
    temporaryEffects: [],
    temporaryFrustration: 10,
    isReinjury: false,
    isAggravation: false,
    priorInjuryId: null,
    chronic: false,
    isLegacyData: true,
    exposureSource: "off_court",
  };
}

export type GameStateV55 = Omit<GameState, "meta" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 55 };
  business: Omit<GameState["business"], "awards">;
};

/**
 * Deterministic v55 → v56: Development League profile on players,
 * competition.developmentLeague slice, playerHistory.development bucket.
 */
export function migrateV55ToV56(state: GameStateV55): GameStateV56 {
  const players: GameState["world"]["players"] = {};
  for (const [playerId, raw] of Object.entries(state.world.players)) {
    const player = raw as Player;
    const existing = (raw as { developmentLeague?: unknown }).developmentLeague;
    players[playerId] = {
      ...player,
      developmentLeague:
        existing != null && typeof existing === "object"
          ? (existing as Player["developmentLeague"])
          : createDefaultDevelopmentLeagueProfile(),
    };
  }

  const seasonId = state.competition.season.id;
  const standingsByTeamId: Record<
    string,
    ReturnType<typeof createEmptyTeamStanding>
  > = {};
  for (const team of Object.values(state.world.teams)) {
    standingsByTeamId[team.id] = createEmptyTeamStanding(team.id);
  }

  const existingDl = (
    state.competition as {
      developmentLeague?: GameState["competition"]["developmentLeague"];
    }
  ).developmentLeague;

  const playerHistory: GameState["business"]["playerHistory"] = {};
  for (const [playerId, history] of Object.entries(
    state.business.playerHistory ?? {},
  )) {
    playerHistory[playerId] = {
      ...history,
      seasons: history.seasons.map((season) => {
        const competition = season.competition as {
          regular: (typeof season.competition)["regular"];
          playoffs: (typeof season.competition)["playoffs"];
          combined: (typeof season.competition)["combined"];
          development?: (typeof season.competition)["regular"];
        };
        return {
          ...season,
          competition: {
            regular: competition.regular,
            playoffs: competition.playoffs,
            development:
              competition.development ?? createEmptyPlayerSeasonStatLine(),
            combined: competition.combined,
          },
        };
      }),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 56,
    },
    world: {
      ...state.world,
      players,
    },
    competition: {
      ...state.competition,
      developmentLeague: existingDl ?? {
        schedule: {
          seasonId,
          gameIds: [],
          gameIdsByDate: {},
        },
        games: {},
        standings: { byTeamId: standingsByTeamId },
      },
    },
    business: {
      ...state.business,
      playerHistory,
    },
  };
}
