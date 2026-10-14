"use server";

import { revalidatePath } from "next/cache";
import {
  configureFantasyDraftSetup,
  initializeFantasyDraftOrder,
  randomizeFantasyDraftOrder,
  reorderFantasyDraft,
  moveFantasyDraftTeamToIndex,
  swapFantasyDraftTeams,
  confirmFantasyDraftSetup,
  selectFantasyDraftPlayer,
  toggleFantasyDraftAutoPick,
  toggleFantasyDraftAutoPickAll,
  pauseOwnerFantasyDraft,
  resumeOwnerFantasyDraft,
  undoOwnerFantasyDraftPick,
  addFantasyDraftQueuePlayer,
  removeFantasyDraftQueuePlayer,
  reorderFantasyDraftQueuePlayers,
  setOwnerFantasyDraftAutoPickStrategy,
  updateOwnerFantasyDraftSettings,
  advanceFantasyDraftUntilNextPick,
  continueAfterFantasyDraft,
  loadFantasyDraftPlayerDetail,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import {
  isFantasyDraftAutoPickStrategy,
  type FantasyDraftAutoPickStrategy,
} from "@/domain/entities/fantasy-draft";
import type { FantasyDraftPlayerDetailView } from "@/state/selectors";
import {
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

function fantasyDraftPath(saveId: string): string {
  return `/fantasy-draft/${saveId}`;
}

function revalidateFantasyDraft(saveId: string): void {
  revalidatePath(`/fantasy-draft/${saveId}`, "layout");
  revalidatePath(`/new/${saveId}/fantasy-draft/setup`);
}

export async function configureFantasyDraftSetupAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const draftType = String(formData.get("draftType") ?? "snake") as
    "snake" | "linear";
  const orderMode = String(formData.get("orderMode") ?? "random") as
    "random" | "manual";
  const timerRaw = String(formData.get("timerSeconds") ?? "");
  const timerSeconds =
    timerRaw === "" || timerRaw === "off" ? null : Number(timerRaw);
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await configureFantasyDraftSetup(saveId, {
    draftType,
    orderMode,
    timerSeconds:
      timerSeconds !== null && Number.isFinite(timerSeconds)
        ? Math.max(1, Math.floor(timerSeconds))
        : null,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function randomizeFantasyDraftOrderAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = `/new/${saveId}/fantasy-draft/setup`;
  await initializeFantasyDraftOrder(saveId);
  const result = await randomizeFantasyDraftOrder(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function reorderFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const direction = Number(formData.get("direction") ?? 0) as -1 | 1;
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await reorderFantasyDraft(
    saveId,
    teamId,
    direction === -1 ? -1 : 1,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function moveFantasyDraftTeamToIndexAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const toIndex = Number(formData.get("toIndex") ?? -1);
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await moveFantasyDraftTeamToIndex(saveId, teamId, toIndex);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function swapFantasyDraftTeamsAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamIdA = String(formData.get("teamIdA") ?? "");
  const teamIdB = String(formData.get("teamIdB") ?? "");
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await swapFantasyDraftTeams(saveId, teamIdA, teamIdB);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function confirmFantasyDraftSetupAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await confirmFantasyDraftSetup(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(fantasyDraftPath(saveId));
}

export async function fantasyDraftPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await selectFantasyDraftPlayer(saveId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function toggleFantasyDraftAutoPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const path = fantasyDraftPath(saveId);
  const result = await toggleFantasyDraftAutoPick(saveId, teamId, enabled);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function toggleFantasyDraftAutoPickAllAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const path = fantasyDraftPath(saveId);
  const result = await toggleFantasyDraftAutoPickAll(saveId, enabled);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function pauseFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await pauseOwnerFantasyDraft(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function resumeFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await resumeOwnerFantasyDraft(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function undoFantasyDraftPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await undoOwnerFantasyDraftPick(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function addFantasyDraftQueuePlayerAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await addFantasyDraftQueuePlayer(saveId, teamId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function removeFantasyDraftQueuePlayerAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await removeFantasyDraftQueuePlayer(saveId, teamId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function reorderFantasyDraftQueueAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const orderedRaw = String(formData.get("orderedPlayerIds") ?? "");
  const orderedPlayerIds = orderedRaw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const path = fantasyDraftPath(saveId);
  const result = await reorderFantasyDraftQueuePlayers(
    saveId,
    teamId,
    orderedPlayerIds,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function setFantasyDraftAutoPickStrategyAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const strategyRaw = String(formData.get("strategy") ?? "");
  const path = fantasyDraftPath(saveId);
  if (!isFantasyDraftAutoPickStrategy(strategyRaw)) {
    redirectWithError(path, "Invalid auto-pick strategy.");
  }
  const result = await setOwnerFantasyDraftAutoPickStrategy(
    saveId,
    teamId,
    strategyRaw as FantasyDraftAutoPickStrategy,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function updateFantasyDraftSettingsAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const confirmPicks = String(formData.get("confirmPicks") ?? "") === "true";
  const path = fantasyDraftPath(saveId);
  const result = await updateOwnerFantasyDraftSettings(saveId, {
    confirmPicks,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function advanceFantasyDraftUntilNextPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await advanceFantasyDraftUntilNextPick(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function continueAfterFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await continueAfterFantasyDraft(saveId);
  if (!result.ok) {
    redirectWithError(`${fantasyDraftPath(saveId)}/summary`, result.error);
  }
  revalidateOwner(saveId);
  redirect(`/dashboard/${saveId}`);
}

/** Client-callable detail fetch (no redirect). */
export async function fetchFantasyDraftPlayerDetailAction(
  saveId: string,
  playerId: string,
): Promise<FantasyDraftPlayerDetailView | null> {
  return loadFantasyDraftPlayerDetail(saveId, playerId);
}
