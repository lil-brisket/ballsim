"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  advanceOwnerTime,
  approveOwnerExpansion,
  cancelOwnerRelocation,
  completeOwnerExpansion,
  createNewOwnerSave,
  declineOwnerTeamOption,
  deleteOwnerSave,
  executeOwnerTrade,
  exerciseOwnerTeamOption,
  finishFreeAgency,
  beginOffseason,
  letAiHandlePhaseAndAdvance,
  continuePastPhaseAnyway,
  acceptOwnerDecision,
  declineOwnerDecision,
  delegateOwnerDecisionToAi,
  fireOwnerStaff,
  hireOwnerStaff,
  loadOwnerSave,
  makeOwnerFreeAgentOffer,
  markOwnerNotificationsRead,
  acknowledgeOwnerNarrativeSituation,
  resolveOwnerNarrativeSituation,
  proposeOwnerExpansion,
  advanceOwnerRelocation,
  runOwnerExpansionDraft,
  selectOwnerDraftProspect,
  selectOwnerTeam,
  setOwnerMarketingBudget,
  setOwnerTicketPrice,
  signOwnerFreeAgent,
  signOwnerSponsorship,
  upgradeOwnerFacility,
  withdrawOwnerFreeAgentOffer,
} from "@/application/game-service";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";

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
  const settingsJson = String(formData.get("settingsJson") ?? "");
  let settings = DEFAULT_GAME_SETTINGS;
  if (settingsJson) {
    try {
      const parsed = JSON.parse(settingsJson) as unknown;
      const validated = validateGameSettings(parsed);
      if (!validated.ok) {
        redirectWithError(
          "/new/setup?mode=owner",
          validated.errors.join("; "),
        );
      }
      settings = validated.settings;
    } catch {
      redirectWithError(
        "/new/setup?mode=owner",
        "Invalid game settings payload.",
      );
    }
  }
  const result = await createNewOwnerSave({ name, settings });
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
  if (!loaded.dashboard.teamSelectionLocked) {
    redirect(`/new/${loaded.save.id}/team`);
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

export async function acceptOwnerDecisionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const decisionId = String(formData.get("decisionId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await acceptOwnerDecision(saveId, decisionId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function declineOwnerDecisionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const decisionId = String(formData.get("decisionId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await declineOwnerDecision(saveId, decisionId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function askAiOwnerDecisionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const decisionId = String(formData.get("decisionId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await delegateOwnerDecisionToAi(saveId, decisionId);
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

export async function beginOffseasonAction(
  formData: FormData,
): Promise<void> {
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

export async function hireStaffAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await hireOwnerStaff(saveId, staffId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function fireStaffAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await fireOwnerStaff(saveId, staffId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function upgradeFacilityAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const category = String(formData.get("category") ?? "") as FacilityCategory;
  const path = returnPath(formData, saveId);
  const result = await upgradeOwnerFacility(saveId, category);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function setTicketPriceAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const ticketPrice = Number(formData.get("ticketPrice") ?? 0);
  const path = returnPath(formData, saveId);
  const result = await setOwnerTicketPrice(saveId, ticketPrice);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function setMarketingBudgetAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const budget = Number(formData.get("budget") ?? 0);
  const path = returnPath(formData, saveId);
  const result = await setOwnerMarketingBudget(saveId, budget);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function signSponsorshipAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await signOwnerSponsorship(saveId, {
    sponsorName: String(formData.get("sponsorName") ?? "Local Sponsor"),
    annualValue: Number(formData.get("annualValue") ?? 2_000_000),
    years: Number(formData.get("years") ?? 3),
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function advanceRelocationAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const targetJson = String(formData.get("targetJson") ?? "");
  const path = returnPath(formData, saveId);
  const result = await advanceOwnerRelocation(
    saveId,
    targetJson || undefined,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function cancelRelocationAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await cancelOwnerRelocation(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function proposeExpansionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await proposeOwnerExpansion(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function approveExpansionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const candidateIndex = Number(formData.get("candidateIndex") ?? 0);
  const path = returnPath(formData, saveId);
  const result = await approveOwnerExpansion(saveId, candidateIndex);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function runExpansionDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await runOwnerExpansionDraft(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function completeExpansionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await completeOwnerExpansion(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}
