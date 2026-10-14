"use server";

import {
  markOwnerNotificationsRead,
  markMediaRead,
  markAllMediaRead,
  acknowledgeOwnerNarrativeSituation,
  resolveOwnerNarrativeSituation,
  exerciseOwnerTeamOption,
  declineOwnerTeamOption,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

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

export async function markMediaReadAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const mediaItemId = String(formData.get("mediaItemId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await markMediaRead(saveId, mediaItemId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function markAllMediaReadAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await markAllMediaRead(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function acknowledgeNarrativeSituationAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const situationId = String(formData.get("situationId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await acknowledgeOwnerNarrativeSituation(saveId, situationId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function resolveNarrativeSituationAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const situationId = String(formData.get("situationId") ?? "");
  const actionId = String(formData.get("actionId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await resolveOwnerNarrativeSituation(
    saveId,
    situationId,
    actionId,
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
