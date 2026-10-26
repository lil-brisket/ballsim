/**
 * Pure state transitions for shared leagues: local (hotseat) and online.
 *
 * Simulation never reads any of this — it keys off user.ownedTeamIds. These
 * helpers only decide which participant owns which human team, who is acting,
 * and whether the league may advance.
 */

import { applyPreset } from "@/domain/ai-management-presets";
import {
  MAX_APPROVAL_WINDOW_HOURS,
  MAX_AUTO_MANAGE_AFTER_DAYS,
  MAX_ONLINE_PARTICIPANTS,
  type AutoManageReason,
  type LocalParticipant,
  type LocalParticipantSetup,
  type SharedParticipation,
} from "@/domain/participation";
import { asTeamId, type TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isOwnedFranchise, withOwnedFranchise } from "@/state/owner-context";

export type ParticipationResult =
  { ok: true; state: GameState } | { ok: false; error: string };

/** Participation for local shared or online leagues; null for single player. */
export function getSharedParticipation(
  state: GameState,
): SharedParticipation | null {
  const participation = state.user.participation;
  return participation.mode === "single" ? null : participation;
}

/** @deprecated Prefer {@link getSharedParticipation}. */
export const getLocalParticipation = getSharedParticipation;

export function isOnlineLeague(state: GameState): boolean {
  return state.user.participation.mode === "online";
}

export function getActiveParticipant(
  state: GameState,
): LocalParticipant | null {
  const local = getLocalParticipation(state);
  if (!local) {
    return null;
  }
  return (
    local.participants.find((p) => p.id === local.activeParticipantId) ?? null
  );
}

export function getParticipantForTeam(
  state: GameState,
  teamId: string,
): LocalParticipant | null {
  const local = getLocalParticipation(state);
  if (!local) {
    return null;
  }
  return local.participants.find((p) => p.teamIds.includes(teamId)) ?? null;
}

/**
 * Error when the acting participant may not act for `teamId`; null when allowed.
 * Single-player saves only require the team to be owned.
 */
export function participantTeamAccessError(
  state: GameState,
  teamId: string,
): string | null {
  if (!state.user.ownedTeamIds.includes(teamId as TeamId)) {
    return "That franchise is not human-controlled.";
  }
  const active = getActiveParticipant(state);
  if (!active || active.teamIds.includes(teamId)) {
    return null;
  }
  const owner = getParticipantForTeam(state, teamId);
  return owner
    ? `That franchise belongs to ${owner.displayName}. Switch to ${owner.displayName} first.`
    : "That franchise is not assigned to a participant yet.";
}

/**
 * True when `teamId` is controlled by a participant other than the active one.
 * Always false in single-player saves.
 */
export function isOtherParticipantTeam(
  state: GameState,
  teamId: string,
): boolean {
  const owner = getParticipantForTeam(state, teamId);
  return owner !== null && owner.id !== getActiveParticipant(state)?.id;
}

/** Build onboarding participation: the host holds the anchor team only. */
export function createLocalSharedParticipation(
  setup: readonly LocalParticipantSetup[],
  anchorTeamId: string,
  createParticipantId: () => string,
): SharedParticipation {
  const participants = setup.map((entry, index): LocalParticipant => ({
    id: createParticipantId(),
    displayName: entry.displayName,
    teamIds: index === 0 ? [anchorTeamId] : [],
    plannedTeamCount: entry.teamCount,
    isHost: index === 0,
  }));
  return {
    mode: "local_shared",
    participants,
    activeParticipantId: participants[0]!.id,
    readyParticipantIds: [],
    assignmentsConfirmed: false,
  };
}

function withLocal(
  state: GameState,
  local: SharedParticipation,
  activeOwnerTeamId: TeamId = state.user.activeOwnerTeamId,
): GameState {
  return {
    ...state,
    user: { ...state.user, activeOwnerTeamId, participation: local },
  };
}

