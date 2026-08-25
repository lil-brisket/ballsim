/**
 * Shared harness for multi-year unattended Owner Mode simulation tests.
 * Progress invariant + max-step guard + boundary validation + save/reload.
 */

import {
  advanceOwnerTime,
  beginOffseason,
  createNewOwnerSave,
  finishFreeAgency,
  loadOwnerSave,
  selectOwnerDraftProspect,
  selectOwnerTeam,
} from "@/application/game-service";
import {
  cloneGameSettings,
  CBL_GAME_SETTINGS,
  type AiManagementMode,
  type GameSettings,
} from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import type { GameState } from "@/state/game-state";
import { isUserOnDraftClock } from "@/systems/draft";
import { assertContinuityBoundary } from "@/systems/simulation/continuity-validation";
import { TEST_RNG_SEED } from "./determinism";

export type AdvanceMode = "day" | "week" | "mixed" | "large_jumps" | "until_phase";

export type MultiYearSimOptions = {
  seasons: number;
  managementMode: AiManagementMode;
  assistanceOverrides?: Partial<GameSettings["ai"]["assistance"]>;
  advanceMode: AdvanceMode;
  saveReloadEachSeason?: boolean;
  saveReloadMidFa?: boolean;
  seed?: number;
  maxSteps?: number;
  settingsBase?: GameSettings;
};

export type MultiYearSimDiagnostics = {
  seasonYear: number;
  date: string;
  phase: string;
  stage: string;
  steps: number;
  lastTransition: string;
  message: string;
};

export type MultiYearSimResult = {
  saveId: string;
  store: ReturnType<typeof createMemorySaveGameStore>;
  finalState: GameState;
  seasonsCompleted: number;
  steps: number;
};

function daysForMode(mode: AdvanceMode, seasonIndex: number): number {
  if (mode === "day") {
    return 1;
  }
  if (mode === "week") {
    return 7;
  }
  if (mode === "large_jumps") {
    return 30;
  }
  if (mode === "until_phase") {
    return 400;
  }
  // mixed: rotate by season
  const cycle = seasonIndex % 4;
  if (cycle === 0) {
    return 7;
  }
  if (cycle === 1) {
    return 1;
  }
  if (cycle === 2) {
    return 30;
  }
  return 400;
}

function lifecycleFingerprint(state: GameState): string {
  return `${state.competition.season.year}|${state.competition.season.phase}|${state.competition.season.offseasonStage}|${state.world.calendar.currentDate}`;
}

function formatDiagnostics(
  state: GameState,
  steps: number,
  lastTransition: string,
  message: string,
): MultiYearSimDiagnostics {
  return {
    seasonYear: state.competition.season.year,
    date: state.world.calendar.currentDate,
    phase: state.competition.season.phase,
    stage: state.competition.season.offseasonStage,
    steps,
    lastTransition,
    message,
  };
}

function failProgress(diag: MultiYearSimDiagnostics): never {
  throw new Error(
    [
      "Simulation failed to progress",
      `Season: ${diag.seasonYear}`,
      `Date: ${diag.date}`,
      `Phase: ${diag.phase}`,
      `Stage: ${diag.stage}`,
      `Steps: ${diag.steps}`,
      `Last successful transition: ${diag.lastTransition}`,
      diag.message,
    ].join("\n"),
  );
}

function assertBoundaryInvariants(state: GameState): void {
  validateGameState(state);
  assertContinuityBoundary(state);

  const rosterMembership = new Map<string, string>();
  for (const team of Object.values(state.world.teams)) {
    const seen = new Set<string>();
    for (const playerId of team.roster) {
      if (seen.has(playerId)) {
        throw new Error(`Duplicate player ${playerId} on roster ${team.id}`);
      }
      seen.add(playerId);
      const existing = rosterMembership.get(playerId);
      if (existing !== undefined) {
        throw new Error(
          `Player ${playerId} on multiple teams (${existing}, ${team.id})`,
        );
      }
      rosterMembership.set(playerId, team.id);
      const player = state.world.players[playerId];
      if (!player) {
        throw new Error(`Roster player ${playerId} missing from world.players`);
      }
      if (player.teamId !== team.id) {
        throw new Error(
          `Player ${playerId} teamId ${player.teamId} != roster team ${team.id}`,
        );
      }
    }
  }

  for (const player of Object.values(state.world.players)) {
    if (player.teamId === null && rosterMembership.has(player.id)) {
      throw new Error(`Free agent ${player.id} still on a roster`);
    }
    if (player.contractId !== null) {
      const contract = state.business.contracts[player.contractId];
      if (!contract) {
        throw new Error(
          `Player ${player.id} contractId ${player.contractId} missing`,
        );
      }
      if (contract.playerId !== player.id) {
        throw new Error(
          `Contract ${contract.id} playerId mismatch for ${player.id}`,
        );
      }
    }
  }
}

