"use server";

import {
  advanceOwnerTime,
  letAiHandlePhaseAndAdvance,
  continuePastPhaseAnyway,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

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

export async function advanceMonthAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, { targetMode: "next_month" });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirectWithSummary(
    path,
    result.simulation.daysAdvanced,
    result.highlights.length,
    result.summary?.fromDate,
  );
}

export async function simulateToEndOfSeasonAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, {
    targetMode: "end_of_season",
    stopOnPhaseChange: false,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirectWithSummary(
    path,
    result.simulation.daysAdvanced,
    result.highlights.length,
    result.summary?.fromDate,
  );
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

function parseStopConditions(
  formData: FormData,
): import("@/application/game-service").SimulationStopCondition[] {
  const conditions: import("@/application/game-service").SimulationStopCondition[] =
    [];
  if (formData.get("stopBlockingDecision") === "1") {
    conditions.push("blocking_decision");
  }
  if (formData.get("stopUserTeamGame") === "1") {
    conditions.push("user_team_game");
  }
  if (formData.get("stopImportantEvent") === "1") {
    conditions.push("important_event");
  }
  if (formData.get("stopPhaseChange") === "1") {
    conditions.push("phase_change");
  }
  return conditions;
}

function redirectWithSummary(
  path: string,
  daysAdvanced: number,
  highlightCount: number,
  fromDate?: string,
): never {
  const separator = path.includes("?") ? "&" : "?";
  const fromParam =
    fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)
      ? `&fromDate=${fromDate}`
      : "";
  redirect(
    `${path}${separator}simSummary=1&daysAdvanced=${daysAdvanced}&highlights=${highlightCount}${fromParam}`,
  );
}

export async function simulateToDateAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const targetDate = String(formData.get("targetDate") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    redirectWithError(path, "Invalid target date.");
  }
  const result = await advanceOwnerTime(saveId, {
    targetDate,
    stopConditions: parseStopConditions(formData),
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirectWithSummary(
    path,
    result.simulation.daysAdvanced,
    result.highlights.length,
  );
}

export async function simulateToNextGameAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, { targetMode: "next_game" });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirectWithSummary(
    path,
    result.simulation.daysAdvanced,
    result.highlights.length,
  );
}

export async function simulateToNextImportantAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, {
    targetMode: "next_important",
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirectWithSummary(
    path,
    result.simulation.daysAdvanced,
    result.highlights.length,
  );
}

export async function simulateToNextDecisionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, {
    targetMode: "next_decision",
    stopOnPhaseChange: true,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirectWithSummary(
    path,
    result.simulation.daysAdvanced,
    result.highlights.length,
  );
}

export async function simulateToNextDeadlineAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerTime(saveId, {
    targetMode: "next_deadline",
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirectWithSummary(
    path,
    result.simulation.daysAdvanced,
    result.highlights.length,
  );
}

export async function letAiHandlePhaseAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await letAiHandlePhaseAndAdvance(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function continuePastPhaseAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await continuePastPhaseAnyway(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}
