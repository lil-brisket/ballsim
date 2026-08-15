"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  advanceOwnerTime,
  createNewOwnerSave,
  executeOwnerTrade,
  finishFreeAgency,
  loadOwnerSave,
  selectOwnerDraftProspect,
  selectOwnerTeam,
  signOwnerFreeAgent,
} from "@/application/game-service";

export async function createSaveAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "New Franchise");
  const result = await createNewOwnerSave({ name });
  revalidatePath("/");
  redirect(`/new/${result.save.id}/team`);
}

export async function openSaveAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    throw new Error("Save not found.");
  }
  if (!loaded.dashboard.teamSelectionLocked) {
    redirect(`/new/${loaded.save.id}/team`);
  }
  redirect(`/dashboard/${loaded.save.id}`);
}

export async function selectTeamAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const result = await selectOwnerTeam(saveId, teamId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}

export async function advanceDayAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await advanceOwnerTime(saveId, { days: 1 });
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}

export async function advanceWeekAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await advanceOwnerTime(saveId, { days: 7 });
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}

export async function advanceUntilPhaseAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await advanceOwnerTime(saveId, {
    days: 400,
    stopOnPhaseChange: true,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}

export async function executeTradeAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const outgoingPlayerId = String(formData.get("outgoingPlayerId") ?? "");
  const result = await executeOwnerTrade(saveId, { outgoingPlayerId });
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}

export async function signFreeAgentAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const result = await signOwnerFreeAgent(saveId, { playerId });
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}

export async function finishFreeAgencyAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await finishFreeAgency(saveId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}

export async function draftProspectAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const prospectPlayerId = String(formData.get("prospectPlayerId") ?? "");
  const result = await selectOwnerDraftProspect(saveId, prospectPlayerId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}
