import "server-only";
import { withReadyReset } from "@/systems/participation";
import { prepareSharedAdvance } from "@/application/game-service/shared-advance";
import type { SaveGameStore } from "@/persistence/save-game-store";
import {
  previewAdvance,
  getActivePhaseId,
  isInLeaguePhase,
} from "@/systems/phase-engine";
import { createSeededRng } from "@/domain/rng";
import { advanceLeaguePhase } from "@/systems/simulation/offseason-lifecycle";
import type { GameState } from "@/state/game-state";
import {
  withTimeAdvanceDedupe,
  mapTimeAdvancePersistenceError,
} from "@/application/time-advance-mutation";
import { isUserAssistCompletelyOff } from "@/systems/simulation/management-policy";
import {
  getOwnedFranchiseAssistance,
  withOwnedFranchise,
} from "@/state/owner-context";
import { resolveSimulationPhaseKey } from "@/systems/simulation/simulation-phase";
import { runAiContinuity } from "@/systems/simulation/ai-continuity";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { processDerivedProjections } from "@/systems/media-hub";
import { enterOffseasonFromPostseason } from "@/systems/simulation/season-lifecycle";
import type { OwnerCommandResult } from "@/application/game-service/types";
import {
  getStore,
  fail,
  persistWorkingState,
  withDashboard,
} from "@/application/game-service/internal";

/**
 * Advance the active league phase (user-controlled). Blocks on required tasks.
 */
