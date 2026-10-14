"use server";

import {
  signOwnerFreeAgent,
  makeOwnerFreeAgentOffer,
  withdrawOwnerFreeAgentOffer,
  finishFreeAgency,
  advanceLeaguePhaseCommand,
  dismissPhaseTask,
  beginOffseason,
  selectOwnerDraftProspect,
  calendarHrefAfterOwnerMutation,
  assignOwnerScoutToProspect,
  assignOwnerPlayerToDevelopmentLeague,
  recallOwnerPlayerFromDevelopmentLeague,
  scoutOwnerRegion,
  addOwnerDraftBoardProspect,
  removeOwnerDraftBoardProspect,
  toggleOwnerDraftBoardPriority,
  interviewOwnerProspect,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

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

export async function advanceLeaguePhaseAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceLeaguePhaseCommand(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function dismissPhaseTaskAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const taskKey = String(formData.get("taskKey") ?? "");
  const path = returnPath(formData, saveId);
  const result = await dismissPhaseTask(saveId, taskKey);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function beginOffseasonAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await beginOffseason(saveId);
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
  const resumeToRaw = String(formData.get("resumeTo") ?? "");
  const calendarHref = await calendarHrefAfterOwnerMutation(
    saveId,
    resumeToRaw || null,
    { autoResumeIfClear: true },
  );
  redirect(calendarHref ?? path);
}

export async function assignScoutAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const prospectPlayerId = String(formData.get("prospectPlayerId") ?? "");
  const path = returnPath(formData, `/dashboard/${saveId}/scouting`);
  const result = await assignOwnerScoutToProspect(saveId, prospectPlayerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function assignToDevelopmentLeagueAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = returnPath(formData, `/dashboard/${saveId}/development-league`);
  const result = await assignOwnerPlayerToDevelopmentLeague(saveId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function recallFromDevelopmentLeagueAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = returnPath(formData, `/dashboard/${saveId}/development-league`);
  const result = await recallOwnerPlayerFromDevelopmentLeague(saveId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function scoutRegionAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const region = String(formData.get("region") ?? "domestic");
  const path = returnPath(formData, `/dashboard/${saveId}/scouting`);
  if (region !== "domestic" && region !== "international") {
    redirectWithError(path, "Invalid scouting region.");
  }
  const result = await scoutOwnerRegion(
    saveId,
    region as "domestic" | "international",
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function addDraftBoardAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const prospectPlayerId = String(formData.get("prospectPlayerId") ?? "");
  const path = returnPath(formData, `/dashboard/${saveId}/draft`);
  const result = await addOwnerDraftBoardProspect(saveId, prospectPlayerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function removeDraftBoardAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const prospectPlayerId = String(formData.get("prospectPlayerId") ?? "");
  const path = returnPath(formData, `/dashboard/${saveId}/draft`);
  const result = await removeOwnerDraftBoardProspect(saveId, prospectPlayerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function toggleDraftBoardPriorityAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const prospectPlayerId = String(formData.get("prospectPlayerId") ?? "");
  const path = returnPath(formData, `/dashboard/${saveId}/draft`);
  const result = await toggleOwnerDraftBoardPriority(saveId, prospectPlayerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function interviewProspectAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const prospectPlayerId = String(formData.get("prospectPlayerId") ?? "");
  const path = returnPath(formData, `/dashboard/${saveId}/scouting`);
  const result = await interviewOwnerProspect(saveId, prospectPlayerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}
