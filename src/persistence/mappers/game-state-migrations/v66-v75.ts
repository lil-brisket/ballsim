import {
  DEFAULT_DRAFT_LOTTERY_SETTINGS,
  DEFAULT_PAYROLL_RULE_SETTINGS,
} from "@/domain/game-settings";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import type { PlayerId } from "@/domain/ids";
import { isJerseyNumber, preferredJerseyNumber } from "@/domain/jersey-number";
import { DEFAULT_PARTICIPATION_STATE } from "@/domain/participation";
import type { GameState } from "@/state/game-state";
import { reconcileJerseyNumbers } from "@/systems/jersey-numbers";
import type { TeamPlayStyle } from "@/persistence/mappers/game-state-migrations/legacy-team-play-style";

export type GameStateV66 = Omit<GameState, "meta" | "user" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 66 };
  user: Omit<GameState["user"], "participation">;
  competition: Omit<GameState["competition"], "aiTradeSearch">;
};

export type GameStateV67 = Omit<GameStateV68, "meta" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 67 };
  competition: Omit<GameState["competition"], "aiTradeSearch">;
};

export type GameStateV68 = Omit<GameState, "meta" | "world"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 68 };
  world: Omit<GameState["world"], "players"> & {
    players: Record<PlayerId, Omit<Player, "jerseyNumber">>;
  };
};

export type GameStateV70 = Omit<GameState, "meta" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 70 };
  business: Omit<GameState["business"], "deadMoney" | "extensionTalks">;
};

export type GameStateV76 = Omit<GameState, "meta" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 76 };
  business: Omit<GameState["business"], "developmentPlans">;
};

export type GameStateV75 = Omit<GameState, "meta" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 75 };
  business: Omit<GameState["business"], "playerMorale" | "developmentPlans">;
};

export type GameStateV74 = Omit<GameState, "meta" | "settings"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 74 };
  settings: Omit<GameState["settings"], "draftLottery">;
};

export type GameStateV73 = Omit<GameState, "meta" | "settings" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 73 };
  settings: Omit<GameState["settings"], "financialRules"> & {
    financialRules: Omit<
      GameState["settings"]["financialRules"],
      keyof typeof DEFAULT_PAYROLL_RULE_SETTINGS
    >;
  };
  business: Omit<GameState["business"], "payrollAssessments">;
};

export type GameStateV72 = Omit<GameState, "meta" | "settings"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 72 };
  settings: Omit<GameState["settings"], "offseason"> & {
    offseason: Omit<GameState["settings"]["offseason"], "restrictedFreeAgency">;
  };
};

export type GameStateV71 = Omit<GameState, "meta" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 71 };
  business: Omit<GameState["business"], "extensionTalks">;
};

export type GameStateV69 = Omit<GameState, "meta" | "world" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 69 };
  world: Omit<GameState["world"], "teams"> & {
    teams: Record<string, Team & { playStyle?: TeamPlayStyle }>;
  };
  business: Omit<GameState["business"], "deadMoney" | "extensionTalks">;
};

/**
 * Deterministic v66 → v67: add user.participation. Every pre-existing save is
 * single-player, so all owned teams stay with the one human owner.
 */
export function migrateV66ToV67(state: GameStateV66): GameStateV67 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 67,
    },
    user: {
      ...state.user,
      participation: { ...DEFAULT_PARTICIPATION_STATE },
    },
  };
}

/**
 * Deterministic v67 → v68: add competition.aiTradeSearch. Empty memory means
 * every CPU team runs its trade search on the next day, exactly as before.
 */
export function migrateV67ToV68(state: GameStateV67): GameStateV68 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 68,
    },
    competition: {
      ...state.competition,
      aiTradeSearch: { byTeamId: {} },
    },
  };
}

/**
 * Deterministic v68 → v69: add Player.jerseyNumber. Every player gets his
 * preferred number (from his id, no RNG), then duplicates within a franchise
 * are resolved: the longest-serving player keeps the number.
 */
