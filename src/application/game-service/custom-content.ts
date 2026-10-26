import "server-only";
import type { CustomContentStore } from "@/persistence/custom-content-store";
import {
  validateRosterPackage,
  validateDraftClassPackage,
  getDraftClassDecision,
  withDraftClassDecision,
  exportRoster,
  exportDraftClass,
} from "@/systems/custom-content";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  type CustomRosterPlayerPatch,
  updateCustomRosterPlayer,
  removeCustomRosterPlayer,
  addCustomRosterPlayer,
} from "@/systems/custom-content/post-save-edit";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { asPlayerId } from "@/domain/ids";
import { validateGameState } from "@/persistence/validate-game-state";
import type { RosterPlayerSource } from "@/systems/custom-content/package-types";
import { createSeededRng } from "@/domain/rng";
import {
  draftYearForSeason,
  createDraft,
  replaceDraftProspects,
  createDraftFromPackage,
} from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { leagueSettingsAccessError } from "@/systems/league-settings-edit";
import {
  getCustomStore,
  getStore,
  fail,
  persistWorkingState,
  withDashboard,
} from "@/application/game-service/internal";
import type {
  OwnerCommandResult,
  OwnerCommandFailure,
} from "@/application/game-service/types";

export async function upsertCustomContentPackage(
  payloadJson: string,
  store?: CustomContentStore,
): Promise<{ ok: true; contentId: string } | { ok: false; error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson) as unknown;
  } catch {
    return { ok: false, error: "Package is not valid JSON." };
  }
  const parsedRecord = parsed as {
    payload?: { teams?: unknown[]; draftYear?: number };
  };
  const teamCount = Array.isArray(parsedRecord.payload?.teams)
    ? parsedRecord.payload.teams.length
    : 0;
  const seasonYear =
    typeof parsedRecord.payload?.draftYear === "number"
      ? parsedRecord.payload.draftYear - 1
      : 2026;
  const roster = validateRosterPackage(parsed, {
    teamCount,
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
  });
  const draft = validateDraftClassPackage(parsed, {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    seasonYear,
    draftHorizonYear: seasonYear + 3,
  });
  const chosen = roster.normalized ?? draft.normalized;
  if (chosen === undefined) {
    const errors = [...roster.errors, ...draft.errors];
    return {
      ok: false,
      error:
        errors.map((entry) => entry.message).join("; ") ||
        "Package is invalid.",
    };
  }
  const saved = await getCustomStore(store).upsert({
    contentId: chosen.contentId,
    type: chosen.type,
    title: chosen.metadata.title,
    description: chosen.metadata.description ?? null,
    author: chosen.metadata.author ?? null,
    formatVersion: chosen.formatVersion,
    payloadJson: JSON.stringify(chosen),
  });
  return { ok: true, contentId: saved.contentId };
}

export async function listCustomContentPackages(
  type?: "roster" | "draft_class",
  store?: CustomContentStore,
) {
  return getCustomStore(store).list(type);
}

export async function updateOwnerCustomRosterPlayer(
  saveId: string,
  playerId: string,
  patch: CustomRosterPlayerPatch,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    const saveStore = getStore(store);
    const loaded = await saveStore.load(saveId);
    if (!loaded) {
      return fail("Save not found.");
    }
    // Roster edits change other franchises' players: host only online.
    const accessError = leagueSettingsAccessError(loaded.state);
    if (accessError) {
      return fail(accessError);
    }
    const updated = updateCustomRosterPlayer(
      loaded.state,
      asPlayerId(playerId),
      patch,
    );
    validateGameState(updated.state);
    const persisted = await persistWorkingState(
      saveId,
      updated.state,
      loaded.state.meta.rngState,
      saveStore,
      updated.events,
      { ifUpdatedAt: loaded.updatedAt },
    );
    return withDashboard(persisted);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to update player.",
    );
  }
}

export async function removeOwnerCustomRosterPlayer(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    const saveStore = getStore(store);
    const loaded = await saveStore.load(saveId);
    if (!loaded) {
      return fail("Save not found.");
    }
    // Roster edits change other franchises' players: host only online.
    const accessError = leagueSettingsAccessError(loaded.state);
    if (accessError) {
      return fail(accessError);
    }
    const updated = removeCustomRosterPlayer(
      loaded.state,
      asPlayerId(playerId),
    );
    validateGameState(updated.state);
    const persisted = await persistWorkingState(
      saveId,
      updated.state,
      loaded.state.meta.rngState,
      saveStore,
      updated.events,
      { ifUpdatedAt: loaded.updatedAt },
    );
    return withDashboard(persisted);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to remove player.",
    );
  }
}

