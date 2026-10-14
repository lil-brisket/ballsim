import { type GameState, EMPTY_AI_ASSIST_STATE } from "@/state/game-state";
import { type TeamId, asTeamId } from "@/domain/ids";
import { defaultOwnerPatience } from "@/systems/owner-philosophy-config";
import { DEFAULT_OWNER_PHILOSOPHY } from "@/domain/entities/owner-philosophy";
import { createDefaultOwnershipConfidence } from "@/domain/entities/ownership-confidence";
import {
  createEmptyMediaFeed,
  createEmptyMediaReadState,
} from "@/domain/entities/media-item";
import { createEmptySocialFeed } from "@/domain/entities/social-post";
import {
  emptyTeamRosterManagement,
  type RotationStyle,
  philosophyFromStyle,
  styleFromPhilosophy,
  depthForPhilosophy,
} from "@/domain/entities/team-roster-management";
import { recommendRosterManagement } from "@/systems/roster-management";
import type { TeamFinances } from "@/domain/entities/finances";
import { migrateLegacyRotationEntry } from "@/systems/rotation/migrate-rotation-entry";
import {
  type CompetitionSlicePreV49,
  legacyUserRecord,
  hasModernOwnershipUser,
  resolveLegacyControlledTeamId,
  legacyUserArray,
  type UserSlicePreV49,
} from "@/persistence/mappers/game-state-migrations/shared";
import type { GameStateV48 } from "@/persistence/mappers/game-state-migrations/v48-v55";

export type GameStateV42 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 42;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: {
    controlledTeamId: string;
    mode: GameState["user"]["mode"];
    citySelectionConfirmed: boolean;
    franchiseIdentityConfirmed: boolean;
    ownerStartSeasonYear: number;
    ownerPhilosophy: string;
    ownerPatience: number;
    ownershipConfidence: GameState["user"]["ownedFranchises"][string]["ownershipConfidence"];
    objectives: GameState["user"]["ownedFranchises"][string]["objectives"];
    notifications: GameState["user"]["ownedFranchises"][string]["notifications"];
    eventLog: GameState["user"]["ownedFranchises"][string]["eventLog"];
    appliedGameplayConsequenceKeys: Record<string, true>;
    explicitDecisions: Record<string, true>;
    phaseSkips: GameState["user"]["ownedFranchises"][string]["phaseSkips"];
    aiAssistState: GameState["user"]["ownedFranchises"][string]["aiAssistState"];
    pendingOwnerDecisions: Array<{
      id: string;
      type: "trade_offer";
      createdOn: string;
      payload: {
        offeringTeamId: string;
        userTeamId: string;
        proposal: unknown;
        fingerprint: string;
      };
      blockingLevel?: "blocking" | "non_blocking";
      primaryTeamId?: string;
      participantTeamIds?: string[];
    }>;
    ownerDecisionHistory: Array<{
      id: string;
      type: "trade_offer";
      status: "accepted" | "declined" | "delegated";
      decisionSource: "owner" | "owner_ai";
      createdOn: string;
      resolvedOn: string;
      fingerprint: string;
      expiresOn?: string;
      payload: {
        offeringTeamId: string;
        userTeamId: string;
        proposal: unknown;
        fingerprint: string;
      };
      blockingLevel?: "blocking" | "non_blocking";
      primaryTeamId?: string;
      participantTeamIds?: string[];
    }>;
    narrative: GameState["user"]["ownedFranchises"][string]["narrative"];
  };
};

/**
 * Deterministic v42 → v43: multi-team ownership.
 * Moves owner fields into ownedFranchises[controlledTeamId].
 * Pending decisions stay on UserSlice with participant metadata.
 */
