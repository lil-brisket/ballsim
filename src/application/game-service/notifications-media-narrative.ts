import "server-only";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { getOwnedTeamIds, withOwnedFranchise } from "@/state/owner-context";
import { asMediaItemId, asNarrativeSituationId } from "@/domain/ids";
import {
  acknowledgeNarrativeSituationInState,
  applyNarrativeAction,
} from "@/application/narrative-action-adapter";
import type { OwnerCommandResult } from "@/application/game-service/types";
import {
  getStore,
  fail,
  persistWorkingState,
  withDashboard,
  runOwnerFranchiseCommand,
} from "@/application/game-service/internal";

export async function markOwnerNotificationsRead(
  saveId: string,
  notificationIds?: string[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const idSet =
    notificationIds === undefined
      ? null
      : new Set(notificationIds.filter((id) => id.length > 0));
  let working = loaded.state;
  for (const teamId of getOwnedTeamIds(working)) {
    working = withOwnedFranchise(working, teamId, (franchise) => ({
      ...franchise,
      notifications: franchise.notifications.map((notification) => {
        if (idSet !== null && !idSet.has(notification.id)) {
          return notification;
        }
        if (notification.read) {
          return notification;
        }
        return { ...notification, read: true };
      }),
    }));
  }
  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** Mark one Media Hub item read for the active owned franchise. */
export async function markMediaRead(
  saveId: string,
  mediaItemId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  if (!mediaItemId) {
    return fail("Media item id is required.");
  }
  const typedId = asMediaItemId(mediaItemId);
  const currentDate = loaded.state.world.calendar.currentDate;
  const working = withOwnedFranchise(
    loaded.state,
    loaded.state.user.activeOwnerTeamId,
    (franchise) => {
      const existing = franchise.mediaReadState?.[typedId] ?? {};
      if (existing.readAt) {
        return franchise;
      }
      return {
        ...franchise,
        mediaReadState: {
          ...(franchise.mediaReadState ?? {}),
          [typedId]: { ...existing, readAt: currentDate },
        },
      };
    },
  );
  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** Mark all Media Hub items read for the active owned franchise. */
export async function markAllMediaRead(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const currentDate = loaded.state.world.calendar.currentDate;
  const working = withOwnedFranchise(
    loaded.state,
    loaded.state.user.activeOwnerTeamId,
    (franchise) => {
      const items = franchise.mediaFeed?.items ?? [];
      if (items.length === 0) {
        return franchise;
      }
      const nextReadState = { ...(franchise.mediaReadState ?? {}) };
      let changed = false;
      for (const item of items) {
        const existing = nextReadState[item.id] ?? {};
        if (existing.readAt || existing.dismissedAt) {
          continue;
        }
        nextReadState[item.id] = { ...existing, readAt: currentDate };
        changed = true;
      }
      if (!changed) {
        return franchise;
      }
      return {
        ...franchise,
        mediaReadState: nextReadState,
      };
    },
  );
  try {
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function acknowledgeOwnerNarrativeSituation(
  saveId: string,
  situationId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      acknowledgeNarrativeSituationInState(
        state,
        asNarrativeSituationId(situationId),
      ),
    store,
  );
}

export async function resolveOwnerNarrativeSituation(
  saveId: string,
  situationId: string,
  actionId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      applyNarrativeAction(
        state,
        asNarrativeSituationId(situationId),
        actionId,
      ),
    store,
  );
}
