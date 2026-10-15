/**
 * Online league membership: invites, joining, leaving, removal and host
 * transfer. Membership lives in GameState (participant.userId) and changes in
 * the same optimistic-concurrency write as team ownership. Invite tokens are
 * stored only as SHA-256 hashes.
 *
 * Every command takes the signed-in user explicitly and re-checks host /
 * membership itself — it never trusts client-provided participant ids for
 * permission.
 */

import type { AccountStore, LeagueInviteRecord } from "@/persistence/account-store";
import type { LoadedSaveGame, SaveGameStore } from "@/persistence/save-game-store";
import type { AccountUser } from "@/application/auth/accounts";
import { hashToken, newSecretToken } from "@/application/auth/credentials";
import { asTeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  isOwnedFranchise,
  withAddedOwnedFranchise,
  withRelinquishedOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions/enqueue-trade-offer";
import {
  type ParticipationResult,
  getParticipantForUser,
  getSharedParticipation,
  isOnlineLeague,
  withHostTransferred,
  withJoinedParticipant,
  withParticipantRemoved,
} from "@/systems/participation";
import { persistWorkingState } from "@/application/game-service/internal";

export const INVITE_DEFAULT_DAYS = 7;
export const INVITE_MAX_DAYS = 30;
export const INVITE_MAX_USES = 7;

export type OnlineLeagueContext = {
  user: AccountUser | null;
  /** Unscoped store: membership changes act on the raw league. */
  saves: SaveGameStore;
  accounts: AccountStore;
  now?: Date;
};

export type OnlineResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type InviteView = {
  id: string;
  createdOn: string;
  expiresAt: Date;
  revoked: boolean;
  maxUses: number;
  uses: number;
  usable: boolean;
};

type MemberAccess = {
  loaded: LoadedSaveGame;
  isHost: boolean;
  participantId: string;
};

async function loadAsMember(
  ctx: OnlineLeagueContext,
  saveId: string,
): Promise<OnlineResult<MemberAccess>> {
  if (!ctx.user) {
    return { ok: false, error: "Sign in to manage online leagues." };
  }
  const loaded = await ctx.saves.load(saveId);
  // Non-members get the same answer as a missing league.
  const participant = loaded
    ? getParticipantForUser(loaded.state, ctx.user.id)
    : null;
  if (!loaded || !isOnlineLeague(loaded.state) || !participant) {
    return { ok: false, error: "League not found." };
  }
  return {
    ok: true,
    loaded,
    isHost: participant.isHost,
    participantId: participant.id,
  };
}

async function loadAsHost(
  ctx: OnlineLeagueContext,
  saveId: string,
): Promise<OnlineResult<MemberAccess>> {
  const access = await loadAsMember(ctx, saveId);
  if (access.ok && !access.isHost) {
    return { ok: false, error: "Only the host can do that." };
  }
  return access;
}

async function commit(
  ctx: OnlineLeagueContext,
  loaded: LoadedSaveGame,
  next: GameState,
): Promise<OnlineResult> {
  try {
    await persistWorkingState(
      loaded.id,
      next,
      loaded.state.meta.rngState,
      ctx.saves,
      [],
      { ifUpdatedAt: loaded.updatedAt },
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function toInviteView(invite: LeagueInviteRecord, now: Date): InviteView {
  const revoked = invite.revokedAt !== null;
  return {
    id: invite.id,
    createdOn: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt,
    revoked,
    maxUses: invite.maxUses,
    uses: invite.uses,
    usable: !revoked && invite.expiresAt > now && invite.uses < invite.maxUses,
  };
}

// ---------------------------------------------------------------------------
// Invites (host only)
// ---------------------------------------------------------------------------

/** Create an invite link. The token is returned once and never stored. */
export async function createLeagueInvite(
  ctx: OnlineLeagueContext,
  saveId: string,
  options: { maxUses?: number; days?: number } = {},
): Promise<OnlineResult<{ token: string; invite: InviteView }>> {
  const access = await loadAsHost(ctx, saveId);
  if (!access.ok) {
    return access;
  }
  const maxUses = Math.trunc(options.maxUses ?? 1);
  const days = Math.trunc(options.days ?? INVITE_DEFAULT_DAYS);
  if (maxUses < 1 || maxUses > INVITE_MAX_USES) {
    return {
      ok: false,
      error: `An invite can be used 1–${INVITE_MAX_USES} times.`,
    };
  }
  if (days < 1 || days > INVITE_MAX_DAYS) {
    return {
      ok: false,
      error: `Invites can last 1–${INVITE_MAX_DAYS} days.`,
    };
  }
  const now = ctx.now ?? new Date();
  const token = newSecretToken();
  const invite = await ctx.accounts.createInvite({
    id: crypto.randomUUID(),
    saveGameId: saveId,
    tokenHash: hashToken(token),
    createdByUserId: ctx.user!.id,
    expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
    maxUses,
  });
  return { ok: true, token, invite: toInviteView(invite, now) };
}

export async function listLeagueInvites(
  ctx: OnlineLeagueContext,
  saveId: string,
): Promise<OnlineResult<{ invites: InviteView[] }>> {
  const access = await loadAsHost(ctx, saveId);
  if (!access.ok) {
    return access;
  }
  const now = ctx.now ?? new Date();
  const invites = await ctx.accounts.listInvites(saveId);
  return { ok: true, invites: invites.map((i) => toInviteView(i, now)) };
}

export async function revokeLeagueInvite(
  ctx: OnlineLeagueContext,
  saveId: string,
  inviteId: string,
): Promise<OnlineResult> {
  const access = await loadAsHost(ctx, saveId);
  if (!access.ok) {
    return access;
  }
  const revoked = await ctx.accounts.revokeInvite(
    inviteId,
    saveId,
    ctx.now ?? new Date(),
  );
  return revoked ? { ok: true } : { ok: false, error: "Invite not found." };
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

export type InvitePreview = {
  saveId: string;
  leagueName: string;
  hostName: string;
  playerCount: number;
  alreadyMember: boolean;
  /** AI-controlled franchises a new member may take over. */
  openTeams: Array<{ id: string; city: string; name: string }>;
};

async function findUsableInvite(
  ctx: OnlineLeagueContext,
  token: string,
): Promise<LeagueInviteRecord | null> {
  const invite = await ctx.accounts.findInviteByTokenHash(hashToken(token));
  const now = ctx.now ?? new Date();
  if (
    !invite ||
    invite.revokedAt !== null ||
    invite.expiresAt <= now ||
    invite.uses >= invite.maxUses
  ) {
    return null;
  }
  return invite;
}

const INVITE_INVALID = "This invite link is invalid or has expired.";

/** What the invite page shows. Does not require being signed in. */
export async function previewLeagueInvite(
  ctx: OnlineLeagueContext,
  token: string,
): Promise<OnlineResult<{ preview: InvitePreview }>> {
  const invite = await findUsableInvite(ctx, token);
  const loaded = invite ? await ctx.saves.load(invite.saveGameId) : null;
  const shared = loaded ? getSharedParticipation(loaded.state) : null;
  if (!invite || !loaded || !shared || shared.mode !== "online") {
    return { ok: false, error: INVITE_INVALID };
  }
  const state = loaded.state;
  const host = shared.participants.find((p) => p.isHost)!;
  const openTeams = Object.values(state.world.teams)
    .filter((team) => !isOwnedFranchise(state, team.id))
    .map((team) => ({ id: team.id, city: team.city, name: team.name }))
    .sort((a, b) => `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`));
  return {
    ok: true,
    preview: {
      saveId: loaded.id,
      leagueName: loaded.name,
      hostName: host.displayName,
      playerCount: shared.participants.length,
      alreadyMember: ctx.user
        ? shared.participants.some((p) => p.userId === ctx.user!.id)
        : false,
      openTeams,
    },
  };
}

/** Join with an invite, taking over one AI-controlled franchise. */
export async function joinLeagueWithInvite(
  ctx: OnlineLeagueContext,
  token: string,
  teamIdRaw: string,
): Promise<OnlineResult<{ saveId: string }>> {
  if (!ctx.user) {
    return { ok: false, error: "Sign in to join this league." };
  }
  const invite = await findUsableInvite(ctx, token);
  if (!invite) {
    return { ok: false, error: INVITE_INVALID };
  }
  const now = ctx.now ?? new Date();
  // Take the invite use first so two people cannot both use the last seat;
  // give it back if the join itself fails.
  if (!(await ctx.accounts.consumeInvite(invite.id, now))) {
    return { ok: false, error: INVITE_INVALID };
  }
  const result = await applyJoin(ctx, invite.saveGameId, teamIdRaw);
  if (!result.ok) {
    await ctx.accounts.releaseInvite(invite.id);
    return result;
  }
  return { ok: true, saveId: invite.saveGameId };
}

async function applyJoin(
  ctx: OnlineLeagueContext,
  saveId: string,
  teamIdRaw: string,
): Promise<OnlineResult> {
  const loaded = await ctx.saves.load(saveId);
  if (!loaded || !isOnlineLeague(loaded.state)) {
    return { ok: false, error: INVITE_INVALID };
  }
  const state = loaded.state;
  const teamId = asTeamId(teamIdRaw);
  if (!state.world.teams[teamId]) {
    return { ok: false, error: "Choose a franchise to manage." };
  }
  if (isOwnedFranchise(state, teamId)) {
    return { ok: false, error: "That franchise already has a manager." };
  }
  const draftStatus = state.world.fantasyDraft?.status;
  if (draftStatus === "active" || draftStatus === "paused") {
    return {
      ok: false,
      error: "Wait for the fantasy draft to finish before joining.",
    };
  }
  const joined = withJoinedParticipant(
    state,
    { userId: ctx.user!.id, displayName: ctx.user!.username },
    teamId,
    () => crypto.randomUUID(),
  );
  if (!joined.ok) {
    return joined;
  }
  const franchise = createDefaultOwnedFranchiseState({
    seasonYear: state.competition.season.year,
    currentDate: state.world.calendar.currentDate,
    citySelectionConfirmed: true,
    franchiseIdentityConfirmed: true,
    aiAssistance: { ...state.settings.ai.assistance },
    managementPreset: state.settings.ai.managementPreset,
  });
  const withTeam = withAddedOwnedFranchise(joined.state, teamId, franchise);
  return commit(ctx, loaded, withTeam);
}

// ---------------------------------------------------------------------------
// Leaving, removal, host transfer
// ---------------------------------------------------------------------------

/**
 * Remove a participant: their franchises return to AI control and any open
 * decisions about those franchises expire (a stale blocking CPU offer for an
 * AI team would otherwise freeze the league).
 */
function withParticipantGone(
  state: GameState,
  participantId: string,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  const leaving = shared?.participants.find((p) => p.id === participantId);
  if (!shared || !leaving) {
    return { ok: false, error: "Unknown participant." };
  }
  if (leaving.isHost) {
    return {
      ok: false,
      error: "Transfer host to another player before the host leaves.",
    };
  }
  const gone = new Set<string>(leaving.teamIds);
  let working = state;
  for (const decision of state.user.pendingOwnerDecisions) {
    if (
      gone.has(decision.payload.userTeamId) ||
      gone.has(decision.payload.offeringTeamId)
    ) {
      working = resolvePendingOwnerDecision(working, {
        decisionId: decision.id,
        status: "expired",
        decisionSource: "system",
      }).state;
    }
  }
  for (const teamId of leaving.teamIds) {
    working = withRelinquishedOwnedFranchise(working, asTeamId(teamId));
    const { [teamId]: _dropped, ...phaseState } =
      working.user.franchisePhaseState;
    working = {
      ...working,
      user: { ...working.user, franchisePhaseState: phaseState },
    };
  }
  return withParticipantRemoved(working, participantId);
}

export async function leaveOnlineLeague(
  ctx: OnlineLeagueContext,
  saveId: string,
): Promise<OnlineResult> {
  const access = await loadAsMember(ctx, saveId);
  if (!access.ok) {
    return access;
  }
  if (access.isHost) {
    return {
      ok: false,
      error:
        "Make another player host before leaving, or delete the league if you are the only player.",
    };
  }
  const next = withParticipantGone(access.loaded.state, access.participantId);
  if (!next.ok) {
    return next;
  }
  return commit(ctx, access.loaded, next.state);
}

export async function removeOnlineParticipant(
  ctx: OnlineLeagueContext,
  saveId: string,
  participantId: string,
): Promise<OnlineResult> {
  const access = await loadAsHost(ctx, saveId);
  if (!access.ok) {
    return access;
  }
  if (participantId === access.participantId) {
    return { ok: false, error: "Use Leave league to remove yourself." };
  }
  const next = withParticipantGone(access.loaded.state, participantId);
  if (!next.ok) {
    return next;
  }
  return commit(ctx, access.loaded, next.state);
}

export async function transferOnlineHost(
  ctx: OnlineLeagueContext,
  saveId: string,
  participantId: string,
): Promise<OnlineResult> {
  const access = await loadAsHost(ctx, saveId);
  if (!access.ok) {
    return access;
  }
  if (participantId === access.participantId) {
    return { ok: true };
  }
  const next = withHostTransferred(access.loaded.state, participantId);
  if (!next.ok) {
    return next;
  }
  return commit(ctx, access.loaded, next.state);
}