export function migrateV42ToV43(state: GameStateV42): GameStateV43 {
  const userRecord = legacyUserRecord(state.user);
  if (hasModernOwnershipUser(userRecord)) {
    return {
      ...state,
      meta: {
        ...state.meta,
        schemaVersion: 43,
      },
    } as unknown as GameStateV43;
  }

  const controlledTeamId = resolveLegacyControlledTeamId(userRecord) as TeamId;
  const aiAssistance = {
    ...state.settings.ai.assistance,
  };
  const managementPreset = state.settings.ai.managementPreset;

  const franchise: GameState["user"]["ownedFranchises"][string] & {
    ownerPhilosophy?: string;
  } = {
    ownerPatience:
      (userRecord.ownerPatience as number | undefined) ??
      defaultOwnerPatience(DEFAULT_OWNER_PHILOSOPHY),
    ownershipConfidence:
      (userRecord.ownershipConfidence as GameState["user"]["ownedFranchises"][string]["ownershipConfidence"]) ??
      createDefaultOwnershipConfidence(state.world.calendar.currentDate),
    objectives: legacyUserArray(userRecord.objectives),
    narrative:
      (userRecord.narrative as GameState["user"]["ownedFranchises"][string]["narrative"]) ?? {
        situations: [],
        snapshots: [],
        cooldowns: {},
      },
    notifications: legacyUserArray(userRecord.notifications),
    eventLog: legacyUserArray(userRecord.eventLog),
    mediaFeed: createEmptyMediaFeed(),
    socialFeed: createEmptySocialFeed(),
    mediaReadState: createEmptyMediaReadState(),
    appliedGameplayConsequenceKeys:
      (userRecord.appliedGameplayConsequenceKeys as Record<string, true>) ?? {},
    explicitDecisions:
      (userRecord.explicitDecisions as Record<string, true>) ?? {},
    phaseSkips: legacyUserArray(userRecord.phaseSkips),
    aiAssistance,
    managementPreset,
    aiAssistState:
      (userRecord.aiAssistState as GameState["user"]["ownedFranchises"][string]["aiAssistState"]) ?? {
        resolvedNeeds: {},
        seasonCounters: { ...EMPTY_AI_ASSIST_STATE.seasonCounters },
      },
    citySelectionConfirmed: Boolean(userRecord.citySelectionConfirmed),
    franchiseIdentityConfirmed: Boolean(userRecord.franchiseIdentityConfirmed),
    ownerStartSeasonYear:
      (userRecord.ownerStartSeasonYear as number | undefined) ??
      state.competition.season.year,
  };

  const pendingOwnerDecisions: GameState["user"]["pendingOwnerDecisions"] =
    legacyUserArray<GameStateV42["user"]["pendingOwnerDecisions"][number]>(
      userRecord.pendingOwnerDecisions,
    ).map((decision) => {
      const userTeamId = decision.payload.userTeamId as TeamId;
      const offeringTeamId = decision.payload.offeringTeamId as TeamId;
      const primaryTeamId =
        (decision.primaryTeamId as TeamId | undefined) ?? userTeamId;
      const participantTeamIds = decision.participantTeamIds
        ? (decision.participantTeamIds as TeamId[])
        : ([userTeamId, offeringTeamId].filter(
            (id, index, arr) => arr.indexOf(id) === index,
          ) as TeamId[]);
      if (!participantTeamIds.includes(primaryTeamId)) {
        participantTeamIds.unshift(primaryTeamId);
      }
      return {
        id: decision.id as GameState["user"]["pendingOwnerDecisions"][number]["id"],
        type: "trade_offer" as const,
        createdOn: decision.createdOn,
        blockingLevel: decision.blockingLevel ?? "blocking",
        primaryTeamId,
        participantTeamIds,
        payload: {
          offerId:
            (decision.payload as { offerId?: string }).offerId ??
            String(decision.id),
          offeringTeamId,
          userTeamId,
          proposal: decision.payload
            .proposal as GameState["user"]["pendingOwnerDecisions"][number]["payload"]["proposal"],
          originalProposal:
            ((
              decision.payload as {
                originalProposal?: typeof decision.payload.proposal;
              }
            )
              .originalProposal as GameState["user"]["pendingOwnerDecisions"][number]["payload"]["originalProposal"]) ??
            (decision.payload
              .proposal as GameState["user"]["pendingOwnerDecisions"][number]["payload"]["proposal"]),
          currentProposal:
            ((
              decision.payload as {
                currentProposal?: typeof decision.payload.proposal;
              }
            )
              .currentProposal as GameState["user"]["pendingOwnerDecisions"][number]["payload"]["currentProposal"]) ??
            (decision.payload
              .proposal as GameState["user"]["pendingOwnerDecisions"][number]["payload"]["proposal"]),
          negotiationHistory:
            (
              decision.payload as {
                negotiationHistory?: GameState["user"]["pendingOwnerDecisions"][number]["payload"]["negotiationHistory"];
              }
            ).negotiationHistory ?? [],
          status:
            (
              decision.payload as {
                status?: GameState["user"]["pendingOwnerDecisions"][number]["payload"]["status"];
              }
            ).status ?? "pending",
          motivation: (
            decision.payload as {
              motivation?: GameState["user"]["pendingOwnerDecisions"][number]["payload"]["motivation"];
            }
          ).motivation,
          fingerprint: decision.payload.fingerprint,
          createdOn:
            (decision.payload as { createdOn?: string }).createdOn ??
            decision.createdOn,
          expiresOn: (decision.payload as { expiresOn?: string }).expiresOn,
        },
      };
    });

  const ownerDecisionHistory: GameState["user"]["ownerDecisionHistory"] =
    legacyUserArray<GameStateV42["user"]["ownerDecisionHistory"][number]>(
      userRecord.ownerDecisionHistory,
    ).map((record) => {
      const userTeamId = record.payload.userTeamId as TeamId;
      const offeringTeamId = record.payload.offeringTeamId as TeamId;
      const primaryTeamId =
        (record.primaryTeamId as TeamId | undefined) ?? userTeamId;
      const participantTeamIds = record.participantTeamIds
        ? (record.participantTeamIds as TeamId[])
        : ([userTeamId, offeringTeamId].filter(
            (id, index, arr) => arr.indexOf(id) === index,
          ) as TeamId[]);
      if (!participantTeamIds.includes(primaryTeamId)) {
        participantTeamIds.unshift(primaryTeamId);
      }
      return {
        id: record.id as GameState["user"]["ownerDecisionHistory"][number]["id"],
        type: "trade_offer" as const,
        status: record.status,
        decisionSource: record.decisionSource,
        createdOn: record.createdOn,
        resolvedOn: record.resolvedOn,
        fingerprint: record.fingerprint,
        blockingLevel: record.blockingLevel ?? "blocking",
        primaryTeamId,
        participantTeamIds,
        ...(record.expiresOn !== undefined
          ? { expiresOn: record.expiresOn }
          : {}),
        payload: {
          offerId:
            (record.payload as { offerId?: string }).offerId ??
            String(record.id),
          offeringTeamId,
          userTeamId,
          proposal: record.payload
            .proposal as GameState["user"]["ownerDecisionHistory"][number]["payload"]["proposal"],
          originalProposal:
            ((
              record.payload as {
                originalProposal?: typeof record.payload.proposal;
              }
            )
              .originalProposal as GameState["user"]["ownerDecisionHistory"][number]["payload"]["originalProposal"]) ??
            (record.payload
              .proposal as GameState["user"]["ownerDecisionHistory"][number]["payload"]["proposal"]),
          currentProposal:
            ((
              record.payload as {
                currentProposal?: typeof record.payload.proposal;
              }
            )
              .currentProposal as GameState["user"]["ownerDecisionHistory"][number]["payload"]["currentProposal"]) ??
            (record.payload
              .proposal as GameState["user"]["ownerDecisionHistory"][number]["payload"]["proposal"]),
          negotiationHistory:
            (
              record.payload as {
                negotiationHistory?: GameState["user"]["ownerDecisionHistory"][number]["payload"]["negotiationHistory"];
              }
            ).negotiationHistory ?? [],
          status:
            (
              record.payload as {
                status?: GameState["user"]["ownerDecisionHistory"][number]["payload"]["status"];
              }
            ).status ??
            (record.status === "accepted"
              ? "accepted"
              : (record.status as string) === "expired"
                ? "expired"
                : "declined"),
          motivation: (
            record.payload as {
              motivation?: GameState["user"]["ownerDecisionHistory"][number]["payload"]["motivation"];
            }
          ).motivation,
          fingerprint: record.payload.fingerprint,
          createdOn:
            (record.payload as { createdOn?: string }).createdOn ??
            record.createdOn,
          expiresOn: (record.payload as { expiresOn?: string }).expiresOn,
        },
      };
    });

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 43,
    },
    user: {
      ownedTeamIds: [controlledTeamId],
      activeOwnerTeamId: controlledTeamId,
      ownedFranchises: {
        [controlledTeamId]: franchise,
      },
      mode: state.user.mode,
      pendingOwnerDecisions,
      ownerDecisionHistory,
    },
  };
}

