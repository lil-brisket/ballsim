/**
 * League participation: who among the humans controls which franchises.
 *
 * Invariant: the union of all participants' teamIds equals
 * GameState.user.ownedTeamIds. Simulation and AI keep keying off
 * ownedTeamIds only — participation never changes what the AI may touch,
 * it only decides which person a human-controlled team belongs to.
 *
 * Participant ids are the identity; display names are labels only and are
 * never used for permission checks.
 */

export type ParticipationMode = "single" | "local_shared";

export const PARTICIPATION_MODES: readonly ParticipationMode[] = [
  "single",
  "local_shared",
];

export const MIN_LOCAL_PARTICIPANTS = 2;
export const MAX_LOCAL_PARTICIPANTS = 4;
export const PARTICIPANT_NAME_MAX_LENGTH = 24;

/**
 * Local shared leagues are modeled and validated but not playable until
 * per-participant assignment and ready-gated advancement ship.
 */
export const LOCAL_SHARED_LEAGUE_AVAILABLE = false;

export type LocalParticipant = {
  /** Stable generated id — the identity used for every ownership check. */
  id: string;
  displayName: string;
  /** Subset of user.ownedTeamIds; disjoint across participants. */
  teamIds: string[];
  isHost: boolean;
};

export type ParticipationState =
  | { mode: "single" }
  | {
      mode: "local_shared";
      participants: LocalParticipant[];
      activeParticipantId: string;
      /** Participants who finished managing for the current advance window. */
      readyParticipantIds: string[];
    };

export const DEFAULT_PARTICIPATION_STATE: ParticipationState = {
  mode: "single",
};

export function isParticipationMode(
  value: unknown,
): value is ParticipationMode {
  return (
    typeof value === "string" &&
    PARTICIPATION_MODES.includes(value as ParticipationMode)
  );
}

// ---------------------------------------------------------------------------
// Setup input (new-game form → createSaveAction). Not persisted as-is.
// ---------------------------------------------------------------------------

export type LocalParticipantSetup = {
  displayName: string;
  teamCount: number;
};

export type ParticipationSetupInput =
  | { mode: "single" }
  | { mode: "local_shared"; participants: LocalParticipantSetup[] };

export const DEFAULT_PARTICIPATION_SETUP: ParticipationSetupInput = {
  mode: "single",
};

export type ParticipationSetupResult =
  | { ok: true; value: ParticipationSetupInput }
  | { ok: false; errors: string[] };

/** Validate a display name; returns the trimmed name or an error. */
export function normalizeParticipantName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Participant name is required." };
  }
  const name = raw.trim();
  if (name.length === 0) {
    return { ok: false, error: "Participant name is required." };
  }
  if (name.length > PARTICIPANT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Participant names must be ${PARTICIPANT_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, name };
}

/**
 * Parse and validate participation setup.
 * `maxControlledTeams` is the league's controlled-franchise cap.
 */