async function handleBlockedGates(
  saveId: string,
  store: ReturnType<typeof createMemorySaveGameStore>,
  managementMode: AiManagementMode,
): Promise<boolean> {
  const loaded = await store.load(saveId);
  if (!loaded) {
    throw new Error("Save missing in handleBlockedGates");
  }
  const state = loaded.state;

  if (state.competition.season.phase === "postseason") {
    const began = await beginOffseason(saveId, store);
    if (!began.ok) {
      throw new Error(began.error);
    }
    return true;
  }

  if (
    state.competition.season.phase === "offseason" &&
    state.competition.season.offseasonStage === "free_agency" &&
    managementMode === "off"
  ) {
    // AI Off: finish FA explicitly so the loop can continue.
    const finished = await finishFreeAgency(saveId, store);
    if (!finished.ok) {
      throw new Error(finished.error);
    }
    return true;
  }

  if (isUserOnDraftClock(state) && managementMode === "off") {
    const view = await loadOwnerSave(saveId, store);
    if (!view) {
      throw new Error("Missing view for draft pick");
    }
    // loadOwnerSaveView has draft board — fall back to first eligible via store
    const { loadOwnerSaveView } = await import("@/application/game-service");
    const full = await loadOwnerSaveView(saveId, store);
    const prospect = full?.draftBoard?.eligibleProspects[0];
    if (!prospect) {
      throw new Error("No draft prospect available while on clock");
    }
    const drafted = await selectOwnerDraftProspect(
      saveId,
      prospect.playerId,
      store,
    );
    if (!drafted.ok) {
      throw new Error(drafted.error);
    }
    return true;
  }

  return false;
}

/**
 * Run unattended multi-year simulation. Throws with diagnostics on failure.
 */
