"use server";

import {
  hireOwnerStaff,
  fireOwnerStaff,
  renewOwnerStaffContract,
  makeOwnerStaffOffer,
  negotiateOwnerStaffOffer,
  acceptOwnerStaffOffer,
  upgradeOwnerFacility,
  setOwnerTicketPrice,
  setOwnerMarketingBudget,
  scheduleOwnerGameDayPromotion,
  cancelOwnerGameDayPromotion,
  changeOwnerGameDayPromotion,
  signOwnerSponsorship,
  advanceOwnerRelocation,
  cancelOwnerRelocation,
  proposeOwnerExpansion,
  approveOwnerExpansion,
  runOwnerExpansionDraft,
  completeOwnerExpansion,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

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

export async function renewStaffContractAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const years = Number(formData.get("years") ?? "");
  const annualSalary = Number(formData.get("annualSalary") ?? "");
  const path = returnPath(formData, saveId);
  const result = await renewOwnerStaffContract(
    saveId,
    staffId,
    years,
    annualSalary,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function makeStaffOfferAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const annualSalary = Number(formData.get("annualSalary") ?? "");
  const years = Number(formData.get("years") ?? "");
  const path = returnPath(formData, saveId);
  const result = await makeOwnerStaffOffer(
    saveId,
    staffId,
    annualSalary,
    years,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function negotiateStaffOfferAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const offerId = String(formData.get("offerId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await negotiateOwnerStaffOffer(saveId, offerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function acceptStaffOfferAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const offerId = String(formData.get("offerId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await acceptOwnerStaffOffer(saveId, offerId);
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

export async function scheduleGameDayPromotionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  const promotionId = String(formData.get("promotionId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await scheduleOwnerGameDayPromotion(
    saveId,
    gameId,
    promotionId,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function cancelGameDayPromotionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await cancelOwnerGameDayPromotion(saveId, gameId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function changeGameDayPromotionAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  const promotionId = String(formData.get("promotionId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await changeOwnerGameDayPromotion(saveId, gameId, promotionId);
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
  const result = await advanceOwnerRelocation(saveId, targetJson || undefined);
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