/** Hand the device to another participant and act as their first franchise. */
export function withActiveParticipant(
  state: GameState,
  participantId: string,
): ParticipationResult {
  const local = getLocalParticipation(state);
  if (!local) {
    return { ok: false, error: "This league has a single player." };
  }
  if (local.mode === "online") {
    return {
      ok: false,
      error: "In online leagues each player signs in on their own device.",
    };
  }
  const next = local.participants.find((p) => p.id === participantId);
  if (!next) {
    return { ok: false, error: "Unknown participant." };
  }
  if (next.teamIds.length === 0) {
    return {
      ok: false,
      error: `${next.displayName} has no franchises assigned yet.`,
    };
  }
  if (local.activeParticipantId === participantId) {
    return { ok: true, state };
  }
  const activeTeam = next.teamIds.includes(state.user.activeOwnerTeamId)
    ? state.user.activeOwnerTeamId
    : (next.teamIds[0] as TeamId);
  return {
    ok: true,
    state: withLocal(
      state,
      { ...local, activeParticipantId: participantId },
      activeTeam,
    ),
  };
}

/** Mark the active participant ready (or not) for the next advance. */
export function withActiveParticipantReady(
  state: GameState,
  ready: boolean,
): ParticipationResult {
  const local = getLocalParticipation(state);
  if (!local) {
    return { ok: false, error: "This league has a single player." };
  }
  const id = local.activeParticipantId;
  const others = local.readyParticipantIds.filter((entry) => entry !== id);
  const readyParticipantIds = ready
    ? local.participants
        .map((p) => p.id)
        .filter((pid) => pid === id || others.includes(pid))
    : others;
  return {
    ok: true,
    state: withLocal(state, { ...local, readyParticipantIds }),
  };
}

/** Host override: mark every participant ready so the league can advance. */
export function withAllParticipantsReady(
  state: GameState,
): ParticipationResult {
  const local = getLocalParticipation(state);
  if (!local) {
    return { ok: false, error: "This league has a single player." };
  }
  if (!getActiveParticipant(state)?.isHost) {
    return {
      ok: false,
      error: "Only the host can advance for everyone.",
    };
  }
  return {
    ok: true,
    state: withLocal(state, {
      ...local,
      readyParticipantIds: local.participants.map((p) => p.id),
    }),
  };
}

/**
 * Clear ready flags (and close any approval window) after the league
 * advances. No-op for single player.
 */
export function withReadyReset(state: GameState): GameState {
  const local = getLocalParticipation(state);
  if (
    !local ||
    (local.readyParticipantIds.length === 0 &&
      local.approvalWindow === undefined)
  ) {
    return state;
  }
  const { approvalWindow: _closed, ...rest } = local;
  return withLocal(state, { ...rest, readyParticipantIds: [] });
}

/**
 * Participants who still have to press Ready. Auto-managed members never
 * hold the league up. Empty for single player.
 */
export function getWaitingParticipants(state: GameState): LocalParticipant[] {
  const local = getLocalParticipation(state);
  if (!local) {
    return [];
  }
  return local.participants.filter(
    (p) =>
      p.autoManaged === undefined && !local.readyParticipantIds.includes(p.id),
  );
}