export type GameStateV43 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 43;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: GameState["business"];
  user: {
    ownedTeamIds: TeamId[];
    activeOwnerTeamId: TeamId;
    ownedFranchises: Record<
      string,
      GameState["user"]["ownedFranchises"][string] & {
        ownerPhilosophy?: string;
      }
    >;
    mode: GameState["user"]["mode"];
    pendingOwnerDecisions: GameState["user"]["pendingOwnerDecisions"];
    ownerDecisionHistory: GameState["user"]["ownerDecisionHistory"];
  };
};

/**
 * Deterministic v43 → v44: drop per-franchise ownerPhilosophy and ensure
 * settings.ownership.controlledTeamCount defaults to 1.
 * Mandate weights now come from getDefaultOwnerMandateProfile().
 * Emits literal schemaVersion 44. No RNG.
 */
export function migrateV43ToV44(state: GameStateV43): GameStateV44 {
  const ownedFranchises: GameState["user"]["ownedFranchises"] = {};
  for (const [teamId, franchise] of Object.entries(
    state.user.ownedFranchises,
  )) {
    const { ownerPhilosophy: _removed, ...rest } = franchise;
    void _removed;
    ownedFranchises[teamId] = rest;
  }

  const settingsRecord = state.settings as GameState["settings"] & {
    ownership?: { controlledTeamCount?: number };
  };
  const controlledTeamCount =
    typeof settingsRecord.ownership?.controlledTeamCount === "number" &&
    Number.isInteger(settingsRecord.ownership.controlledTeamCount) &&
    settingsRecord.ownership.controlledTeamCount >= 1
      ? Math.min(
          settingsRecord.ownership.controlledTeamCount,
          Math.max(1, Object.keys(state.world.teams).length),
        )
      : 1;

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 44,
    },
    settings: {
      ...state.settings,
      ownership: { controlledTeamCount },
    },
    user: {
      ...state.user,
      ownedFranchises,
    },
  };
}

