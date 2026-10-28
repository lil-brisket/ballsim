import "server-only";
import {
  type GameSettings,
  cloneGameSettings,
  DEFAULT_GAME_SETTINGS,
  maxControlledTeamCountForLeague,
} from "@/domain/game-settings";
import {
  controlledTeamCountForSetup,
  LOCAL_SHARED_LEAGUE_AVAILABLE,
  ONLINE_LEAGUE_AVAILABLE,
  parseParticipationSetup,
} from "@/domain/participation";
import {
  createLocalSharedParticipation,
  createOnlineParticipation,
} from "@/systems/participation";
import type {
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";
import type { CustomContentStore } from "@/persistence/custom-content-store";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { toDashboardMomentsView } from "@/state/dashboard-moments";
import { toTransactionTickerView } from "@/state/transaction-ticker-selectors";
import { createInitialGameState } from "@/state/create-initial-state";
import { validateRosterPackage } from "@/systems/custom-content";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { validateGameState } from "@/persistence/validate-game-state";
import { toDashboardSnapshot, type DashboardSnapshot } from "@/state/selectors";
import { ownerNavGroupsForState } from "@/application/owner-nav-config";
import type { GameState } from "@/state/game-state";
import {
  type OwnerCommandResult,
  MAX_OWNER_SAVE_SLOTS,
  type CreateGameResult,
} from "@/application/game-service/types";
import {
  getStore,
  fail,
  getCustomStore,
  withPlayerPortraits,
  withDashboard,
  toSaveSummary,
} from "@/application/game-service/internal";

export async function createNewOwnerSave(
  input: {
    name: string;
    rngSeed?: number;
    settings?: GameSettings;
    rosterPackage?: unknown;
    rosterContentId?: string;
    /** Raw participation setup; omitted means single player. */
    participation?: unknown;
    /** Signed-in creator; required for online leagues (becomes host). */
    hostUser?: { id: string; username: string } | null;
  },
  store?: SaveGameStore,
  customStore?: CustomContentStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const existing = await saveStore.list();
  if (existing.length >= MAX_OWNER_SAVE_SLOTS) {
    return fail(
      `Owner Mode allows at most ${MAX_OWNER_SAVE_SLOTS} saves. Delete a save to create another.`,
    );
  }

  const settingsInput = cloneGameSettings(
    input.settings ?? DEFAULT_GAME_SETTINGS,
  );
  const validated = validateGameSettings(settingsInput);
  if (!validated.ok) {
    return fail(`Invalid game settings: ${validated.errors.join("; ")}`);
  }

  const participation = parseParticipationSetup(
    input.participation,
    maxControlledTeamCountForLeague(validated.settings.league.teamCount),
  );
  if (!participation.ok) {
    return fail(participation.errors.join("; "));
  }
  if (
    participation.value.mode === "local_shared" &&
    !LOCAL_SHARED_LEAGUE_AVAILABLE
  ) {
    return fail("Local shared leagues are not available yet.");
  }
  if (participation.value.mode === "online") {
    if (!ONLINE_LEAGUE_AVAILABLE) {
      return fail("Online leagues are not available yet.");
    }
    if (!input.hostUser) {
      return fail("Sign in to create an online league.");
    }
  }
  const sharedTeamCount = controlledTeamCountForSetup(participation.value);
  const gameSettings: GameSettings =
    sharedTeamCount === null
      ? validated.settings
      : {
          ...validated.settings,
          ownership: { controlledTeamCount: sharedTeamCount },
        };

  let rosterPackage = input.rosterPackage;
  if (
    rosterPackage === undefined &&
    input.rosterContentId !== undefined &&
    input.rosterContentId.length > 0
  ) {
    const stored = await getCustomStore(customStore).getByContentId(
      input.rosterContentId,
    );
    if (stored === null) {
      return fail("Custom roster package was not found.");
    }
    try {
      rosterPackage = JSON.parse(stored.payloadJson) as unknown;
    } catch {
      return fail("Stored custom roster package is not valid JSON.");
    }
  }

  if (
    validated.settings.draft.mode === "custom" &&
    rosterPackage === undefined
  ) {
    return fail("Custom roster mode requires a roster package.");
  }

  const usesRosterPackage =
    rosterPackage !== undefined &&
    (validated.settings.draft.mode === "custom" ||
      validated.settings.draft.mode === "fantasy");

  const saveId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  let state = createInitialGameState({
    saveId,
    rngSeed: input.rngSeed,
    nowIso,
    settings: gameSettings,
  });

  if (usesRosterPackage && rosterPackage !== undefined) {
    const preview = validateRosterPackage(rosterPackage, {
      teamCount: Object.keys(state.world.teams).length,
      schemaVersion: state.meta.schemaVersion,
      seasonYear: state.competition.season.year,
      salaryCap: state.settings.financialRules.salaryCap,
      salaryCapEnabled: state.settings.financialRules.salaryCapEnabled,
      existingPlayerIds: new Set(Object.keys(state.world.players)),
    });
    if (!preview.ok) {
      return fail(
        preview.errors.map((entry) => entry.message).join("; ") ||
          "Custom roster package is invalid.",
      );
    }
  }

  const rng = createSeededRng(state.meta.rngState);
  try {
    const bootstrapped = bootstrapWorld(state, rng, rosterPackage);
    const withPortraits = withPlayerPortraits(bootstrapped.state);
    state = {
      ...withPortraits,
      meta: {
        ...withPortraits.meta,
        rngState: rng.getState(),
        updatedAt: nowIso,
      },
    };
    if (participation.value.mode === "local_shared") {
      state = {
        ...state,
        user: {
          ...state.user,
          participation: createLocalSharedParticipation(
            participation.value.participants,
            state.user.activeOwnerTeamId,
            () => crypto.randomUUID(),
          ),
        },
      };
    }
    if (participation.value.mode === "online" && input.hostUser) {
      state = {
        ...state,
        user: {
          ...state.user,
          participation: createOnlineParticipation(
            {
              userId: input.hostUser.id,
              displayName: input.hostUser.username,
            },
            state.user.activeOwnerTeamId,
            state.settings.ownership.controlledTeamCount,
            () => crypto.randomUUID(),
          ),
        },
      };
    }
    validateGameState(state);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to create save.",
    );
  }

  const loaded = await saveStore.create({
    id: saveId,
    name: input.name.trim() || "New Franchise",
    state,
  });

  return withDashboard(loaded);
}