/** True once an online league's approval window has closed. */
export function isApprovalWindowClosed(state: GameState, now: Date): boolean {
  const window = getSharedParticipation(state)?.approvalWindow;
  return window !== undefined && now.getTime() >= Date.parse(window.closesAt);
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Why the league may not advance yet, or null when it may. Online leagues
 * are advanced by the commissioner (host) only; members who missed a closed
 * approval window or sat idle past the threshold no longer block.
 */
export function advanceBlockedReason(
  state: GameState,
  now: Date = new Date(),
): string | null {
  const local = getLocalParticipation(state);
  if (!local) {
    return null;
  }
  if (!local.assignmentsConfirmed) {
    return "Assign every participant's franchises before advancing.";
  }
  if (local.mode === "online" && !getActiveParticipant(state)?.isHost) {
    const host = local.participants.find((p) => p.isHost);
    return `Only the commissioner${host ? ` (${host.displayName})` : ""} can advance the league.`;
  }
  // Members due for auto-management are handed to the AI by the advance
  // itself, and the commissioner approves by advancing.
  const due = new Set(
    getParticipantsDueForAutoManage(state, now).map((d) => d.participant.id),
  );
  const waiting = getWaitingParticipants(state).filter(
    (p) => !due.has(p.id) && !(local.mode === "online" && p.isHost),
  );
  if (waiting.length === 0) {
    return null;
  }
  const names = joinNames(waiting.map((p) => p.displayName));
  return local.approvalWindow
    ? `Waiting on ${names} to approve before the approval window closes.`
    : `Waiting on ${names} to press Ready.`;
}

/**
 * Apply onboarding franchise assignments. `assignments` maps every owned team
 * to a participant id; counts must match each participant's plan, and the
 * anchor stays with the host. The host becomes the active participant.
 */
export function withConfirmedAssignments(
  state: GameState,
  assignments: ReadonlyMap<string, string>,
): ParticipationResult {
  const local = getLocalParticipation(state);
  if (!local) {
    return { ok: true, state };
  }
  const host = local.participants.find((p) => p.isHost)!;
  const anchorId = state.user.activeOwnerTeamId;
  // Online onboarding: the host is the only participant yet, so unassigned
  // teams default to them.
  const ownerOf = (teamId: string) =>
    assignments.get(teamId) ?? (local.mode === "online" ? host.id : undefined);
  if (ownerOf(anchorId) !== host.id) {
    return {
      ok: false,
      error: `${host.displayName} (host) must keep the initial franchise.`,
    };
  }
  const byParticipant = new Map<string, string[]>(
    local.participants.map((p) => [p.id, []]),
  );
  for (const teamId of state.user.ownedTeamIds) {
    const participantId = ownerOf(teamId);
    const bucket =
      participantId === undefined
        ? undefined
        : byParticipant.get(participantId);
    if (!bucket) {
      return {
        ok: false,
        error: "Every selected franchise needs a participant.",
      };
    }
    bucket.push(teamId);
  }
  for (const p of local.participants) {
    const count = byParticipant.get(p.id)!.length;
    if (count !== p.plannedTeamCount) {
      return {
        ok: false,
        error: `${p.displayName} must manage ${p.plannedTeamCount} franchise${p.plannedTeamCount === 1 ? "" : "s"} (${count} assigned).`,
      };
    }
  }
  return {
    ok: true,
    state: withLocal(
      state,
      {
        ...local,
        participants: local.participants.map((p) => ({
          ...p,
          teamIds: byParticipant.get(p.id)!,
        })),
        activeParticipantId: host.id,
        readyParticipantIds: [],
        assignmentsConfirmed: true,
      },
      anchorId,
    ),
  };
}

/** Pre-season anchor swap: the host's only team becomes `teamId`. */
export function withHostAnchorTeam(
  state: GameState,
  teamId: string,
): ParticipationResult {
  const local = getLocalParticipation(state);
  if (!local) {
    return { ok: true, state };
  }
  if (local.assignmentsConfirmed) {
    return {
      ok: false,
      error: "Team selection is locked once franchises are assigned.",
    };
  }
  return {
    ok: true,
    state: withLocal(state, {
      ...local,
      participants: local.participants.map((p) => ({
        ...p,
        teamIds: p.isHost ? [teamId] : [],
      })),
    }),
  };
}

/** Mid-career takeover: the new franchise joins the active participant. */
export function withTeamAddedToActiveParticipant(
  state: GameState,
  teamId: string,
): GameState {
  const local = getLocalParticipation(state);
  if (!local) {
    return state;
  }
  return withLocal(state, {
    ...local,
    participants: local.participants.map((p) =>
      p.id === local.activeParticipantId
        ? {
            ...p,
            teamIds: [...p.teamIds, teamId],
            plannedTeamCount: p.plannedTeamCount + 1,
          }
        : p,
    ),
  });
}

// ---------------------------------------------------------------------------
// Online leagues
// ---------------------------------------------------------------------------

export type OnlineMember = { userId: string; displayName: string };

/** Build onboarding participation for a new online league (host only). */
export function createOnlineParticipation(
  host: OnlineMember,
  anchorTeamId: string,
  plannedTeamCount: number,
  createParticipantId: () => string,
): SharedParticipation {
  const id = createParticipantId();
  return {
    mode: "online",
    participants: [
      {
        id,
        displayName: host.displayName,
        teamIds: [anchorTeamId],
        plannedTeamCount,
        isHost: true,
        userId: host.userId,
      },
    ],
    activeParticipantId: id,
    readyParticipantIds: [],
    assignmentsConfirmed: false,
  };
}

export function getParticipantForUser(
  state: GameState,
  userId: string,
): LocalParticipant | null {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return null;
  }
  return shared.participants.find((p) => p.userId === userId) ?? null;
}

