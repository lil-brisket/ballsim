import "server-only";
import type {
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";
import {
  type FantasyDraftView,
  toFantasyDraftView,
  type FantasyDraftPlayerDetailView,
  toFantasyDraftPlayerDetailView,
  toFantasyDraftSummaryView,
} from "@/state/selectors";
import type { GameState } from "@/state/game-state";
import { type Rng, createSeededRng } from "@/domain/rng";
import type { DomainEvent } from "@/domain/events";
import {
  randomizeDraftOrder,
  setDefaultDraftOrder,
  moveTeamInOrder,
  moveTeamToIndex,
  swapTeamsInOrder,
  withFantasyDraft,
  confirmFantasyDraftOrder,
  advanceFantasyDraftClock,
  getCurrentPick,
  makeFantasyDraftSelection,
  setFantasyDraftAutoPick,
  setFantasyDraftAutoPickAll,
  pauseFantasyDraft,
  resumeFantasyDraft,
  undoLastFantasyDraftPick,
  addToFantasyDraftQueue,
  removeFromFantasyDraftQueue,
  reorderFantasyDraftQueue,
  setFantasyDraftAutoPickStrategy,
  updateFantasyDraftSettings,
  advanceFantasyDraftUntilNextUserPick,
} from "@/systems/fantasy-draft";
import { asTeamId, asPlayerId } from "@/domain/ids";
import type {
  FantasyDraftType,
  FantasyDraftAutoPickStrategy,
} from "@/domain/entities/fantasy-draft";
import {
  getStore,
  toSaveSummary,
  fail,
  persistWorkingState,
  withDashboard,
} from "@/application/game-service/internal";
import type { OwnerCommandResult } from "@/application/game-service/types";

// ── Fantasy draft ──────────────────────────────────────────────────────────

export async function loadFantasyDraftView(
  saveId: string,
  store?: SaveGameStore,
): Promise<{ save: SaveGameSummary; draft: FantasyDraftView } | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }
  const draft = toFantasyDraftView(loaded.state);
  if (!draft) {
    return null;
  }
  return { save: toSaveSummary(loaded), draft };
}

export async function loadFantasyDraftPlayerDetail(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<FantasyDraftPlayerDetailView | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }
  return toFantasyDraftPlayerDetailView(loaded.state, playerId);
}

export async function loadFantasyDraftSummaryView(
  saveId: string,
  store?: SaveGameStore,
): Promise<{
  save: SaveGameSummary;
  summary: NonNullable<ReturnType<typeof toFantasyDraftSummaryView>>;
} | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }
  const summary = toFantasyDraftSummaryView(loaded.state);
  if (!summary) {
    return null;
  }
  return { save: toSaveSummary(loaded), summary };
}

async function mutateFantasyDraft(
  saveId: string,
  mutator: (
    state: GameState,
    rng: Rng,
    nowIso: string,
  ) => { state: GameState; events: DomainEvent[]; rngState?: number },
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const nowIso = new Date().toISOString();
  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const result = mutator(loaded.state, rng, nowIso);
    const saved = await persistWorkingState(
      saveId,
      result.state,
      result.rngState ?? rng.getState(),
      saveStore,
      result.events,
    );
    return {
      ...withDashboard(saved),
      draft: toFantasyDraftView(saved.state, nowIso),
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function randomizeFantasyDraftOrder(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, rng) => ({
      state: randomizeDraftOrder(state, rng),
      events: [],
      rngState: rng.getState(),
    }),
    store,
  );
}

export async function initializeFantasyDraftOrder(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, rng) => {
      const draft = state.world.fantasyDraft;
      if (draft === null) {
        throw new Error("No fantasy draft.");
      }
      if (draft.draftOrder.length > 0) {
        return { state, events: [] };
      }
      if (draft.orderMode === "random") {
        return {
          state: randomizeDraftOrder(state, rng),
          events: [],
          rngState: rng.getState(),
        };
      }
      return { state: setDefaultDraftOrder(state), events: [] };
    },
    store,
  );
}

export async function reorderFantasyDraft(
  saveId: string,
  teamId: string,
  direction: -1 | 1,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: moveTeamInOrder(state, asTeamId(teamId), direction),
      events: [],
    }),
    store,
  );
}

export async function moveFantasyDraftTeamToIndex(
  saveId: string,
  teamId: string,
  toIndex: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: moveTeamToIndex(state, asTeamId(teamId), toIndex),
      events: [],
    }),
    store,
  );
}

export async function swapFantasyDraftTeams(
  saveId: string,
  teamIdA: string,
  teamIdB: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: swapTeamsInOrder(state, asTeamId(teamIdA), asTeamId(teamIdB)),
      events: [],
    }),
    store,
  );
}