export async function loadOwnerSave(
  saveId: string,
  store?: SaveGameStore,
): Promise<CreateGameResult | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    navGroups: ownerNavGroupsForState(loaded.state),
    moments: toDashboardMomentsView(loaded.state),
    ticker: toTransactionTickerView(loaded.state),
  };
}

export async function listOwnerSaves(
  store?: SaveGameStore,
): Promise<SaveGameSummary[]> {
  return getStore(store).list();
}

/**
 * Home / Load screen preview for one save.
 * Built from existing load + toDashboardSnapshot — not a second validation path.
 * Unloadable saves are represented as error entries; they are never deleted here.
 */
export type OwnerSavePreview =
  | {
      ok: true;
      id: string;
      name: string;
      updatedAt: Date;
      createdAt: Date;
      mode: DashboardSnapshot["mode"];
      controlledTeam: DashboardSnapshot["controlledTeam"];
      seasonYear: number;
      currentDate: string;
      seasonPhase: DashboardSnapshot["seasonPhase"];
      teamSelectionLocked: boolean;
      /** Controlled team's current record, for the save card. */
      record?: { wins: number; losses: number };
      /** Local shared league player count; null for single-player saves. */
      participantCount?: number | null;
      participationMode?: "single" | "local_shared" | "online";
    }
  | {
      ok: false;
      id: string;
      name: string;
      updatedAt: Date;
      createdAt: Date;
      error: string;
    };

/**
 * List save previews for Home / Load. Isolates per-save load failures so one
 * malformed save cannot break the rest. Does not migrate, repair, or delete.
 */
export async function listOwnerSavePreviews(
  store?: SaveGameStore,
): Promise<OwnerSavePreview[]> {
  const saveStore = getStore(store);
  const summaries = await saveStore.list();
  const previews: OwnerSavePreview[] = [];

  for (const summary of summaries) {
    try {
      const loaded = await saveStore.load(summary.id);
      if (!loaded) {
        // Online leagues you are not a member of (or a save deleted since
        // listing) are not shown at all — not even their names.
        continue;
      }
      const dashboard = toDashboardSnapshot(loaded.state);
      previews.push({
        ok: true,
        id: loaded.id,
        name: loaded.name,
        updatedAt: loaded.updatedAt,
        createdAt: loaded.createdAt,
        mode: dashboard.mode,
        controlledTeam: dashboard.controlledTeam,
        seasonYear: dashboard.seasonYear,
        currentDate: dashboard.currentDate,
        seasonPhase: dashboard.seasonPhase,
        teamSelectionLocked: dashboard.teamSelectionLocked,
        participantCount: dashboard.participation?.participants.length ?? null,
        participationMode: dashboard.participation?.mode ?? "single",
        record: {
          wins: dashboard.controlledStanding.wins,
          losses: dashboard.controlledStanding.losses,
        },
      });
    } catch {
      previews.push({
        ok: false,
        id: summary.id,
        name: summary.name,
        updatedAt: summary.updatedAt,
        createdAt: summary.createdAt,
        error: "Save is incompatible or corrupted.",
      });
    }
  }

  return previews;
}

/**
 * Delete a save by SaveGame.id. No user/session ownership check — the
 * current save model is local/single-user. Do not introduce a parallel
 * authorization model here.
 */
/** Whether the signed-in user may open and control this save. */
export async function canAccessOwnerSave(
  saveId: string,
  store?: SaveGameStore,
): Promise<boolean> {
  return (await getStore(store).load(saveId)) !== null;
}

export async function deleteOwnerSave(
  saveId: string,
  store?: SaveGameStore,
): Promise<boolean> {
  return getStore(store).delete(saveId);
}

/**
 * Persist GameState without running simulation. Does not mutate input state.
 */
export async function saveOwnerGame(
  saveId: string,
  state: GameState,
  store?: SaveGameStore,
): Promise<CreateGameResult> {
  const withPortraits = withPlayerPortraits(state);
  validateGameState(withPortraits);
  const saved = await getStore(store).save({
    id: saveId,
    state: withPortraits,
  });
  return {
    save: toSaveSummary(saved),
    dashboard: toDashboardSnapshot(saved.state),
  };
}
