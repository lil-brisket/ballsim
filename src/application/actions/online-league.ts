"use server";

import { redirect } from "next/navigation";
import { onlineLeagueContext as context } from "@/application/online/context";
import {
  createLeagueInvite,
  joinLeagueWithInvite,
  leaveOnlineLeague,
  removeOnlineParticipant,
  revokeLeagueInvite,
  transferOnlineHost,
} from "@/application/game-service/online-league";
import {
  redirectWithError,
  revalidateOwner,
} from "@/application/actions/shared";

function membersPath(saveId: string): string {
  return `/dashboard/${saveId}/league-members`;
}

/**
 * Create an invite. Returns the one-time token to the caller (a client form)
 * instead of redirecting, because the link can only be shown once.
 */
export async function createLeagueInviteAction(
  saveId: string,
  options: { maxUses?: number; days?: number },
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const result = await createLeagueInvite(await context(), saveId, options);
  if (!result.ok) {
    return result;
  }
  revalidateOwner(saveId);
  return { ok: true, token: result.token };
}

export async function revokeLeagueInviteAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  const result = await revokeLeagueInvite(await context(), saveId, inviteId);
  if (!result.ok) {
    redirectWithError(membersPath(saveId), result.error);
  }
  revalidateOwner(saveId);
  redirect(membersPath(saveId));
}

export async function joinLeagueAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const ctx = await context();
  const joinPath = `/join/${encodeURIComponent(token)}`;
  if (!ctx.user) {
    redirect(`/login?next=${encodeURIComponent(joinPath)}`);
  }
  const result = await joinLeagueWithInvite(ctx, token, teamId);
  if (!result.ok) {
    redirectWithError(joinPath, result.error);
  }
  revalidateOwner(result.saveId);
  redirect(`/dashboard/${result.saveId}`);
}

export async function leaveOnlineLeagueAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await leaveOnlineLeague(await context(), saveId);
  if (!result.ok) {
    redirectWithError(membersPath(saveId), result.error);
  }
  redirect("/home");
}

export async function removeOnlineParticipantAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  const result = await removeOnlineParticipant(
    await context(),
    saveId,
    participantId,
  );
  if (!result.ok) {
    redirectWithError(membersPath(saveId), result.error);
  }
  revalidateOwner(saveId);
  redirect(membersPath(saveId));
}

export async function transferOnlineHostAction(
  formData: FormData,
): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  const result = await transferOnlineHost(
    await context(),
    saveId,
    participantId,
  );
  if (!result.ok) {
    redirectWithError(membersPath(saveId), result.error);
  }
  revalidateOwner(saveId);
  redirect(membersPath(saveId));
}