export async function runMultiYearSimulation(
  options: MultiYearSimOptions,
): Promise<MultiYearSimResult> {
  const store = createMemorySaveGameStore();
  const seed = options.seed ?? TEST_RNG_SEED;
  const settings = cloneGameSettings(options.settingsBase ?? CBL_GAME_SETTINGS);
  settings.ai.managementMode = options.managementMode;
  if (options.assistanceOverrides) {
    settings.ai.assistance = {
      ...settings.ai.assistance,
      ...options.assistanceOverrides,
    };
  }

  const created = await createNewOwnerSave(
    {
      settings,
      name: `MultiYear ${options.managementMode} ${options.seasons}y`,
      rngSeed: seed,
    },
    store,
  );
  if (!created.ok) {
    throw new Error(created.error);
  }
  const saveId = created.save.id;
  const initial = await store.load(saveId);
  if (!initial) {
    throw new Error("Save missing after create");
  }
  const teamIds = Object.keys(initial.state.world.teams).sort();
  const selected = await selectOwnerTeam(saveId, teamIds[0]!, store);
  if (!selected.ok) {
    throw new Error(selected.error);
  }

  const afterSelect = await store.load(saveId);
  if (!afterSelect) {
    throw new Error("Save missing after team select");
  }

  const startYear = afterSelect.state.competition.season.year;
  const targetYear = startYear + options.seasons;
  const maxSteps = options.maxSteps ?? options.seasons * 500;
  let steps = 0;
  let lastTransition = lifecycleFingerprint(afterSelect.state);
  let seasonsCompleted = 0;
  let prevYear = startYear;

  while (steps < maxSteps) {
    const before = await store.load(saveId);
    if (!before) {
      throw new Error("Save missing mid-sim");
    }
    const beforeFp = lifecycleFingerprint(before.state);
    const beforeYear = before.state.competition.season.year;
    const beforePhase = before.state.competition.season.phase;

    if (
      before.state.competition.season.year >= targetYear &&
      before.state.competition.season.phase === "preseason"
    ) {
      assertBoundaryInvariants(before.state);
      seasonsCompleted = options.seasons;
      return {
        saveId,
        store,
        finalState: before.state,
        seasonsCompleted,
        steps,
      };
    }

    // Season boundary checkpoint (entering preseason of a new year)
    if (
      before.state.competition.season.phase === "preseason" &&
      beforeYear > prevYear
    ) {
      assertBoundaryInvariants(before.state);
      seasonsCompleted = beforeYear - startYear;
      prevYear = beforeYear;

      if (seasonsCompleted >= options.seasons) {
        return {
          saveId,
          store,
          finalState: before.state,
          seasonsCompleted,
          steps,
        };
      }

      if (options.saveReloadEachSeason) {
        const json = serializeGameState(before.state);
        const restored = deserializeGameState(json);
        assertBoundaryInvariants(restored);
        await store.save({
          id: saveId,
          state: restored,
        });
      }
    }

    if (
      options.saveReloadMidFa &&
      before.state.competition.season.offseasonStage === "free_agency" &&
      steps % 17 === 0
    ) {
      const json = serializeGameState(before.state);
      const restored = deserializeGameState(json);
      assertBoundaryInvariants(restored);
      await store.save({
        id: saveId,
        state: restored,
      });
    }

    const handled = await handleBlockedGates(
      saveId,
      store,
      options.managementMode,
    );
    if (handled) {
      steps += 1;
      const afterGate = await store.load(saveId);
      if (afterGate) {
        const afterFp = lifecycleFingerprint(afterGate.state);
        if (afterFp !== beforeFp) {
          lastTransition = afterFp;
        }
      }
      continue;
    }

    const seasonIndex = Math.max(
      0,
      before.state.competition.season.year - startYear,
    );
    const days = daysForMode(options.advanceMode, seasonIndex);
    const stopOnPhaseChange = days >= 30 || options.advanceMode === "until_phase";

    const result = await advanceOwnerTime(
      saveId,
      { days, stopOnPhaseChange },
      store,
    );
    steps += 1;

    if (!result.ok) {
      // Deliberate blocked states may still need gate handling next loop
      if (
        /draft clock/i.test(result.error) ||
        /season review/i.test(result.error)
      ) {
        const handledBlock = await handleBlockedGates(
          saveId,
          store,
          options.managementMode,
        );
        if (handledBlock) {
          lastTransition = `blocked:${result.error}`;
          continue;
        }
      }
      failProgress(
        formatDiagnostics(before.state, steps, lastTransition, result.error),
      );
    }

    const after = await store.load(saveId);
    if (!after) {
      throw new Error("Save missing after advance");
    }
    const afterFp = lifecycleFingerprint(after.state);
    if (afterFp === beforeFp) {
      // No progress and no explicit block — fail
      const retryGate = await handleBlockedGates(
        saveId,
        store,
        options.managementMode,
      );
      if (!retryGate) {
        failProgress(
          formatDiagnostics(
            after.state,
            steps,
            lastTransition,
            "Advance returned ok but lifecycle fingerprint unchanged",
          ),
        );
      }
    } else {
      lastTransition = afterFp;
    }

    // Soft check: still in same phase too long (except FA waiting for auto-advance)
    if (
      after.state.competition.season.phase === beforePhase &&
      after.state.competition.season.offseasonStage ===
        before.state.competition.season.offseasonStage &&
      after.state.competition.season.year === beforeYear &&
      steps > 0 &&
      steps % 200 === 0
    ) {
      // Allow FA to burn duration days; otherwise suspect stuck
      if (after.state.competition.season.offseasonStage !== "free_agency") {
        failProgress(
          formatDiagnostics(
            after.state,
            steps,
            lastTransition,
            "Suspected stuck phase after 200 steps without stage/year change",
          ),
        );
      }
    }
  }

  const final = await store.load(saveId);
  failProgress(
    formatDiagnostics(
      final?.state ?? initial.state,
      steps,
      lastTransition,
      `Exceeded maxSteps=${maxSteps} before reaching year ${targetYear} preseason`,
    ),
  );
}
