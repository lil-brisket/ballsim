import "server-only";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { asTeamId } from "@/domain/ids";
import {
  getActiveOwnedFranchise,
  withOwnedFranchise,
  isOwnedFranchise,
  withActiveOwnerTeam,
  withAddedOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import {
  type ControlledFranchiseIdentityInput,
  applyConfirmControlledFranchises,
} from "@/systems/confirm-controlled-franchises";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";
import { applyOwnerFranchiseBranding } from "@/systems/owner-franchise-branding";
import type { OwnerCommandResult } from "@/application/game-service/types";
import {
  getStore,
  fail,
  withDashboard,
  persistWorkingState,
} from "@/application/game-service/internal";

export async function selectOwnerTeam(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const typedTeamId = asTeamId(teamId);
  if (loaded.state.world.teams[typedTeamId] === undefined) {
    return fail(`Team "${teamId}" does not exist.`);
  }

  if (loaded.state.world.calendar.lastSimulatedDate !== null) {
    if (loaded.state.user.activeOwnerTeamId === typedTeamId) {
      return withDashboard(loaded);
    }
    return fail(
      "Team selection is locked after the first time advance for this save.",
    );
  }

  if (loaded.state.user.activeOwnerTeamId === typedTeamId) {
    return withDashboard(loaded);
  }

  const previous = getActiveOwnedFranchise(loaded.state);
  const working = withOwnedFranchise(
    {
      ...loaded.state,
      user: {
        ...loaded.state.user,
        ownedTeamIds: [typedTeamId],
        activeOwnerTeamId: typedTeamId,
        ownedFranchises:
          typedTeamId === loaded.state.user.activeOwnerTeamId
            ? loaded.state.user.ownedFranchises
            : {
                [typedTeamId]:
                  loaded.state.user.ownedFranchises[typedTeamId] ??
                  loaded.state.user.ownedFranchises[
                    loaded.state.user.activeOwnerTeamId
                  ]!,
              },
      },
    },
    typedTeamId,
    {
      ...(loaded.state.user.ownedFranchises[typedTeamId] ?? previous),
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
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

/**
 * Switch the active Owner Mode franchise (UI context only).
 * Does not affect simulation — simulation keys off ownedTeamIds.
 */
export async function switchActiveOwnerTeam(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedTeamId = asTeamId(teamId);
  if (!isOwnedFranchise(loaded.state, typedTeamId)) {
    return fail(`Team "${teamId}" is not one of your owned franchises.`);
  }
  if (loaded.state.user.activeOwnerTeamId === typedTeamId) {
    return withDashboard(loaded);
  }
  try {
    const working = withActiveOwnerTeam(loaded.state, typedTeamId);
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

/**
 * Mid-career takeover of an AI-controlled franchise.
 * Retains all team-level state; generates a new player owner mandate.
 */
export async function takeOverFranchise(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedTeamId = asTeamId(teamId);
  if (loaded.state.world.teams[typedTeamId] === undefined) {
    return fail(`Team "${teamId}" does not exist.`);
  }
  if (isOwnedFranchise(loaded.state, typedTeamId)) {
    return fail(`Team "${teamId}" is already under your control.`);
  }

  const seasonYear = loaded.state.competition.season.year;
  const franchise = createDefaultOwnedFranchiseState({
    seasonYear,
    currentDate: loaded.state.world.calendar.currentDate,
    citySelectionConfirmed: true,
    franchiseIdentityConfirmed: true,
    aiAssistance: { ...loaded.state.settings.ai.assistance },
    managementPreset: loaded.state.settings.ai.managementPreset,
  });

  try {
    const working = withAddedOwnedFranchise(
      loaded.state,
      typedTeamId,
      franchise,
      { setActive: true },
    );
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

/**
 * Confirm additional owned franchises during onboarding (after primary city pick).
 */
export async function confirmControlledFranchises(
  saveId: string,
  franchises: readonly ControlledFranchiseIdentityInput[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const applied = applyConfirmControlledFranchises(loaded.state, franchises);
  if (!applied.ok) {
    return fail(applied.error);
  }

  try {
    const saved = await persistWorkingState(
      saveId,
      applied.state,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** @deprecated Prefer {@link confirmControlledFranchises} for onboarding. */
export async function confirmOwnedFranchises(
  saveId: string,
  additionalTeamIds: readonly string[],
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const anchorId = loaded.state.user.activeOwnerTeamId;
  const anchorTeam = loaded.state.world.teams[anchorId];
  if (!anchorTeam) {
    return fail(`Anchor team "${anchorId}" is missing.`);
  }

  const franchises: ControlledFranchiseIdentityInput[] = [
    {
      teamId: anchorId,
      nickname: anchorTeam.name,
      primaryColor: anchorTeam.branding.primaryColor,
      secondaryColor: anchorTeam.branding.secondaryColor,
      accentColor: anchorTeam.branding.accentColor,
      logoId: anchorTeam.branding.logoId,
    },
  ];

  for (const rawId of additionalTeamIds) {
    const team = loaded.state.world.teams[asTeamId(rawId)];
    if (!team) {
      return fail(`Team "${rawId}" does not exist.`);
    }
    franchises.push({
      teamId: team.id,
      nickname: team.name,
      primaryColor: team.branding.primaryColor,
      secondaryColor: team.branding.secondaryColor,
      accentColor: team.branding.accentColor,
      logoId: team.branding.logoId,
    });
  }

  return confirmControlledFranchises(saveId, franchises, store);
}

export async function selectOwnerCity(
  saveId: string,
  city: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const applied = applyOwnerCitySelection(loaded.state, city);
  if (!applied.ok) {
    return fail(applied.error);
  }

  try {
    const saved = await persistWorkingState(
      saveId,
      applied.state,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function confirmOwnerTeamIdentity(
  saveId: string,
  input: {
    nickname: string;
    logoId: string;
    paletteId?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const applied = applyOwnerFranchiseBranding(loaded.state, input);
  if (!applied.ok) {
    return fail(applied.error);
  }

  try {
    const saved = await persistWorkingState(
      saveId,
      applied.state,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