export type GameStateV44 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 44;
  };
  settings: GameState["settings"];
  world: {
    calendar: GameState["world"]["calendar"];
    league: GameState["world"]["league"];
    conferences: GameState["world"]["conferences"];
    divisions: GameState["world"]["divisions"];
    teams: Record<
      string,
      Omit<GameState["world"]["teams"][string], "rosterManagement"> & {
        rosterManagement?: GameState["world"]["teams"][string]["rosterManagement"];
      }
    >;
    players: GameState["world"]["players"];
    coaches: GameState["world"]["coaches"];
    staff: GameState["world"]["staff"];
    draftPicks: GameState["world"]["draftPicks"];
    drafts: GameState["world"]["drafts"];
    scheduledEvents: GameState["world"]["scheduledEvents"];
  };
  competition: Omit<
    GameState["competition"],
    "seasonEventLog" | "phase" | "seasonEvents"
  > & {
    seasonEventLog?: GameState["competition"]["seasonEventLog"];
  };
  business: GameState["business"];
  user: UserSlicePreV49;
};

/**
 * Deterministic v44 → v45: add Team.rosterManagement + competition.seasonEventLog.
 * Derives initial lineups from roster via recommendRosterManagement.
 * Emits literal schemaVersion 45. No RNG.
 */
export function migrateV44ToV45(state: GameStateV44): GameStateV45 {
  let working = {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 45 as const,
    },
    world: {
      ...state.world,
      teams: Object.fromEntries(
        Object.entries(state.world.teams).map(([id, team]) => [
          id,
          {
            ...team,
            rosterManagement:
              team.rosterManagement ?? emptyTeamRosterManagement(),
          },
        ]),
      ) as GameState["world"]["teams"],
    },
    competition: {
      ...state.competition,
      seasonEventLog: state.competition.seasonEventLog ?? [],
    },
  } as unknown as GameStateV45;

  for (const teamId of Object.keys(working.world.teams)) {
    const management = recommendRosterManagement(
      working as unknown as GameState,
      asTeamId(teamId),
      {
        configuredBy: "default",
      },
    );
    working = {
      ...working,
      world: {
        ...working.world,
        teams: {
          ...working.world.teams,
          [teamId]: {
            ...working.world.teams[teamId]!,
            rosterManagement: management,
          },
        },
      },
    };
  }

  return working;
}

