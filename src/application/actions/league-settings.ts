"use server";

import { redirect } from "next/navigation";
import {
  renameOwnerLeague,
  setOwnerFranchiseAiAssistance,
  updateOwnerLeagueSettings,
} from "@/application/game-service";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";
import { parseLeagueSettingsChanges } from "@/systems/league-settings-edit";

function parseJsonField(formData: FormData, field: string): unknown {
  try {
    return JSON.parse(String(formData.get(field) ?? "")) as unknown;
  } catch {
    return undefined;
  }
}

export async function updateLeagueSettingsAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  let changes;
  try {
    changes = parseLeagueSettingsChanges(
      parseJsonField(formData, "changesJson"),
    );
  } catch (error) {
    redirectWithError(
      path,
      error instanceof Error ? error.message : "Settings changes are invalid.",
    );
  }
  const result = await updateOwnerLeagueSettings(saveId, changes);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function renameLeagueAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await renameOwnerLeague(
    saveId,
    String(formData.get("leagueName") ?? ""),
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function setFranchiseAiAssistanceAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await setOwnerFranchiseAiAssistance(
    saveId,
    parseJsonField(formData, "assistanceJson"),
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}