export function migrateV68ToV69(state: GameStateV68): GameStateV69 {
  const players: Record<PlayerId, Player> = {};
  for (const [id, player] of Object.entries(state.world.players)) {
    players[id as PlayerId] = {
      ...player,
      // Keep a valid number if one is somehow present; otherwise prefer.
      jerseyNumber: isJerseyNumber((player as Partial<Player>).jerseyNumber)
        ? (player as Player).jerseyNumber
        : preferredJerseyNumber(player.id),
    };
  }
  const migrated = reconcileJerseyNumbers({
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 69,
    },
    world: {
      ...state.world,
      players,
    },
  } as unknown as GameState);
  return migrated as unknown as GameStateV69;
}

/**
 * Deterministic v69 → v70: drop Team.playStyle. It was generated and stored
 * but never read; Team.coachingPhilosophy carries team style.
 */
export function migrateV69ToV70(state: GameStateV69): GameStateV70 {
  const teams: Record<string, Team> = {};
  for (const [id, team] of Object.entries(state.world.teams)) {
    const { playStyle: _playStyle, ...rest } = team;
    teams[id] = rest;
  }
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 70,
    },
    world: {
      ...state.world,
      teams,
    },
  };
}

/**
 * Deterministic v70 → v71: add business.deadMoney. No save could release a
 * player under contract before v71, so every team starts with none.
 */
export function migrateV70ToV71(state: GameStateV70): GameStateV71 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 71,
    },
    business: {
      ...state.business,
      deadMoney: {},
    },
  };
}

/**
 * Deterministic v71 → v72: add business.extensionTalks. Owners could not
 * offer extensions before v72, so there are no talks to carry over.
 */
export function migrateV71ToV72(state: GameStateV71): GameStateV72 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 72,
    },
    business: {
      ...state.business,
      extensionTalks: {},
    },
  } as unknown as GameStateV72;
}

/**
 * Deterministic v72 → v73: add settings.offseason.restrictedFreeAgency, on.
 * RFA rules existed before but never ran (contracts ended before players
 * were classified); v73 turns them on for every save.
 */
export function migrateV72ToV73(state: GameStateV72): GameStateV73 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 73,
    },
    settings: {
      ...state.settings,
      offseason: {
        ...state.settings.offseason,
        restrictedFreeAgency: true,
      },
    },
  } as unknown as GameStateV73;
}

/**
 * Deterministic v73 → v74: payroll rules. Adds the tax threshold and rate,
 * the salary floor and veteran rights to settings (defaults), and an empty
 * business.payrollAssessments. luxuryTaxEnabled keeps its stored value; it
 * now runs.
 */
export function migrateV73ToV74(state: GameStateV73): GameStateV74 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 74,
    },
    settings: {
      ...state.settings,
      financialRules: {
        ...state.settings.financialRules,
        ...DEFAULT_PAYROLL_RULE_SETTINGS,
      },
    },
    business: {
      ...state.business,
      payrollAssessments: {},
    },
  } as unknown as GameStateV74;
}

/**
 * Deterministic v74 → v75: add settings.draftLottery, off. Existing leagues
 * keep the reverse-standings order unless the owner turns the lottery on.
 */
export function migrateV74ToV75(state: GameStateV74): GameStateV75 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 75,
    },
    settings: {
      ...state.settings,
      // A real v74 save has none; keep one if it is somehow present.
      draftLottery: (
        state.settings as Partial<Pick<GameState["settings"], "draftLottery">>
      ).draftLottery ?? { ...DEFAULT_DRAFT_LOTTERY_SETTINGS, enabled: false },
    },
  } as unknown as GameStateV75;
}

/**
 * Deterministic v75 → v76: add business.playerMorale. Everyone starts
 * content; moods move from the first in-season week.
 */
export function migrateV75ToV76(state: GameStateV75): GameStateV76 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 76,
    },
    business: {
      ...state.business,
      playerMorale: {},
    },
  };
}

/**
 * Deterministic v76 → v77: add business.developmentPlans. No plans before
 * v77: owner players develop balanced (exactly as before) until a focus is
 * chosen.
 */
export function migrateV76ToV77(state: GameStateV76): GameState {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 77,
    },
    business: {
      ...state.business,
      developmentPlans: {},
    },
  };
}