/**
 * Per-request view of an online league as the signed-in user: they become
 * the active participant, acting as their remembered (or first) franchise.
 * Null when the user is not a member.
 */
export function withActingUser(
  state: GameState,
  userId: string,
): GameState | null {
  const shared = getSharedParticipation(state);
  const participant = getParticipantForUser(state, userId);
  if (!shared || !participant) {
    return null;
  }
  const team =
    participant.activeTeamId !== undefined &&
    participant.teamIds.includes(participant.activeTeamId)
      ? participant.activeTeamId
      : participant.teamIds[0];
  if (team === undefined) {
    return null;
  }
  return withLocal(
    state,
    { ...shared, activeParticipantId: participant.id },
    team as TeamId,
  );
}

/**
 * Online leagues: remember the acting participant's current franchise so the
 * next request (which re-derives the active team) lands on it again.
 */
export function withActiveTeamRemembered(state: GameState): GameState {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return state;
  }
  const activeTeam = state.user.activeOwnerTeamId;
  let changed = false;
  const participants = shared.participants.map((p) => {
    if (
      p.id !== shared.activeParticipantId ||
      !p.teamIds.includes(activeTeam) ||
      p.activeTeamId === activeTeam
    ) {
      return p;
    }
    changed = true;
    return { ...p, activeTeamId: activeTeam };
  });
  return changed ? withLocal(state, { ...shared, participants }) : state;
}

/**
 * Add a newly joined member who takes over `teamId` (an AI-controlled team).
 * The caller adds the franchise to ownedTeamIds in the same transition.
 */
export function withJoinedParticipant(
  state: GameState,
  member: OnlineMember,
  teamId: string,
  createParticipantId: () => string,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return { ok: false, error: "This is not an online league." };
  }
  if (!shared.assignmentsConfirmed) {
    return {
      ok: false,
      error: "The host is still setting up this league. Try again later.",
    };
  }
  if (shared.participants.some((p) => p.userId === member.userId)) {
    return { ok: false, error: "You are already in this league." };
  }
  if (shared.participants.length >= MAX_ONLINE_PARTICIPANTS) {
    return { ok: false, error: "This league is full." };
  }
  if (getParticipantForTeam(state, teamId)) {
    return { ok: false, error: "That franchise already has a manager." };
  }
  return {
    ok: true,
    state: withLocal(state, {
      ...shared,
      participants: [
        ...shared.participants,
        {
          id: createParticipantId(),
          displayName: member.displayName,
          teamIds: [teamId],
          plannedTeamCount: 1,
          isHost: false,
          userId: member.userId,
        },
      ],
    }),
  };
}

/**
 * Remove a participant from the participation record. Their teams must
 * already be relinquished to the AI (removed from ownedTeamIds) by the caller.
 * If the active participant leaves, the host becomes active.
 */
export function withParticipantRemoved(
  state: GameState,
  participantId: string,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  if (!shared) {
    return { ok: false, error: "This league has a single player." };
  }
  const leaving = shared.participants.find((p) => p.id === participantId);
  if (!leaving) {
    return { ok: false, error: "Unknown participant." };
  }
  if (leaving.isHost) {
    return {
      ok: false,
      error: "Transfer host to another player before the host leaves.",
    };
  }
  const participants = shared.participants.filter(
    (p) => p.id !== participantId,
  );
  const host = participants.find((p) => p.isHost)!;
  const activeParticipantId =
    shared.activeParticipantId === participantId
      ? host.id
      : shared.activeParticipantId;
  const activeOwner = participants.find((p) => p.id === activeParticipantId)!;
  const activeTeam = activeOwner.teamIds.includes(state.user.activeOwnerTeamId)
    ? state.user.activeOwnerTeamId
    : (activeOwner.teamIds[0] as TeamId);
  return {
    ok: true,
    state: withLocal(
      state,
      {
        ...shared,
        participants,
        activeParticipantId,
        readyParticipantIds: shared.readyParticipantIds.filter(
          (id) => id !== participantId,
        ),
      },
      activeTeam,
    ),
  };
}

