/**
 * Pure state transitions for local shared leagues (hotseat play).
 *
 * Simulation never reads any of this — it keys off user.ownedTeamIds. These
 * helpers only decide which participant owns which human team, who is acting,
 * and whether the league may advance.
 */

import type {
  LocalParticipant,
  LocalParticipantSetup,
  LocalSharedParticipation,
} from "@/domain/participation";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type ParticipationResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

export function getLocalParticipation(
  state: GameState,
): LocalSharedParticipation | null {
  const participation = state.user.participation;
  return participation.mode === "local_shared" ? participation : null;
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
): LocalSharedParticipation {
  const participants = setup.map(
    (entry, index): LocalParticipant => ({
      id: createParticipantId(),
      displayName: entry.displayName,
      teamIds: index === 0 ? [anchorTeamId] : [],
      plannedTeamCount: entry.teamCount,
      isHost: index === 0,
    }),
  );
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
  local: LocalSharedParticipation,
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
  return { ok: true, state: withLocal(state, { ...local, readyParticipantIds }) };
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

/** Clear ready flags after the league advances. No-op for single player. */
export function withReadyReset(state: GameState): GameState {
  const local = getLocalParticipation(state);
  if (!local || local.readyParticipantIds.length === 0) {
    return state;
  }
  return withLocal(state, { ...local, readyParticipantIds: [] });
}

/** Participants who still have to press Ready. Empty for single player. */
export function getWaitingParticipants(
  state: GameState,
): LocalParticipant[] {
  const local = getLocalParticipation(state);
  if (!local) {
    return [];
  }
  return local.participants.filter(
    (p) => !local.readyParticipantIds.includes(p.id),
  );
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Why the league may not advance yet, or null when it may. */
export function advanceBlockedReason(state: GameState): string | null {
  const local = getLocalParticipation(state);
  if (!local) {
    return null;
  }
  if (!local.assignmentsConfirmed) {
    return "Assign every participant's franchises before advancing.";
  }
  const waiting = getWaitingParticipants(state);
  if (waiting.length === 0) {
    return null;
  }
  return `Waiting on ${joinNames(waiting.map((p) => p.displayName))} to press Ready.`;
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
  if (assignments.get(anchorId) !== host.id) {
    return {
      ok: false,
      error: `${host.displayName} (host) must keep the initial franchise.`,
    };
  }
  const byParticipant = new Map<string, string[]>(
    local.participants.map((p) => [p.id, []]),
  );
  for (const teamId of state.user.ownedTeamIds) {
    const participantId = assignments.get(teamId);
    const bucket =
      participantId === undefined ? undefined : byParticipant.get(participantId);
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
