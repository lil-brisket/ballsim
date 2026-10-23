"use server";

import {
  updateOwnerLineupAndRotation,
  previewOwnerOptimizeRotation,
  updateOwnerCoachingPhilosophy,
  setOwnerDevelopmentFocus,
  applyOwnerCoachingPreset,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

type CombinedRotationPayloadEntry = {
  playerId: string;
  targetMinutes: number;
  minimumMinutes?: number;
  normalMaximumMinutes?: number;
  absoluteMaximumMinutes?: number;
  rotationPriority: number;
  rotationStatus: string;
  role: string;
  preferredPositions: string[];
  secondaryPositions?: string[];
  minutePriorityBias?: number;
  overrideMedicalRecommendation?: boolean;
};

function parseCombinedLineupRotationPayload(formData: FormData):
  | {
      ok: true;
      startingLineup: Array<{ playerId: string; slot: string }>;
      bench: string[];
      inactive: string[];
      rotation: CombinedRotationPayloadEntry[];
      closingLineupIds: string[];
      rotationStyle: string;
      rotationPhilosophy: string;
      rotationDepthRaw: string;
      rotationPreset: string;
      closingLineupPolicy: string;
    }
  | { ok: false; error: string } {
  try {
    return {
      ok: true,
      startingLineup: JSON.parse(
        String(formData.get("startingLineupJson") ?? "[]"),
      ) as Array<{ playerId: string; slot: string }>,
      bench: JSON.parse(String(formData.get("benchJson") ?? "[]")) as string[],
      inactive: JSON.parse(
        String(formData.get("inactiveJson") ?? "[]"),
      ) as string[],
      rotation: JSON.parse(
        String(formData.get("rotationJson") ?? "[]"),
      ) as CombinedRotationPayloadEntry[],
      closingLineupIds: JSON.parse(
        String(formData.get("closingLineupJson") ?? "[]"),
      ) as string[],
      rotationStyle: String(formData.get("rotationStyle") ?? ""),
      rotationPhilosophy: String(formData.get("rotationPhilosophy") ?? ""),
      rotationDepthRaw: String(formData.get("rotationDepth") ?? ""),
      rotationPreset: String(formData.get("rotationPreset") ?? ""),
      closingLineupPolicy: String(formData.get("closingLineupPolicy") ?? ""),
    };
  } catch {
    return { ok: false, error: "Invalid lineup/rotation payload." };
  }
}

export async function updateLineupAndRotationAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const path = returnPath(formData, saveId);
  const parsed = parseCombinedLineupRotationPayload(formData);
  if (!parsed.ok) {
    redirectWithError(path, parsed.error);
  }
  const result = await updateOwnerLineupAndRotation(saveId, {
    teamId,
    startingLineup: parsed.startingLineup,
    bench: parsed.bench,
    inactive: parsed.inactive,
    rotation: parsed.rotation,
    rotationStyle: parsed.rotationStyle || undefined,
    rotationPhilosophy: parsed.rotationPhilosophy || undefined,
    rotationDepth: parsed.rotationDepthRaw
      ? Number(parsed.rotationDepthRaw)
      : undefined,
    rotationPreset: parsed.rotationPreset || undefined,
    closingLineupPolicy: parsed.closingLineupPolicy || undefined,
    closingLineupIds: parsed.closingLineupIds,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

/**
 * Non-persisting optimize preview for the combined editor.
 * Returns JSON so the client can apply locally + undo before Save.
 */
export async function previewOptimizeRotationAction(
  formData: FormData,
): Promise<
  | {
      ok: true;
      management: import("@/domain/entities/team-roster-management").TeamRosterManagement;
      changelog: import("@/systems/roster-management").OptimizeChange[];
    }
  | { ok: false; error: string }
> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const parsed = parseCombinedLineupRotationPayload(formData);
  if (!parsed.ok) {
    return parsed;
  }
  return previewOwnerOptimizeRotation(saveId, {
    teamId,
    startingLineup: parsed.startingLineup,
    bench: parsed.bench,
    inactive: parsed.inactive,
    rotation: parsed.rotation,
    rotationStyle: parsed.rotationStyle || undefined,
    rotationPhilosophy: parsed.rotationPhilosophy || undefined,
    rotationDepth: parsed.rotationDepthRaw
      ? Number(parsed.rotationDepthRaw)
      : undefined,
    rotationPreset: parsed.rotationPreset || "auto",
    closingLineupPolicy: parsed.closingLineupPolicy || undefined,
    closingLineupIds: parsed.closingLineupIds,
  });
}

export async function updateCoachingPhilosophyAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await updateOwnerCoachingPhilosophy(saveId, {
    teamId,
    pace: String(formData.get("pace") ?? "balanced"),
    offensiveEmphasis: String(formData.get("offensiveEmphasis") ?? "balanced"),
    defensiveApproach: String(formData.get("defensiveApproach") ?? "balanced"),
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function applyCoachingPresetAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const presetId = String(formData.get("presetId") ?? "balanced");
  const path = returnPath(formData, saveId);
  const result = await applyOwnerCoachingPreset(saveId, { teamId, presetId });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function setDevelopmentFocusAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await setOwnerDevelopmentFocus(saveId, {
    playerId: String(formData.get("playerId") ?? ""),
    focus: String(formData.get("focus") ?? "balanced"),
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}