export async function advanceLeaguePhaseCommand(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const preview = previewAdvance(loaded.state);
  if (!preview.canAdvance) {
    return fail(preview.blockReason ?? "Cannot advance phase.");
  }

  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const advanced = advanceLeaguePhase(loaded.state, rng);
    const saved = await persistWorkingState(
      saveId,
      advanced.state,
      rng.getState(),
      saveStore,
      advanced.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Dismiss a recommended/optional phase task until the end of the current phase.
 */
export async function dismissPhaseTask(
  saveId: string,
  taskKey: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  if (typeof taskKey !== "string" || taskKey.length === 0) {
    return fail("taskKey is required.");
  }

  const teamId = loaded.state.user.activeOwnerTeamId;
  const phaseId = getActivePhaseId(loaded.state);
  const existing = loaded.state.user.franchisePhaseState?.[teamId] ?? {
    dismissed: [],
  };
  const nextState: GameState = {
    ...loaded.state,
    user: {
      ...loaded.state.user,
      franchisePhaseState: {
        ...(loaded.state.user.franchisePhaseState ?? {}),
        [teamId]: {
          dismissed: [
            ...existing.dismissed.filter((entry) => entry.taskKey !== taskKey),
            {
              taskKey,
              dismissedUntil: "phase_end",
              dismissedAt: loaded.state.world.calendar.currentDate,
              phaseId,
            },
          ],
        },
      },
    },
  };

  const saved = await persistWorkingState(
    saveId,
    nextState,
    loaded.state.meta.rngState,
    saveStore,
    [],
  );
  return withDashboard(saved);
}

/**
 * Run AI continuity for the user franchise, then advance until the next phase.
 */
export async function letAiHandlePhaseAndAdvance(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    return await withTimeAdvanceDedupe(saveId, async () => {
      const saveStore = getStore(store);
      const loaded = await saveStore.load(saveId);
      if (!loaded) {
        return fail("Save not found.");
      }
      const gate = prepareSharedAdvance(loaded.state);
      if (!gate.ok) {
        return fail(gate.error);
      }
      const prepared = gate.state;
      if (
        isUserAssistCompletelyOff(
          prepared.settings,
          getOwnedFranchiseAssistance(prepared),
        )
      ) {
        return fail(
          "AI assistance is off. Delegate at least one responsibility in settings first.",
        );
      }

      const commitToken = loaded.updatedAt;
      const rng = createSeededRng(prepared.meta.rngState);
      const phaseKey = resolveSimulationPhaseKey(prepared);
      const continuity = runAiContinuity(prepared, rng, {
        forcePhase: `handoff:${phaseKey}`,
      });
      let working = continuity.state;
      const emitted = [...continuity.events];

      if (isInLeaguePhase(working, "offseason.free_agency")) {
        const advanced = advanceLeaguePhase(working, rng);
        working = advanced.state;
        emitted.push(...advanced.events);
      }

      const dayResult = advanceSimulation(working, rng, {
        days: 400,
        stopOnPhaseChange: true,
      });
      working = dayResult.state;
      emitted.push(...dayResult.events);

      working = withReadyReset(processDerivedProjections(working, emitted));

      const saved = await persistWorkingState(
        saveId,
        working,
        rng.getState(),
        saveStore,
        emitted,
        { ifUpdatedAt: commitToken },
      );
      return withDashboard(saved);
    });
  } catch (error) {
    return fail(mapTimeAdvancePersistenceError(error));
  }
}

/**
 * Record that the user skipped unresolved phase decisions, then advance.
 */
export async function continuePastPhaseAnyway(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    return await withTimeAdvanceDedupe(saveId, async () => {
      const saveStore = getStore(store);
      const loaded = await saveStore.load(saveId);
      if (!loaded) {
        return fail("Save not found.");
      }
      const gate = prepareSharedAdvance(loaded.state);
      if (!gate.ok) {
        return fail(gate.error);
      }
      const prepared = gate.state;

      const commitToken = loaded.updatedAt;
      const phaseKey = resolveSimulationPhaseKey(prepared);
      const today = prepared.world.calendar.currentDate;
      const activeTeamId = prepared.user.activeOwnerTeamId;
      let working: GameState = withOwnedFranchise(
        prepared,
        activeTeamId,
        (f) => ({
          ...f,
          phaseSkips: [
            ...f.phaseSkips,
            {
              phaseKey,
              skippedOn: today,
              reason: "User chose Continue Anyway",
            },
          ],
        }),
      );

      const rng = createSeededRng(working.meta.rngState);
      if (isInLeaguePhase(working, "offseason.free_agency")) {
        const advanced = advanceLeaguePhase(working, rng);
        working = advanced.state;
      }

      const dayResult = advanceSimulation(working, rng, {
        days: 400,
        stopOnPhaseChange: true,
      });
      working = dayResult.state;

      working = withReadyReset(
        processDerivedProjections(working, dayResult.events),
      );

      const saved = await persistWorkingState(
        saveId,
        working,
        rng.getState(),
        saveStore,
        dayResult.events,
        { ifUpdatedAt: commitToken },
      );
      return withDashboard(saved);
    });
  } catch (error) {
    return fail(mapTimeAdvancePersistenceError(error));
  }
}

/**
 * Player-paced Season Review → offseason. Runs one simulation day so
 * season_transition auto-chains into roster_decisions.
 */
export async function beginOffseason(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    return await withTimeAdvanceDedupe(saveId, async () => {
      const saveStore = getStore(store);
      const loaded = await saveStore.load(saveId);
      if (!loaded) {
        return fail("Save not found.");
      }
      const gate = prepareSharedAdvance(loaded.state);
      if (!gate.ok) {
        return fail(gate.error);
      }
      const prepared = gate.state;

      if (prepared.competition.season.phase !== "postseason") {
        return fail(
          "Begin offseason requires the Season Review (postseason) phase.",
        );
      }

      const commitToken = loaded.updatedAt;
      const rng = createSeededRng(prepared.meta.rngState);
      const entered = enterOffseasonFromPostseason(prepared);
      let working = entered.state;
      const emitted = [...entered.events];
      const dayResult = advanceSimulation(working, rng, { days: 1 });
      working = dayResult.state;
      emitted.push(...dayResult.events);

      working = withReadyReset(processDerivedProjections(working, emitted));

      const saved = await persistWorkingState(
        saveId,
        working,
        rng.getState(),
        saveStore,
        emitted,
        { ifUpdatedAt: commitToken },
      );
      return withDashboard(saved);
    });
  } catch (error) {
    return fail(mapTimeAdvancePersistenceError(error));
  }
}
