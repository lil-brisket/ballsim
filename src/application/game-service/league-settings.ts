import "server-only";
import type { SaveGameStore } from "@/persistence/save-game-store";
import {
  applyLeagueSettingsChanges,
  renameLeague,
  setActiveFranchiseAiAssistance,
  type LeagueSettingsChanges,
} from "@/systems/league-settings-edit";
import { runOwnerFranchiseCommand } from "@/application/game-service/internal";
import type { OwnerCommandResult } from "@/application/game-service/types";

export async function updateOwnerLeagueSettings(
  saveId: string,
  changes: LeagueSettingsChanges,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => ({
      state: applyLeagueSettingsChanges(state, changes),
      events: [],
    }),
    store,
  );
}

export async function renameOwnerLeague(
  saveId: string,
  name: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => ({ state: renameLeague(state, name), events: [] }),
    store,
  );
}

export async function setOwnerFranchiseAiAssistance(
  saveId: string,
  assistance: unknown,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => ({
      state: setActiveFranchiseAiAssistance(state, assistance),
      events: [],
    }),
    store,
  );
}