export async function addOwnerCustomRosterPlayer(
  saveId: string,
  source: RosterPlayerSource,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    const saveStore = getStore(store);
    const loaded = await saveStore.load(saveId);
    if (!loaded) {
      return fail("Save not found.");
    }
    // Roster edits change other franchises' players: host only online.
    const accessError = leagueSettingsAccessError(loaded.state);
    if (accessError) {
      return fail(accessError);
    }
    const rng = createSeededRng(loaded.state.meta.rngState);
    const updated = addCustomRosterPlayer(loaded.state, source, rng, saveId);
    validateGameState(updated.state);
    const persisted = await persistWorkingState(
      saveId,
      updated.state,
      rng.getState(),
      saveStore,
      updated.events,
      { ifUpdatedAt: loaded.updatedAt },
    );
    return withDashboard(persisted);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to add player.",
    );
  }
}

export async function resolveOwnerDraftClassDecision(
  saveId: string,
  input: {
    source: "generated" | "custom";
    packageRaw?: unknown;
    contentId?: string;
  },
  store?: SaveGameStore,
  customStore?: CustomContentStore,
): Promise<OwnerCommandResult> {
  try {
    const saveStore = getStore(store);
    const loaded = await saveStore.load(saveId);
    if (!loaded) {
      return fail("Save not found.");
    }
    const draftYear = draftYearForSeason(loaded.state.competition.season.year);
    const existing = getDraftClassDecision(loaded.state, draftYear);
    if (existing?.resolved === true) {
      return withDashboard(loaded);
    }
    const rng = createSeededRng(loaded.state.meta.rngState);
    let next = withDraftClassDecision(loaded.state, {
      draftYear,
      resolved: true,
      source: input.source,
      customContentId: input.contentId,
    });
    if (input.source === "generated") {
      const created = createDraft(next, rng);
      next = created.state;
      validateGameState(next);
      const persisted = await persistWorkingState(
        saveId,
        next,
        rng.getState(),
        saveStore,
        created.events,
        { ifUpdatedAt: loaded.updatedAt },
      );
      return withDashboard(persisted);
    }
    let packageRaw = input.packageRaw;
    if (packageRaw === undefined && input.contentId) {
      const stored = await getCustomStore(customStore).getByContentId(
        input.contentId,
      );
      if (stored === null) {
        return fail("Custom draft class package was not found.");
      }
      packageRaw = JSON.parse(stored.payloadJson) as unknown;
    }
    if (packageRaw === undefined) {
      return fail("A custom draft class package is required.");
    }
    const preview = validateDraftClassPackage(packageRaw, {
      schemaVersion: next.meta.schemaVersion,
      seasonYear: next.competition.season.year,
      draftHorizonYear: next.competition.season.year + 3,
      existingPlayerIds: new Set(Object.keys(next.world.players)),
    });
    if (!preview.ok) {
      return fail(
        preview.errors.map((entry) => entry.message).join("; ") ||
          "Custom draft class package is invalid.",
      );
    }
    const created = next.world.drafts[draftClassIdFor(draftYear)]
      ? replaceDraftProspects(next, rng, packageRaw)
      : createDraftFromPackage(next, rng, packageRaw);
    next = withDraftClassDecision(created.state, {
      draftYear,
      resolved: true,
      source: "custom",
      customContentId: input.contentId ?? preview.normalized?.contentId,
    });
    validateGameState(next);
    const persisted = await persistWorkingState(
      saveId,
      next,
      rng.getState(),
      saveStore,
      created.events,
      { ifUpdatedAt: loaded.updatedAt },
    );
    return withDashboard(persisted);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to resolve draft class.",
    );
  }
}

export async function exportOwnerRoster(
  saveId: string,
  store?: SaveGameStore,
): Promise<{ ok: true; json: string } | OwnerCommandFailure> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  return {
    ok: true,
    json: JSON.stringify(exportRoster(loaded.state), null, 2),
  };
}

export async function exportOwnerDraftClass(
  saveId: string,
  draftYear: number,
  store?: SaveGameStore,
): Promise<{ ok: true; json: string } | OwnerCommandFailure> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  try {
    return {
      ok: true,
      json: JSON.stringify(exportDraftClass(loaded.state, draftYear), null, 2),
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to export.");
  }
}
