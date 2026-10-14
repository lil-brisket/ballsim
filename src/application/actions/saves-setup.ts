"use server";

import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";
import {
  createNewOwnerSave,
  loadOwnerSave,
  deleteOwnerSave,
  selectOwnerTeam,
  switchActiveOwnerTeam,
  takeOverFranchise,
  confirmControlledFranchises,
  confirmOwnedFranchises,
  selectOwnerCity,
  confirmOwnerTeamIdentity,
} from "@/application/game-service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  redirectWithError,
  revalidateOwner,
  returnPath,
} from "@/application/actions/shared";

export async function createSaveAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "New Franchise");
  const settingsJson = String(formData.get("settingsJson") ?? "");
  let settings = DEFAULT_GAME_SETTINGS;
  if (settingsJson) {
    try {
      const parsed = JSON.parse(settingsJson) as unknown;
      const validated = validateGameSettings(parsed);
      if (!validated.ok) {
        redirectWithError("/new/setup?mode=owner", validated.errors.join("; "));
      }
      settings = validated.settings;
    } catch {
      redirectWithError(
        "/new/setup?mode=owner",
        "Invalid game settings payload.",
      );
    }
  }
  const rosterPackageJson = String(formData.get("rosterPackageJson") ?? "");
  const rosterContentId = String(formData.get("rosterContentId") ?? "");
  let rosterPackage: unknown;
  if (rosterPackageJson.length > 0) {
    try {
      rosterPackage = JSON.parse(rosterPackageJson) as unknown;
    } catch {
      redirectWithError(
        "/new/setup?mode=owner",
        "Invalid custom roster package.",
      );
    }
  }
  const result = await createNewOwnerSave({
    name,
    settings,
    rosterPackage,
    rosterContentId: rosterContentId.length > 0 ? rosterContentId : undefined,
  });
  if (!result.ok) {
    redirectWithError("/new/setup?mode=owner", result.error);
  }
  revalidatePath("/home");
  redirect(`/new/${result.save.id}/team`);
}

export async function openSaveAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    throw new Error("Save not found.");
  }
  if (!loaded.dashboard.franchiseIdentityConfirmed) {
    if (!loaded.dashboard.citySelectionConfirmed) {
      redirect(`/new/${loaded.save.id}/team`);
    }
    redirect(`/new/${loaded.save.id}/franchises`);
  }
  redirect(`/dashboard/${loaded.save.id}`);
}

export async function deleteSaveAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "").trim();
  if (!saveId) {
    throw new Error("Save id is required.");
  }
  await deleteOwnerSave(saveId);
  revalidatePath("/home");
  revalidatePath("/saves");
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

export async function switchActiveOwnerTeamAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await switchActiveOwnerTeam(saveId, teamId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  revalidatePath(`/fantasy-draft/${saveId}`, "layout");
  redirect(path);
}

export async function takeOverFranchiseAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const result = await takeOverFranchise(saveId, teamId);
  if (!result.ok) {
    redirectWithError(`/dashboard/${saveId}/league`, result.error);
  }
  revalidateOwner(saveId);
  redirect(`/dashboard/${saveId}`);
}

export async function confirmControlledFranchisesAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const rawJson = String(formData.get("franchisesJson") ?? "");
  let franchises: Array<{
    teamId: string;
    nickname: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  }> = [];
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) {
      redirectWithError(
        `/new/${saveId}/franchises`,
        "Invalid franchise payload.",
      );
    }
    franchises = parsed.map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        teamId: String(record.teamId ?? ""),
        nickname: String(record.nickname ?? ""),
        primaryColor: String(record.primaryColor ?? ""),
        secondaryColor: String(record.secondaryColor ?? ""),
        accentColor: String(record.accentColor ?? ""),
        logoId: String(record.logoId ?? ""),
      };
    });
  } catch {
    redirectWithError(
      `/new/${saveId}/franchises`,
      "Invalid franchise payload.",
    );
  }

  const result = await confirmControlledFranchises(saveId, franchises);
  if (!result.ok) {
    redirectWithError(`/new/${saveId}/franchises`, result.error);
  }
  revalidateOwner(saveId);
  if (result.dashboard.fantasyDraftMode) {
    redirect(`/new/${saveId}/fantasy-draft/setup`);
  }
  redirect(`/dashboard/${saveId}`);
}

export async function confirmOwnedFranchisesAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const additional = formData
    .getAll("additionalTeamId")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  const result = await confirmOwnedFranchises(saveId, additional);
  if (!result.ok) {
    redirectWithError(`/new/${saveId}/franchises`, result.error);
  }
  revalidateOwner(saveId);
  redirect(`/dashboard/${saveId}`);
}

export async function selectCityAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const city = String(formData.get("city") ?? "");
  const result = await selectOwnerCity(saveId, city);
  if (!result.ok) {
    redirectWithError(`/new/${saveId}/team`, result.error);
  }
  revalidateOwner(saveId);
  redirect(`/new/${saveId}/franchises`);
}

export async function confirmTeamIdentityAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const nickname = String(formData.get("nickname") ?? "");
  const logoId = String(formData.get("logoId") ?? "");
  const primaryColor = String(formData.get("primaryColor") ?? "");
  const secondaryColor = String(formData.get("secondaryColor") ?? "");
  const accentColor = String(formData.get("accentColor") ?? "");
  const paletteIdRaw = formData.get("paletteId");
  const paletteId =
    paletteIdRaw === null || String(paletteIdRaw).trim() === ""
      ? undefined
      : String(paletteIdRaw);
  const result = await confirmOwnerTeamIdentity(saveId, {
    nickname,
    logoId,
    primaryColor,
    secondaryColor,
    accentColor,
    paletteId,
  });
  if (!result.ok) {
    redirectWithError(`/new/${saveId}/branding`, result.error);
  }
  revalidateOwner(saveId);
  redirect(`/dashboard/${saveId}`);
}