type TeamFinancesV45 = {
  teamId: TeamId;
  cash: number;
  payroll: number;
  booksByYear: TeamFinances["booksByYear"];
  attendanceByYear?: Record<string, number>;
  booksByMonth: TeamFinances["booksByMonth"];
  cashLedgerByMonth: Record<
    string,
    {
      openCash: number;
      playerPayrollOutflow: number;
      netCashChange: number;
    }
  >;
};

export type GameStateV45 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 45;
    rngState: number;
  };
  settings: GameState["settings"] & {
    financialRules: GameState["settings"]["financialRules"] & {
      salaryCap?: number;
      staffBudget?: number;
    };
  };
  world: GameState["world"];
  competition: CompetitionSlicePreV49;
  business: Omit<GameState["business"], "finances" | "franchiseHistory"> & {
    finances: Record<string, TeamFinancesV45>;
    franchiseHistory: Record<
      string,
      {
        teamId: TeamId;
        seasons: Array<
          Record<string, unknown> & {
            cash?: number;
            businessFunds?: number;
          }
        >;
      }
    >;
  };
  user: UserSlicePreV49;
};

export type GameStateV46 = Omit<
  GameState,
  "meta" | "world" | "competition" | "user"
> & {
  meta: { schemaVersion: 46; [key: string]: unknown };
  world: {
    teams: Record<
      string,
      Omit<GameState["world"]["teams"][string], "rosterManagement"> & {
        rosterManagement: {
          startingLineup: GameState["world"]["teams"][string]["rosterManagement"]["startingLineup"];
          bench: string[];
          inactive: string[];
          rotation: Array<{
            playerId: string;
            plannedMinutes: number;
            eligiblePositions: string[];
            role: "starter" | "bench";
          }>;
          rotationStyle: RotationStyle;
          lastConfiguredBy: "default" | "user" | "ai";
        };
      }
    >;
    [key: string]: unknown;
  };
  competition: CompetitionSlicePreV49;
  user: UserSlicePreV49;
};

/**
 * Deterministic v45 → v46: rename TeamFinances cash → businessFunds,
 * cashLedgerByMonth → businessFundsLedgerByMonth (openCash/netCashChange),
 * FranchiseSeasonRecord.cash → businessFunds, ensure salaryCap + staffBudget.
 * Emits literal schemaVersion 46. No RNG.
 */
