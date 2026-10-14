"use server";

import type {
  PlayerDrawerView,
  TeamDrawerView,
  StaffDrawerView,
} from "@/state/entity-drawer-selectors";
import {
  loadPlayerDrawerView,
  loadTeamDrawerView,
  loadStaffDrawerView,
  upsertCustomContentPackage,
  resolveOwnerDraftClassDecision,
  updateOwnerCustomRosterPlayer,
  removeOwnerCustomRosterPlayer,
  addOwnerCustomRosterPlayer,
  exportOwnerRoster,
  exportOwnerDraftClass,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

/** Client-callable player drawer fetch (no redirect). */
export async function fetchPlayerDrawerViewAction(
  saveId: string,
  playerId: string,
): Promise<PlayerDrawerView | null> {
  return loadPlayerDrawerView(saveId, playerId);
}

/** Client-callable team drawer fetch (no redirect). */
export async function fetchTeamDrawerViewAction(
  saveId: string,
  teamId: string,
): Promise<TeamDrawerView | null> {
  return loadTeamDrawerView(saveId, teamId);
}

/** Client-callable staff drawer fetch (no redirect). */
export async function fetchStaffDrawerViewAction(
  saveId: string,
  staffId: string,
): Promise<StaffDrawerView | null> {
  return loadStaffDrawerView(saveId, staffId);
}

export async function upsertCustomContentPackageAction(
  payloadJson: string,
): Promise<{ ok: true; contentId: string } | { ok: false; error: string }> {
  return upsertCustomContentPackage(payloadJson);
}

export async function resolveDraftClassDecisionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const sourceRaw = String(formData.get("source") ?? "");
  const path = returnPath(formData, saveId);
  if (sourceRaw !== "generated" && sourceRaw !== "custom") {
    redirectWithError(path, "Choose a generated or custom draft class.");
  }
  const packageJson = String(formData.get("packageJson") ?? "");
  const contentId = String(formData.get("contentId") ?? "");
  let packageRaw: unknown;
  if (packageJson.length > 0) {
    try {
      packageRaw = JSON.parse(packageJson) as unknown;
    } catch {
      redirectWithError(path, "Invalid custom draft class package.");
    }
  }
  const result = await resolveOwnerDraftClassDecision(saveId, {
    source: sourceRaw,
    packageRaw,
    contentId: contentId.length > 0 ? contentId : undefined,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function updateCustomRosterPlayerAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = returnPath(formData, saveId);
  const patchJson = String(formData.get("patchJson") ?? "");
  let patch: Record<string, unknown> = {};
  if (patchJson.length > 0) {
    try {
      patch = JSON.parse(patchJson) as Record<string, unknown>;
    } catch {
      redirectWithError(path, "Invalid player patch.");
    }
  }
  const result = await updateOwnerCustomRosterPlayer(saveId, playerId, patch);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function removeCustomRosterPlayerAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await removeOwnerCustomRosterPlayer(saveId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function addCustomRosterPlayerAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const playerJson = String(formData.get("playerJson") ?? "");
  let player: unknown;
  try {
    player = JSON.parse(playerJson) as unknown;
  } catch {
    redirectWithError(path, "Invalid player payload.");
  }
  const result = await addOwnerCustomRosterPlayer(
    saveId,
    player as Parameters<typeof addOwnerCustomRosterPlayer>[1],
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function exportRosterAction(
  saveId: string,
): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  return exportOwnerRoster(saveId);
}

export async function exportDraftClassAction(
  saveId: string,
  draftYear: number,
): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  return exportOwnerDraftClass(saveId, draftYear);
}
