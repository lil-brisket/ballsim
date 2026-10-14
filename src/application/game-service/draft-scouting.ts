import "server-only";
import type { SaveGameStore } from "@/persistence/save-game-store";
import {
  withTimeAdvanceDedupe,
  mapTimeAdvancePersistenceError,
} from "@/application/time-advance-mutation";
import { isInLeaguePhase } from "@/systems/phase-engine";
import {
  isUserOnDraftClock,
  getActiveDraftOnClockSlot,
  draftYearForSeason,
  makeDraftSelection,
} from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { createSeededRng } from "@/domain/rng";
import { asPlayerId } from "@/domain/ids";
import { recordOwnershipEvidence } from "@/systems/ownership-confidence-engine";
import { scoreDraftSelection } from "@/systems/ownership-alignment-signals";
import type { DomainEvent } from "@/domain/events";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { processDerivedProjections } from "@/systems/media-hub";
import type { GameState } from "@/state/game-state";
import { assignScoutToProspect, scoutRegionCoverage } from "@/systems/scouting";
import {
  assignPlayerToDevelopmentLeague,
  recallPlayerFromDevelopmentLeague,
} from "@/systems/development-league";
import {
  addToDraftBoard,
  removeFromDraftBoard,
  toggleDraftBoardPriority,
} from "@/systems/draft/draft-board";
import { conductProspectInterview } from "@/systems/draft/prospect-interviews";
import type { OwnerCommandResult } from "@/application/game-service/types";
import {
  getStore,
  fail,
  persistWorkingState,
  withDashboard,
} from "@/application/game-service/internal";

export async function selectOwnerDraftProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    return await withTimeAdvanceDedupe(saveId, async () => {
      const saveStore = getStore(store);
      const loaded = await saveStore.load(saveId);
      if (!loaded) {
        return fail("Save not found.");
      }

      if (!isInLeaguePhase(loaded.state, "offseason.draft")) {
        return fail("Draft selection is only allowed during the draft stage.");
      }

      if (!isUserOnDraftClock(loaded.state)) {
        return fail("Your team is not on the draft clock.");
      }

      const slot = getActiveDraftOnClockSlot(loaded.state);
      if (slot === undefined) {
        return fail("No available draft slot.");
      }

      const commitToken = loaded.updatedAt;
      const draftYear = draftYearForSeason(
        loaded.state.competition.season.year,
      );
      const draftClassId = draftClassIdFor(draftYear);
      const rng = createSeededRng(loaded.state.meta.rngState);

      const selection = makeDraftSelection(loaded.state, {
        draftClassId,
        draftPickId: slot.draftPickId,
        prospectPlayerId: asPlayerId(prospectPlayerId),
        teamId: loaded.state.user.activeOwnerTeamId,
      });
      if (!selection.success) {
        return fail(
          selection.validation.errors[0]?.message ?? "Draft selection invalid.",
        );
      }

      let working = recordOwnershipEvidence(
        selection.state,
        scoreDraftSelection(loaded.state),
      );
      const emitted: DomainEvent[] = [...selection.events];
      const ai = runAiTeamDecisions(working, rng);
      working = ai.state;
      emitted.push(...ai.events);

      if (!isUserOnDraftClock(working)) {
        const advanced = advanceSimulation(working, rng, {
          days: 1,
          stopOnPhaseChange: true,
        });
        working = advanced.state;
        emitted.push(...advanced.events);
        if (
          working.competition.season.offseasonStage === "draft" &&
          !isUserOnDraftClock(working)
        ) {
          const aiAgain = runAiTeamDecisions(working, rng);
          working = aiAgain.state;
          emitted.push(...aiAgain.events);
          if (!isUserOnDraftClock(working)) {
            const again = advanceSimulation(working, rng, {
              days: 1,
              stopOnPhaseChange: true,
            });
            working = again.state;
            emitted.push(...again.events);
          }
        }
      }

      working = processDerivedProjections(working, emitted);

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

async function mutateActiveFranchiseDraft(
  saveId: string,
  mutate: (state: GameState) => GameState,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  try {
    const next = mutate(loaded.state);
    const saved = await persistWorkingState(
      saveId,
      next,
      loaded.state.meta.rngState,
      saveStore,
      [],
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function assignOwnerScoutToProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(
    saveId,
    (state) =>
      assignScoutToProspect(
        state,
        state.user.activeOwnerTeamId,
        asPlayerId(prospectPlayerId),
      ),
    store,
  );
}

export async function assignOwnerPlayerToDevelopmentLeague(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const teamId = loaded.state.user.activeOwnerTeamId;
  const result = assignPlayerToDevelopmentLeague(
    loaded.state,
    asPlayerId(playerId),
    teamId,
  );
  if (!result.success) {
    return fail(result.errors[0] ?? "Cannot assign to Development League.");
  }
  const saved = await persistWorkingState(
    saveId,
    result.state,
    loaded.state.meta.rngState,
    saveStore,
    result.events,
  );
  return withDashboard(saved);
}

export async function recallOwnerPlayerFromDevelopmentLeague(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const teamId = loaded.state.user.activeOwnerTeamId;
  const result = recallPlayerFromDevelopmentLeague(
    loaded.state,
    asPlayerId(playerId),
    teamId,
  );
  if (!result.success) {
    return fail(result.errors[0] ?? "Cannot recall from Development League.");
  }
  const saved = await persistWorkingState(
    saveId,
    result.state,
    loaded.state.meta.rngState,
    saveStore,
    result.events,
  );
  return withDashboard(saved);
}

export async function scoutOwnerRegion(
  saveId: string,
  region: "domestic" | "international",
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(
    saveId,
    (state) => scoutRegionCoverage(state, state.user.activeOwnerTeamId, region),
    store,
  );
}

export async function addOwnerDraftBoardProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(
    saveId,
    (state) =>
      addToDraftBoard(
        state,
        state.user.activeOwnerTeamId,
        asPlayerId(prospectPlayerId),
      ),
    store,
  );
}

export async function removeOwnerDraftBoardProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(
    saveId,
    (state) =>
      removeFromDraftBoard(
        state,
        state.user.activeOwnerTeamId,
        asPlayerId(prospectPlayerId),
      ),
    store,
  );
}

export async function toggleOwnerDraftBoardPriority(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(
    saveId,
    (state) =>
      toggleDraftBoardPriority(
        state,
        state.user.activeOwnerTeamId,
        asPlayerId(prospectPlayerId),
      ),
    store,
  );
}

export async function interviewOwnerProspect(
  saveId: string,
  prospectPlayerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return mutateActiveFranchiseDraft(
    saveId,
    (state) =>
      conductProspectInterview(
        state,
        state.user.activeOwnerTeamId,
        asPlayerId(prospectPlayerId),
      ),
    store,
  );
}