export async function configureFantasyDraftSetup(
  saveId: string,
  input: {
    draftType: FantasyDraftType;
    timerSeconds: number | null;
    orderMode: "random" | "manual";
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, rng) => {
      const draft = state.world.fantasyDraft;
      if (draft === null || draft.orderConfirmed) {
        throw new Error("Fantasy draft setup is locked.");
      }
      let next = withFantasyDraft(state, {
        ...draft,
        draftType: input.draftType,
        orderMode: input.orderMode,
        timer: {
          enabled: input.timerSeconds !== null && input.timerSeconds > 0,
          secondsPerPick:
            input.timerSeconds !== null && input.timerSeconds > 0
              ? input.timerSeconds
              : 0,
          pickStartedAt: null,
        },
      });
      next = {
        ...next,
        settings: {
          ...next.settings,
          draft: {
            ...next.settings.draft,
            type: input.draftType,
            timerSeconds: input.timerSeconds,
            orderMode: input.orderMode,
          },
        },
      };
      if (next.world.fantasyDraft!.draftOrder.length === 0) {
        next =
          input.orderMode === "random"
            ? randomizeDraftOrder(next, rng)
            : setDefaultDraftOrder(next);
      }
      return { state: next, events: [], rngState: rng.getState() };
    },
    store,
  );
}

export async function confirmFantasyDraftSetup(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      let next = state;
      if (
        next.world.fantasyDraft &&
        next.world.fantasyDraft.draftOrder.length === 0
      ) {
        next = setDefaultDraftOrder(next);
      }
      next = confirmFantasyDraftOrder(next, nowIso);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return {
        state: advanced.state,
        events: advanced.events,
      };
    },
    store,
  );
}

export async function selectFantasyDraftPlayer(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const draft = state.world.fantasyDraft;
      if (draft === null || draft.status !== "active") {
        throw new Error("Fantasy draft is not active.");
      }
      const pick = getCurrentPick(state);
      if (pick === undefined) {
        throw new Error("No active pick.");
      }
      if (!state.user.ownedTeamIds.includes(pick.teamId)) {
        throw new Error("It is not your team's turn to draft.");
      }
      const selection = makeFantasyDraftSelection(state, {
        teamId: pick.teamId,
        playerId: asPlayerId(playerId),
        nowIso,
      });
      if (!selection.success) {
        throw new Error(
          selection.validation.errors[0]?.message ?? "Invalid pick.",
        );
      }
      const advanced = advanceFantasyDraftClock(selection.state, nowIso);
      return {
        state: advanced.state,
        events: [...selection.events, ...advanced.events],
      };
    },
    store,
  );
}

export async function toggleFantasyDraftAutoPick(
  saveId: string,
  teamId: string,
  enabled: boolean,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const next = setFantasyDraftAutoPick(state, asTeamId(teamId), enabled);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function toggleFantasyDraftAutoPickAll(
  saveId: string,
  enabled: boolean,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const next = setFantasyDraftAutoPickAll(state, enabled);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function pauseOwnerFantasyDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => ({
      state: pauseFantasyDraft(state, nowIso),
      events: [],
    }),
    store,
  );
}

export async function resumeOwnerFantasyDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const next = resumeFantasyDraft(state, nowIso);
      const advanced = advanceFantasyDraftClock(next, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function undoOwnerFantasyDraftPick(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const result = undoLastFantasyDraftPick(state, nowIso);
      if (!result.success) {
        throw new Error(result.message ?? "Undo failed.");
      }
      return { state: result.state, events: result.events };
    },
    store,
  );
}

export async function addFantasyDraftQueuePlayer(
  saveId: string,
  teamId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: addToFantasyDraftQueue(
        state,
        asTeamId(teamId),
        asPlayerId(playerId),
      ),
      events: [],
    }),
    store,
  );
}

export async function removeFantasyDraftQueuePlayer(
  saveId: string,
  teamId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: removeFromFantasyDraftQueue(
        state,
        asTeamId(teamId),
        asPlayerId(playerId),
      ),
      events: [],
    }),
    store,
  );
}

export async function reorderFantasyDraftQueuePlayers(
  saveId: string,
  teamId: string,
  orderedPlayerIds: string[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: reorderFantasyDraftQueue(
        state,
        asTeamId(teamId),
        orderedPlayerIds.map((id) => asPlayerId(id)),
      ),
      events: [],
    }),
    store,
  );
}

export async function setOwnerFantasyDraftAutoPickStrategy(
  saveId: string,
  teamId: string,
  strategy: FantasyDraftAutoPickStrategy,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: setFantasyDraftAutoPickStrategy(state, asTeamId(teamId), strategy),
      events: [],
    }),
    store,
  );
}

export async function updateOwnerFantasyDraftSettings(
  saveId: string,
  settings: { confirmPicks?: boolean },
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state) => ({
      state: updateFantasyDraftSettings(state, settings),
      events: [],
    }),
    store,
  );
}

export async function advanceFantasyDraftUntilNextPick(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult<{ draft: FantasyDraftView | null }>> {
  return mutateFantasyDraft(
    saveId,
    (state, _rng, nowIso) => {
      const advanced = advanceFantasyDraftUntilNextUserPick(state, nowIso);
      return { state: advanced.state, events: advanced.events };
    },
    store,
  );
}

export async function continueAfterFantasyDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const draft = loaded.state.world.fantasyDraft;
  if (draft === null || draft.status !== "complete") {
    return fail("Fantasy draft is not complete.");
  }
  return withDashboard(loaded);
}
