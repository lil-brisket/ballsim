"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  advanceOwnerTime,
  createNewOwnerSave,
  declineOwnerTeamOption,
  executeOwnerTrade,
  exerciseOwnerTeamOption,
  finishFreeAgency,
  loadOwnerSave,
  makeOwnerFreeAgentOffer,
  markOwnerNotificationsRead,
  selectOwnerDraftProspect,
  selectOwnerTeam,
  signOwnerFreeAgent,
  withdrawOwnerFreeAgentOffer,
} from "@/application/game-service";

function ownerBase(saveId: string): string {
  return `/dashboard/${saveId}`;
}

function revalidateOwner(saveId: string): void {
  revalidatePath(ownerBase(saveId), "layout");
}

function redirectWithError(path: string, error: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(error)}`);
}

function returnPath(formData: FormData, saveId: string): string {
  const raw = String(formData.get("returnPath") ?? "");
  if (raw.startsWith(`/dashboard/${saveId}`)) {
    return raw;
  }
  return ownerBase(saveId);
}

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
    redirectWithError(`/new/${saveId}/team`, result.error);
  }
  revalidateOwner(saveId);
  redirect(`/dashboard/${saveId}`);
}

export async function advanceDayAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, { days: 1 });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function advanceWeekAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, { days: 7 });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function advanceUntilPhaseAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, {
    days: 400,
    stopOnPhaseChange: true,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function executeTradeAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const outgoingPlayerId = String(formData.get("outgoingPlayerId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await executeOwnerTrade(saveId, { outgoingPlayerId });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function signFreeAgentAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const salaryRaw = formData.get("salary");
  const yearsRaw = formData.get("years");
  const path = returnPath(formData, saveId);
  const result = await signOwnerFreeAgent(saveId, {
    playerId,
    salary:
      salaryRaw !== null && String(salaryRaw).length > 0
        ? Number(salaryRaw)
        : undefined,
    years:
      yearsRaw !== null && String(yearsRaw).length > 0
        ? Number(yearsRaw)
        : undefined,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function makeFreeAgentOfferAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const salaryRaw = formData.get("salary");
  const yearsRaw = formData.get("years");
  const path = returnPath(formData, saveId);
  const result = await makeOwnerFreeAgentOffer(saveId, {
    playerId,
    salary:
      salaryRaw !== null && String(salaryRaw).length > 0
        ? Number(salaryRaw)
        : undefined,
    years:
      yearsRaw !== null && String(yearsRaw).length > 0
        ? Number(yearsRaw)
        : undefined,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function withdrawFreeAgentOfferAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const offerId = String(formData.get("offerId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await withdrawOwnerFreeAgentOffer(saveId, offerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function finishFreeAgencyAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await finishFreeAgency(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function draftProspectAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const prospectPlayerId = String(formData.get("prospectPlayerId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await selectOwnerDraftProspect(saveId, prospectPlayerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function markNotificationsReadAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const singleId = String(formData.get("notificationId") ?? "");
  const result = await markOwnerNotificationsRead(
    saveId,
    singleId.length > 0 ? [singleId] : undefined,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function exerciseTeamOptionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await exerciseOwnerTeamOption(saveId, contractId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function declineTeamOptionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await declineOwnerTeamOption(saveId, contractId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}