/** Make `participantId` the host (the previous host becomes a member). */
export function withHostTransferred(
  state: GameState,
  participantId: string,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  if (!shared) {
    return { ok: false, error: "This league has a single player." };
  }
  if (!shared.participants.some((p) => p.id === participantId)) {
    return { ok: false, error: "Unknown participant." };
  }
  return {
    ok: true,
    state: withLocal(state, {
      ...shared,
      participants: shared.participants.map((p) => ({
        ...p,
        isHost: p.id === participantId,
      })),
    }),
  };
}

/**
 * Teams whose private data (inbox, notifications, phase tasks) the acting
 * person may see: the active participant's teams in shared leagues, every
 * owned team in single player.
 */
export function getActorTeamIds(state: GameState): readonly TeamId[] {
  const active = getActiveParticipant(state);
  if (!active) {
    return state.user.ownedTeamIds;
  }
  return state.user.ownedTeamIds.filter((id) => active.teamIds.includes(id));
}

// ---------------------------------------------------------------------------
// Online leagues: activity, approval windows and auto-management
// ---------------------------------------------------------------------------

function withOnlineParticipants(
  state: GameState,
  update: (p: LocalParticipant) => LocalParticipant,
): GameState {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return state;
  }
  return withLocal(state, {
    ...shared,
    participants: shared.participants.map(update),
  });
}

/** Online leagues: stamp a member's last activity. */
export function withParticipantSeen(
  state: GameState,
  participantId: string,
  now: Date,
): GameState {
  return withOnlineParticipants(state, (p) =>
    p.id === participantId ? { ...p, lastActiveAt: now.toISOString() } : p,
  );
}

/** Online leagues: stamp the acting participant's last activity. */
export function withActingParticipantSeen(
  state: GameState,
  now: Date,
): GameState {
  const shared = getSharedParticipation(state);
  return shared
    ? withParticipantSeen(state, shared.activeParticipantId, now)
    : state;
}

/** Open (or replace) the approval window for the next advance. */
export function withApprovalWindow(
  state: GameState,
  hours: number,
  now: Date,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return { ok: false, error: "This is not an online league." };
  }
  if (
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > MAX_APPROVAL_WINDOW_HOURS
  ) {
    return {
      ok: false,
      error: `Approval windows last 1–${MAX_APPROVAL_WINDOW_HOURS} hours.`,
    };
  }
  const closesAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
  return {
    ok: true,
    state: withLocal(state, {
      ...shared,
      approvalWindow: {
        openedAt: now.toISOString(),
        closesAt: closesAt.toISOString(),
      },
    }),
  };
}

/** Close the approval window without advancing. */
export function withApprovalWindowCancelled(state: GameState): GameState {
  const shared = getSharedParticipation(state);
  if (!shared || shared.approvalWindow === undefined) {
    return state;
  }
  const { approvalWindow: _closed, ...rest } = shared;
  return withLocal(state, rest);
}

/** Set (or clear with null) the idle days before a member is auto-managed. */
export function withAutoManageAfterDays(
  state: GameState,
  days: number | null,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return { ok: false, error: "This is not an online league." };
  }
  const { autoManageAfterDays: _previous, ...rest } = shared;
  if (days === null) {
    return { ok: true, state: withLocal(state, rest) };
  }
  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > MAX_AUTO_MANAGE_AFTER_DAYS
  ) {
    return {
      ok: false,
      error: `Choose 1–${MAX_AUTO_MANAGE_AFTER_DAYS} days, or turn it off.`,
    };
  }
  return {
    ok: true,
    state: withLocal(state, { ...rest, autoManageAfterDays: days }),
  };
}