export function migrateV45ToV46(state: GameStateV45): GameStateV46 {
  const finances: Record<string, TeamFinances> = {};
  for (const [teamId, finance] of Object.entries(state.business.finances)) {
    const legacy = finance as TeamFinancesV45 & {
      businessFunds?: number;
      businessFundsLedgerByMonth?: TeamFinances["businessFundsLedgerByMonth"];
    };
    const businessFundsLedgerByMonth: TeamFinances["businessFundsLedgerByMonth"] =
      {};
    const rawLedger =
      legacy.businessFundsLedgerByMonth ?? legacy.cashLedgerByMonth ?? {};
    for (const [monthKey, entry] of Object.entries(rawLedger)) {
      const e = entry as {
        openBusinessFunds?: number;
        openCash?: number;
        playerPayrollOutflow?: number;
        netBusinessFundsChange?: number;
        netCashChange?: number;
      };
      businessFundsLedgerByMonth[monthKey] = {
        openBusinessFunds: e.openBusinessFunds ?? e.openCash ?? 0,
        playerPayrollOutflow: e.playerPayrollOutflow ?? 0,
        netBusinessFundsChange:
          e.netBusinessFundsChange ?? e.netCashChange ?? 0,
      };
    }
    finances[teamId] = {
      teamId: finance.teamId,
      businessFunds: legacy.businessFunds ?? legacy.cash ?? 0,
      payroll: finance.payroll,
      booksByYear: finance.booksByYear ?? {},
      attendanceByYear: finance.attendanceByYear ?? {},
      booksByMonth: finance.booksByMonth ?? {},
      businessFundsLedgerByMonth,
    };
  }

  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const [teamId, history] of Object.entries(
    state.business.franchiseHistory ?? {},
  )) {
    franchiseHistory[teamId] = {
      teamId: history.teamId,
      seasons: history.seasons.map((season) => {
        const raw = season as Record<string, unknown>;
        const { cash: legacyCash, businessFunds: existingFunds, ...rest } = raw;
        return {
          ...rest,
          businessFunds:
            typeof existingFunds === "number"
              ? existingFunds
              : typeof legacyCash === "number"
                ? legacyCash
                : 0,
        };
      }) as GameState["business"]["franchiseHistory"][string]["seasons"],
    };
  }

  const financialRules = {
    ...state.settings.financialRules,
    salaryCap: state.settings.financialRules.salaryCap ?? 100_000_000,
    staffBudget: state.settings.financialRules.staffBudget ?? 12_000_000,
  };

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 46,
    },
    settings: {
      ...state.settings,
      financialRules,
    },
    business: {
      ...state.business,
      finances,
      franchiseHistory,
    },
  } as unknown as GameStateV46;
}

/**
 * Deterministic v46 → v47: expand TeamRosterManagement rotation entries
 * (target/min/normalMax/absoluteMax, rotationStatus, philosophy, depth, etc.).
 * Conservative: rotationStatus active only when plannedMinutes > 0.
 * Idempotent if entries already have targetMinutes (e.g. fresh recommend during v44→v45).
 * Emits literal schemaVersion 47. No RNG.
 */