export function parseParticipationSetup(
  raw: unknown,
  maxControlledTeams: number,
): ParticipationSetupResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: DEFAULT_PARTICIPATION_SETUP };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["Participation settings are malformed."] };
  }
  const input = raw as Record<string, unknown>;
  if (input.mode === "single") {
    return { ok: true, value: { mode: "single" } };
  }
  if (input.mode !== "local_shared") {
    return {
      ok: false,
      errors: ["Choose Single Player or Local Shared League."],
    };
  }

  const errors: string[] = [];
  if (!Array.isArray(input.participants)) {
    return { ok: false, errors: ["Local shared leagues need participants."] };
  }
  const rawParticipants = input.participants as unknown[];
  if (
    rawParticipants.length < MIN_LOCAL_PARTICIPANTS ||
    rawParticipants.length > MAX_LOCAL_PARTICIPANTS
  ) {
    errors.push(
      `Local shared leagues need ${MIN_LOCAL_PARTICIPANTS}–${MAX_LOCAL_PARTICIPANTS} participants.`,
    );
  }

  const participants: LocalParticipantSetup[] = [];
  const seenNames = new Set<string>();
  rawParticipants.forEach((entry, index) => {
    const label = `Participant ${index + 1}`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${label} is malformed.`);
      return;
    }
    const record = entry as Record<string, unknown>;
    const name = normalizeParticipantName(record.displayName);
    if (!name.ok) {
      errors.push(`${label}: ${name.error}`);
      return;
    }
    const key = name.name.toLocaleLowerCase();
    if (seenNames.has(key)) {
      errors.push(`${label}: names must be unique within the league.`);
    }
    seenNames.add(key);
    const teamCount = record.teamCount;
    if (
      typeof teamCount !== "number" ||
      !Number.isInteger(teamCount) ||
      teamCount < 1
    ) {
      errors.push(`${label} must control at least one team.`);
      return;
    }
    participants.push({ displayName: name.name, teamCount });
  });

  const total = participants.reduce((sum, p) => sum + p.teamCount, 0);
  if (total > maxControlledTeams) {
    errors.push(
      `Participants control ${total} teams; this league allows at most ${maxControlledTeams}.`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { mode: "local_shared", participants } };
}

/** Total controlled franchises implied by a setup input (null = use settings). */
export function controlledTeamCountForSetup(
  setup: ParticipationSetupInput,
): number | null {
  if (setup.mode === "single") {
    return null;
  }
  return setup.participants.reduce((sum, p) => sum + p.teamCount, 0);
}

// ---------------------------------------------------------------------------
// Persisted-state invariants
// ---------------------------------------------------------------------------

/**
 * Structural + cross-field checks for persisted participation.
 * Returns human-readable errors; empty array means valid.
 */
export function participationStateErrors(
  value: unknown,
  ownedTeamIds: readonly string[],
  activeOwnerTeamId: string,
  path = "user.participation",
): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [`${path} must be an object.`];
  }
  const record = value as Record<string, unknown>;
  if (!isParticipationMode(record.mode)) {
    return [`${path}.mode must be one of ${PARTICIPATION_MODES.join(", ")}.`];
  }
  if (record.mode === "single") {
    return [];
  }

  const errors: string[] = [];
  if (!Array.isArray(record.participants)) {
    return [`${path}.participants must be an array.`];
  }
  const participants = record.participants as unknown[];
  if (
    participants.length < MIN_LOCAL_PARTICIPANTS ||
    participants.length > MAX_LOCAL_PARTICIPANTS
  ) {
    errors.push(
      `${path}.participants must contain ${MIN_LOCAL_PARTICIPANTS}–${MAX_LOCAL_PARTICIPANTS} entries.`,
    );
  }

  const ownedSet = new Set(ownedTeamIds);
  const ids = new Set<string>();
  const assignedTeams = new Map<string, string>();
  let hostCount = 0;
  participants.forEach((entry, index) => {
    const at = `${path}.participants[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${at} must be an object.`);
      return;
    }
    const p = entry as Record<string, unknown>;
    if (typeof p.id !== "string" || p.id.length === 0) {
      errors.push(`${at}.id must be a non-empty string.`);
      return;
    }
    if (ids.has(p.id)) {
      errors.push(`${at}.id "${p.id}" is duplicated.`);
    }
    ids.add(p.id);
    if (!normalizeParticipantName(p.displayName).ok) {
      errors.push(`${at}.displayName is invalid.`);
    }
    if (typeof p.isHost !== "boolean") {
      errors.push(`${at}.isHost must be a boolean.`);
    } else if (p.isHost) {
      hostCount += 1;
    }
    if (!Array.isArray(p.teamIds) || p.teamIds.length === 0) {
      errors.push(`${at}.teamIds must contain at least one team.`);
      return;
    }
    for (const teamId of p.teamIds as unknown[]) {
      if (typeof teamId !== "string" || !ownedSet.has(teamId)) {
        errors.push(
          `${at}.teamIds contains "${String(teamId)}" not in user.ownedTeamIds.`,
        );
        continue;
      }
      const owner = assignedTeams.get(teamId);
      if (owner !== undefined) {
        errors.push(
          `Team "${teamId}" is assigned to more than one participant.`,
        );
        continue;
      }
      assignedTeams.set(teamId, p.id);
    }
  });

  if (hostCount !== 1) {
    errors.push(`${path} must have exactly one host.`);
  }
  for (const teamId of ownedTeamIds) {
    if (!assignedTeams.has(teamId)) {
      errors.push(`Owned team "${teamId}" is not assigned to a participant.`);
    }
  }

  if (
    typeof record.activeParticipantId !== "string" ||
    !ids.has(record.activeParticipantId)
  ) {
    errors.push(`${path}.activeParticipantId must reference a participant.`);
  } else if (
    assignedTeams.get(activeOwnerTeamId) !== record.activeParticipantId
  ) {
    errors.push(
      `user.activeOwnerTeamId must belong to the active participant.`,
    );
  }

  if (!Array.isArray(record.readyParticipantIds)) {
    errors.push(`${path}.readyParticipantIds must be an array.`);
  } else {
    const seenReady = new Set<string>();
    for (const id of record.readyParticipantIds as unknown[]) {
      if (typeof id !== "string" || !ids.has(id)) {
        errors.push(
          `${path}.readyParticipantIds contains an unknown participant.`,
        );
      } else if (seenReady.has(id)) {
        errors.push(`${path}.readyParticipantIds contains duplicates.`);
      }
      if (typeof id === "string") {
        seenReady.add(id);
      }
    }
  }

  return errors;
}
