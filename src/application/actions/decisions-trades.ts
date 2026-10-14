"use server";

import {
  acceptOwnerDecision,
  declineOwnerDecision,
  delegateOwnerDecisionToAi,
  resolveCalendarTradeInterrupt,
  submitTradeCounteroffer,
  calendarHrefAfterOwnerMutation,
  executeOwnerTrade,
  setOwnerPlayerTradeBlock,
  listOwnerTradeCandidates,
} from "@/application/game-service";
import { redirect } from "next/navigation";
import {
  type TradeProposal,
  parseTradeProposal,
} from "@/domain/entities/trade-proposal";
import {
  returnPath,
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

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

export async function resolveCalendarTradeInterruptAction(
  saveId: string,
  decisionId: string,
  mode: "accept" | "decline" | "let_ai_decide",
  resumeTo: string | null,
): Promise<
  import("@/application/game-service").ResolveCalendarInterruptResult
> {
  const result = await resolveCalendarTradeInterrupt(
    saveId,
    decisionId,
    mode,
    resumeTo,
  );
  if (result.ok) {
    revalidateOwner(saveId);
  }
  return result;
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
  const resumeToRaw = String(formData.get("resumeTo") ?? "");
  const calendarHref = await calendarHrefAfterOwnerMutation(
    saveId,
    resumeToRaw || null,
    { autoResumeIfClear: true },
  );
  redirect(calendarHref ?? path);
}

export async function executeTradeAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const outgoingPlayerId = String(formData.get("outgoingPlayerId") ?? "");
  const path = returnPath(formData, saveId);
  const proposalJson = String(formData.get("proposalJson") ?? "").trim();
  let proposal: TradeProposal | undefined;
  if (proposalJson.length > 0) {
    const parsed = parseTradeProposal(proposalJson);
    if (parsed === null) {
      redirectWithError(path, "Invalid trade proposal.");
    }
    proposal = parsed;
  }
  const result = await executeOwnerTrade(saveId, {
    outgoingPlayerId,
    proposal,
  });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

export async function toggleTradeBlockAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const listedRaw = String(formData.get("listed") ?? "");
  const listed = listedRaw === "true" || listedRaw === "1";
  const path = returnPath(formData, saveId);
  const result = await setOwnerPlayerTradeBlock(saveId, { playerId, listed });
  if (!result.ok) {
    redirectWithError(path, result.error);
  }
  revalidateOwner(saveId);
  redirect(path);
}

/** Client-callable Trade Finder search (no redirect). Lazy — not used on roster page load. */
export async function listTradeCandidatesAction(
  saveId: string,
  outgoingPlayerId: string,
): Promise<
  | {
      ok: true;
      candidates: import("@/state/roster-page-selectors").TradeFinderRowView[];
    }
  | { ok: false; error: string }
> {
  const result = await listOwnerTradeCandidates(saveId, outgoingPlayerId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, candidates: result.candidates };
}