/**
 * Hand a member's franchises to the AI (Full Management), keeping their own
 * settings to restore later. The commissioner is never auto-managed: they
 * run the league.
 */
export function withParticipantAutoManaged(
  state: GameState,
  participantId: string,
  reason: AutoManageReason,
  now: Date,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return { ok: false, error: "This is not an online league." };
  }
  const participant = shared.participants.find((p) => p.id === participantId);
  if (!participant) {
    return { ok: false, error: "Unknown participant." };
  }
  if (participant.isHost) {
    return {
      ok: false,
      error: "The commissioner's teams cannot be auto-managed.",
    };
  }
  if (participant.autoManaged) {
    return { ok: true, state };
  }
  let working = state;
  const restore = participant.teamIds
    .map(asTeamId)
    .filter((teamId) => isOwnedFranchise(working, teamId))
    .map((teamId) => {
      const franchise = working.user.ownedFranchises[teamId]!;
      working = withOwnedFranchise(working, teamId, (f) => ({
        ...f,
        managementPreset: "full_management",
        aiAssistance: applyPreset("full_management"),
      }));
      return {
        teamId: teamId as string,
        managementPreset: franchise.managementPreset,
        aiAssistance: { ...franchise.aiAssistance },
      };
    });
  return {
    ok: true,
    state: withOnlineParticipants(working, (p) =>
      p.id === participantId
        ? { ...p, autoManaged: { since: now.toISOString(), reason, restore } }
        : p,
    ),
  };
}

/** Give a member their franchises back with the settings they had. */
export function withParticipantControlRestored(
  state: GameState,
  participantId: string,
): ParticipationResult {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return { ok: false, error: "This is not an online league." };
  }
  const participant = shared.participants.find((p) => p.id === participantId);
  if (!participant) {
    return { ok: false, error: "Unknown participant." };
  }
  if (!participant.autoManaged) {
    return { ok: true, state };
  }
  let working = state;
  for (const entry of participant.autoManaged.restore) {
    const teamId = asTeamId(entry.teamId);
    if (!isOwnedFranchise(working, teamId)) {
      continue;
    }
    working = withOwnedFranchise(working, teamId, (f) => ({
      ...f,
      managementPreset: entry.managementPreset,
      aiAssistance: { ...entry.aiAssistance },
    }));
  }
  return {
    ok: true,
    state: withOnlineParticipants(working, (p) => {
      if (p.id !== participantId) {
        return p;
      }
      const { autoManaged: _done, ...rest } = p;
      return rest;
    }),
  };
}

export type AutoManageCandidate = {
  participant: LocalParticipant;
  reason: AutoManageReason;
};

/**
 * Members the AI should take over before the commissioner advances: those
 * who missed a closed approval window, and those idle past the league's
 * auto-manage threshold. Members with no recorded activity are not idle.
 */
export function getParticipantsDueForAutoManage(
  state: GameState,
  now: Date,
): AutoManageCandidate[] {
  const shared = getSharedParticipation(state);
  if (!shared || shared.mode !== "online") {
    return [];
  }
  const windowClosed = isApprovalWindowClosed(state, now);
  const idleMs =
    shared.autoManageAfterDays !== undefined
      ? shared.autoManageAfterDays * 24 * 60 * 60 * 1000
      : null;
  const due: AutoManageCandidate[] = [];
  for (const p of shared.participants) {
    if (p.isHost || p.autoManaged) {
      continue;
    }
    if (windowClosed && !shared.readyParticipantIds.includes(p.id)) {
      due.push({ participant: p, reason: "missed_approval" });
    } else if (
      idleMs !== null &&
      p.lastActiveAt !== undefined &&
      now.getTime() - Date.parse(p.lastActiveAt) >= idleMs
    ) {
      due.push({ participant: p, reason: "inactive" });
    }
  }
  return due;
}

/** Owned teams the AI currently runs for away members. */
export function getAutoManagedTeamIds(state: GameState): Set<string> {
  const shared = getSharedParticipation(state);
  return new Set(
    shared?.participants.flatMap((p) => (p.autoManaged ? p.teamIds : [])) ?? [],
  );
}