export function migrateV46ToV47(state: GameStateV46): GameStateV47 {
  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    const legacy = team.rosterManagement as {
      startingLineup?: GameState["world"]["teams"][string]["rosterManagement"]["startingLineup"];
      bench?: string[];
      inactive?: string[];
      rotation?: Array<Record<string, unknown>>;
      rotationStyle?: RotationStyle;
      rotationPhilosophy?: string;
      rotationDepth?: number;
      rotationPreset?: string;
      closingLineupPolicy?: string;
      closingLineupIds?: string[];
      lastConfiguredBy?: "default" | "user" | "ai";
    };
    const style: RotationStyle =
      legacy?.rotationStyle === "tight" ||
      legacy?.rotationStyle === "deep" ||
      legacy?.rotationStyle === "balanced"
        ? legacy.rotationStyle
        : "balanced";
    const philosophy =
      legacy?.rotationPhilosophy === "deep" ||
      legacy?.rotationPhilosophy === "tight" ||
      legacy?.rotationPhilosophy === "star_heavy" ||
      legacy?.rotationPhilosophy === "development" ||
      legacy?.rotationPhilosophy === "balanced"
        ? legacy.rotationPhilosophy
        : philosophyFromStyle(style);

    const rotation = (legacy?.rotation ?? []).map((entry) => {
      if (typeof entry.targetMinutes === "number") {
        return entry as unknown as GameState["world"]["teams"][string]["rosterManagement"]["rotation"][number];
      }
      return migrateLegacyRotationEntry({
        playerId: String(entry.playerId ?? ""),
        plannedMinutes:
          typeof entry.plannedMinutes === "number" ? entry.plannedMinutes : 0,
        eligiblePositions: Array.isArray(entry.eligiblePositions)
          ? (entry.eligiblePositions as string[])
          : Array.isArray(entry.preferredPositions)
            ? (entry.preferredPositions as string[])
            : [],
        role: entry.role === "starter" ? "starter" : "bench",
      });
    });

    teams[teamId] = {
      ...team,
      rosterManagement: {
        startingLineup: legacy?.startingLineup ?? [],
        bench: [...(legacy?.bench ?? [])],
        inactive: [...(legacy?.inactive ?? [])],
        rotation,
        rotationStyle: styleFromPhilosophy(philosophy),
        rotationPhilosophy: philosophy,
        rotationDepth:
          typeof legacy?.rotationDepth === "number"
            ? legacy.rotationDepth
            : depthForPhilosophy(philosophy),
        rotationPreset:
          legacy?.rotationPreset === "auto" ||
          legacy?.rotationPreset === "balanced" ||
          legacy?.rotationPreset === "star_heavy" ||
          legacy?.rotationPreset === "deep" ||
          legacy?.rotationPreset === "development" ||
          legacy?.rotationPreset === "custom"
            ? legacy.rotationPreset
            : "custom",
        closingLineupPolicy:
          legacy?.closingLineupPolicy === "starters" ||
          legacy?.closingLineupPolicy === "custom" ||
          legacy?.closingLineupPolicy === "auto"
            ? legacy.closingLineupPolicy
            : "auto",
        closingLineupIds: [...(legacy?.closingLineupIds ?? [])],
        lastConfiguredBy: legacy?.lastConfiguredBy ?? "default",
      },
    } as GameState["world"]["teams"][string];
  }

  return {
    ...(state as unknown as GameStateV47),
    meta: {
      ...(state as unknown as GameStateV47).meta,
      schemaVersion: 47,
    },
    world: {
      ...(state as unknown as GameStateV47).world,
      teams,
    },
  };
}

export type GameStateV47 = Omit<
  GameState,
  "meta" | "world" | "settings" | "competition" | "user"
> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 47 };
  world: Omit<GameState["world"], "fantasyDraft">;
  competition: CompetitionSlicePreV49;
  user: UserSlicePreV49;
  settings: Omit<GameState["settings"], "draft"> & {
    draft: {
      mode: "standard" | "fantasy";
      userPickPosition: number | null;
      randomizeUserPick: boolean;
      type?: "snake" | "linear";
      timerSeconds?: number | null;
      orderMode?: "random" | "manual";
    };
  };
};

/**
 * Deterministic v47 → v48: add world.fantasyDraft (null) and expand draft settings.
 * Emits literal schemaVersion 48. No RNG.
 */
export function migrateV47ToV48(state: GameStateV47): GameStateV48 {
  const legacyDraft = state.settings.draft;
  const orderMode =
    legacyDraft.orderMode ??
    (legacyDraft.randomizeUserPick ? "random" : "manual");
  return {
    ...(state as unknown as GameStateV48),
    meta: {
      ...(state as unknown as GameStateV48).meta,
      schemaVersion: 48,
    },
    settings: {
      ...state.settings,
      draft: {
        mode: legacyDraft.mode,
        type: legacyDraft.type ?? "snake",
        timerSeconds: legacyDraft.timerSeconds ?? null,
        orderMode,
        userPickPosition: legacyDraft.userPickPosition ?? null,
        randomizeUserPick: legacyDraft.randomizeUserPick ?? false,
      },
    },
    world: {
      ...(state as unknown as GameStateV48).world,
      fantasyDraft: null,
    },
  };
}
