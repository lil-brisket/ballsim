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
  advanceLeaguePhaseCommand,
  dismissPhaseTask,
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
  markMediaRead,
  markAllMediaRead,
  acknowledgeOwnerNarrativeSituation,
  resolveOwnerNarrativeSituation,
  proposeOwnerExpansion,
  advanceOwnerRelocation,
  runOwnerExpansionDraft,
  selectOwnerDraftProspect,
  assignOwnerScoutToProspect,
  assignOwnerPlayerToDevelopmentLeague,
  recallOwnerPlayerFromDevelopmentLeague,
  scoutOwnerRegion,
  addOwnerDraftBoardProspect,
  removeOwnerDraftBoardProspect,
  toggleOwnerDraftBoardPriority,
  interviewOwnerProspect,
  selectOwnerCity,
  confirmOwnerTeamIdentity,
  selectOwnerTeam,
  switchActiveOwnerTeam,
  takeOverFranchise,
  confirmControlledFranchises,
  confirmOwnedFranchises,
  setOwnerMarketingBudget,
  setOwnerTicketPrice,
  scheduleOwnerGameDayPromotion,
  cancelOwnerGameDayPromotion,
  changeOwnerGameDayPromotion,
  signOwnerFreeAgent,
  signOwnerSponsorship,
  upgradeOwnerFacility,
  withdrawOwnerFreeAgentOffer,
  updateOwnerLineup,
  updateOwnerRotation,
  optimizeOwnerRotation,
  applyOwnerLineupRecommendation,
  updateOwnerCoachingPhilosophy,
  applyOwnerCoachingPreset,
  submitTradeCounteroffer,
} from "@/application/game-service";
import {
  addFantasyDraftQueuePlayer,
  advanceFantasyDraftUntilNextPick,
  configureFantasyDraftSetup,
  confirmFantasyDraftSetup,
  continueAfterFantasyDraft,
  initializeFantasyDraftOrder,
  loadFantasyDraftPlayerDetail,
  moveFantasyDraftTeamToIndex,
  pauseOwnerFantasyDraft,
  randomizeFantasyDraftOrder,
  removeFantasyDraftQueuePlayer,
  reorderFantasyDraft,
  reorderFantasyDraftQueuePlayers,
  resumeOwnerFantasyDraft,
  selectFantasyDraftPlayer,
  setOwnerFantasyDraftAutoPickStrategy,
  swapFantasyDraftTeams,
  toggleFantasyDraftAutoPick,
  toggleFantasyDraftAutoPickAll,
  undoOwnerFantasyDraftPick,
  updateOwnerFantasyDraftSettings,
} from "@/application/game-service";
import type { FantasyDraftAutoPickStrategy } from "@/domain/entities/fantasy-draft";
import { isFantasyDraftAutoPickStrategy } from "@/domain/entities/fantasy-draft";
import type { FantasyDraftPlayerDetailView } from "@/state/selectors";
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
  if (
    raw.startsWith(`/dashboard/${saveId}`) ||
    raw.startsWith(`/fantasy-draft/${saveId}`) ||
    raw.startsWith(`/new/${saveId}/fantasy-draft`)
  ) {
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
): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}simSummary=1&daysAdvanced=${daysAdvanced}&highlights=${highlightCount}`,
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

export async function submitTradeCounterofferAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const decisionId = String(formData.get("decisionId") ?? "");
  const path = returnPath(formData, saveId);
  const offeringTeamId = String(formData.get("offeringTeamId") ?? "");
  const userTeamId = String(formData.get("userTeamId") ?? "");
  const cpuPlayerIds = formData.getAll("cpuPlayerIds").map(String);
  const cpuPickIds = formData.getAll("cpuPickIds").map(String);
  const userPlayerIds = formData.getAll("userPlayerIds").map(String);
  const userPickIds = formData.getAll("userPickIds").map(String);

  const { asDraftPickId, asPlayerId, asTeamId } = await import("@/domain/ids");
  const proposal = {
    sideA: {
      teamId: asTeamId(offeringTeamId),
      playerIds: cpuPlayerIds.map(asPlayerId),
      draftPickIds: cpuPickIds.map(asDraftPickId),
    },
    sideB: {
      teamId: asTeamId(userTeamId),
      playerIds: userPlayerIds.map(asPlayerId),
      draftPickIds: userPickIds.map(asDraftPickId),
    },
  };

  const result = await submitTradeCounteroffer(saveId, decisionId, proposal);
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
  const path = returnPath(
    formData,
    `/dashboard/${saveId}/development-league`,
  );
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
  const path = returnPath(
    formData,
    `/dashboard/${saveId}/development-league`,
  );
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

export async function removeDraftBoardAction(formData: FormData): Promise<void> {
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
  const result = await changeOwnerGameDayPromotion(
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

export async function updateLineupAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const path = returnPath(formData, saveId);
  const startingLineupJson = String(formData.get("startingLineupJson") ?? "[]");
  const benchJson = String(formData.get("benchJson") ?? "[]");
  const inactiveJson = String(formData.get("inactiveJson") ?? "[]");
  let startingLineup: Array<{ playerId: string; slot: string }> = [];
  let bench: string[] = [];
  let inactive: string[] = [];
  try {
    startingLineup = JSON.parse(startingLineupJson) as typeof startingLineup;
    bench = JSON.parse(benchJson) as string[];
    inactive = JSON.parse(inactiveJson) as string[];
  } catch {
    redirectWithError(path, "Invalid lineup payload.");
  }
  const result = await updateOwnerLineup(saveId, {
    teamId,
    startingLineup,
    bench,
    inactive,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function updateRotationAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const path = returnPath(formData, saveId);
  const rotationJson = String(formData.get("rotationJson") ?? "[]");
  const rotationStyle = String(formData.get("rotationStyle") ?? "");
  const rotationPhilosophy = String(formData.get("rotationPhilosophy") ?? "");
  const rotationDepthRaw = String(formData.get("rotationDepth") ?? "");
  const rotationPreset = String(formData.get("rotationPreset") ?? "");
  const closingLineupPolicy = String(formData.get("closingLineupPolicy") ?? "");
  const closingLineupJson = String(formData.get("closingLineupJson") ?? "[]");
  let rotation: Array<{
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
  }> = [];
  let closingLineupIds: string[] = [];
  try {
    rotation = JSON.parse(rotationJson) as typeof rotation;
    closingLineupIds = JSON.parse(closingLineupJson) as string[];
  } catch {
    redirectWithError(path, "Invalid rotation payload.");
  }
  const result = await updateOwnerRotation(saveId, {
    teamId,
    rotation,
    rotationStyle: rotationStyle || undefined,
    rotationPhilosophy: rotationPhilosophy || undefined,
    rotationDepth: rotationDepthRaw
      ? Number(rotationDepthRaw)
      : undefined,
    rotationPreset: rotationPreset || undefined,
    closingLineupPolicy: closingLineupPolicy || undefined,
    closingLineupIds,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function optimizeRotationAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const path = returnPath(formData, saveId);
  const rotationPreset = String(formData.get("rotationPreset") ?? "auto");
  const result = await optimizeOwnerRotation(saveId, {
    teamId,
    rotationPreset: rotationPreset || "auto",
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function applyLineupRecommendationAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const path = returnPath(formData, saveId);
  const result = await applyOwnerLineupRecommendation(saveId, teamId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
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
    defensiveApproach: String(
      formData.get("defensiveApproach") ?? "balanced",
    ),
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

function fantasyDraftPath(saveId: string): string {
  return `/fantasy-draft/${saveId}`;
}

function revalidateFantasyDraft(saveId: string): void {
  revalidatePath(`/fantasy-draft/${saveId}`, "layout");
  revalidatePath(`/new/${saveId}/fantasy-draft/setup`);
}

export async function configureFantasyDraftSetupAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const draftType = String(formData.get("draftType") ?? "snake") as
    | "snake"
    | "linear";
  const orderMode = String(formData.get("orderMode") ?? "random") as
    | "random"
    | "manual";
  const timerRaw = String(formData.get("timerSeconds") ?? "");
  const timerSeconds =
    timerRaw === "" || timerRaw === "off" ? null : Number(timerRaw);
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await configureFantasyDraftSetup(saveId, {
    draftType,
    orderMode,
    timerSeconds:
      timerSeconds !== null && Number.isFinite(timerSeconds)
        ? Math.max(1, Math.floor(timerSeconds))
        : null,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function randomizeFantasyDraftOrderAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = `/new/${saveId}/fantasy-draft/setup`;
  await initializeFantasyDraftOrder(saveId);
  const result = await randomizeFantasyDraftOrder(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function reorderFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const direction = Number(formData.get("direction") ?? 0) as -1 | 1;
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await reorderFantasyDraft(
    saveId,
    teamId,
    direction === -1 ? -1 : 1,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function moveFantasyDraftTeamToIndexAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const toIndex = Number(formData.get("toIndex") ?? -1);
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await moveFantasyDraftTeamToIndex(saveId, teamId, toIndex);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function swapFantasyDraftTeamsAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamIdA = String(formData.get("teamIdA") ?? "");
  const teamIdB = String(formData.get("teamIdB") ?? "");
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await swapFantasyDraftTeams(saveId, teamIdA, teamIdB);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function confirmFantasyDraftSetupAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = `/new/${saveId}/fantasy-draft/setup`;
  const result = await confirmFantasyDraftSetup(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(fantasyDraftPath(saveId));
}

export async function fantasyDraftPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await selectFantasyDraftPlayer(saveId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function toggleFantasyDraftAutoPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const path = fantasyDraftPath(saveId);
  const result = await toggleFantasyDraftAutoPick(saveId, teamId, enabled);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function toggleFantasyDraftAutoPickAllAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const path = fantasyDraftPath(saveId);
  const result = await toggleFantasyDraftAutoPickAll(saveId, enabled);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function pauseFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await pauseOwnerFantasyDraft(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function resumeFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await resumeOwnerFantasyDraft(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function undoFantasyDraftPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await undoOwnerFantasyDraftPick(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function addFantasyDraftQueuePlayerAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await addFantasyDraftQueuePlayer(saveId, teamId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function removeFantasyDraftQueuePlayerAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await removeFantasyDraftQueuePlayer(saveId, teamId, playerId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function reorderFantasyDraftQueueAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const orderedRaw = String(formData.get("orderedPlayerIds") ?? "");
  const orderedPlayerIds = orderedRaw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const path = fantasyDraftPath(saveId);
  const result = await reorderFantasyDraftQueuePlayers(
    saveId,
    teamId,
    orderedPlayerIds,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function setFantasyDraftAutoPickStrategyAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const strategyRaw = String(formData.get("strategy") ?? "");
  const path = fantasyDraftPath(saveId);
  if (!isFantasyDraftAutoPickStrategy(strategyRaw)) {
    redirectWithError(path, "Invalid auto-pick strategy.");
  }
  const result = await setOwnerFantasyDraftAutoPickStrategy(
    saveId,
    teamId,
    strategyRaw as FantasyDraftAutoPickStrategy,
  );
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function updateFantasyDraftSettingsAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const confirmPicks = String(formData.get("confirmPicks") ?? "") === "true";
  const path = fantasyDraftPath(saveId);
  const result = await updateOwnerFantasyDraftSettings(saveId, {
    confirmPicks,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  redirect(path);
}

export async function advanceFantasyDraftUntilNextPickAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const path = fantasyDraftPath(saveId);
  const result = await advanceFantasyDraftUntilNextPick(saveId);
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateFantasyDraft(saveId);
  if (result.draft?.status === "complete") {
    redirect(`${path}/summary`);
  }
  redirect(path);
}

export async function continueAfterFantasyDraftAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await continueAfterFantasyDraft(saveId);
  if (!result.ok) {
    redirectWithError(`${fantasyDraftPath(saveId)}/summary`, result.error);
  }
  revalidateOwner(saveId);
  redirect(`/dashboard/${saveId}`);
}

/** Client-callable detail fetch (no redirect). */
export async function fetchFantasyDraftPlayerDetailAction(
  saveId: string,
  playerId: string,
): Promise<FantasyDraftPlayerDetailView | null> {
  return loadFantasyDraftPlayerDetail(saveId, playerId);
}
