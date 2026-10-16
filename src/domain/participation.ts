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

export type ParticipationMode = "single" | "local_shared" | "online";

/** Modes where several people share one league. */
export type SharedParticipationMode = Exclude<ParticipationMode, "single">;

export const PARTICIPATION_MODES: readonly ParticipationMode[] = [
  "single",
  "local_shared",
  "online",
];

export const MIN_LOCAL_PARTICIPANTS = 2;
export const MAX_LOCAL_PARTICIPANTS = 4;
/** Online leagues start with the host alone; others join by invite. */
export const MIN_ONLINE_PARTICIPANTS = 1;
export const MAX_ONLINE_PARTICIPANTS = 8;
export const PARTICIPANT_NAME_MAX_LENGTH = 24;

/** Local shared (hotseat) leagues can be created from new-game setup. */
export const LOCAL_SHARED_LEAGUE_AVAILABLE = true;
/** Online leagues can be created by a signed-in user. */
export const ONLINE_LEAGUE_AVAILABLE = true;

export function participantLimits(mode: SharedParticipationMode): {
  min: number;
  max: number;
} {
  return mode === "online"
    ? { min: MIN_ONLINE_PARTICIPANTS, max: MAX_ONLINE_PARTICIPANTS }
    : { min: MIN_LOCAL_PARTICIPANTS, max: MAX_LOCAL_PARTICIPANTS };
}

export type LocalParticipant = {
  /** Stable generated id — the identity used for every ownership check. */
  id: string;
  displayName: string;
  /** Subset of user.ownedTeamIds; disjoint across participants. */
  teamIds: string[];
  /** Franchises this participant chose to control at setup. */
  plannedTeamCount: number;
  isHost: boolean;
  /** Online leagues: the signed-in account behind this participant. */
  userId?: string;
  /**
   * Online leagues: the franchise this participant last acted as. Each
   * request acts as the signed-in participant, so the shared
   * user.activeOwnerTeamId cannot remember it per person.
   */
  activeTeamId?: string;
};

export type SharedParticipation = {
  mode: SharedParticipationMode;
  participants: LocalParticipant[];
  /**
   * Local: who holds the device. Online: who the current request acts as
   * (overwritten per request from the session; the persisted value is
   * simply whoever saved last).
   */
  activeParticipantId: string;
  /** Participants who finished managing for the current advance window. */
  readyParticipantIds: string[];
  /**
   * False during onboarding, before every participant has been assigned
   * their franchises; only the host's anchor team exists until then.
   */
  assignmentsConfirmed: boolean;
};

/** @deprecated Prefer {@link SharedParticipation}. */
export type LocalSharedParticipation = SharedParticipation;

export type ParticipationState = { mode: "single" } | SharedParticipation;

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
  | { mode: "local_shared"; participants: LocalParticipantSetup[] }
  /** The signed-in creator becomes the host; others join by invite. */
  | { mode: "online" };

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
  if (input.mode === "online") {
    return { ok: true, value: { mode: "online" } };
  }
  if (input.mode !== "local_shared") {
    return {
      ok: false,
      errors: ["Choose Single Player, Local Shared League or Online."],
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
  if (setup.mode !== "local_shared") {
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
  const online = record.mode === "online";
  const limits = participantLimits(record.mode);
  if (participants.length < limits.min || participants.length > limits.max) {
    errors.push(
      `${path}.participants must contain ${limits.min}–${limits.max} entries.`,
    );
  }
  const userIds = new Set<string>();

  if (typeof record.assignmentsConfirmed !== "boolean") {
    errors.push(`${path}.assignmentsConfirmed must be a boolean.`);
  }
  const confirmed = record.assignmentsConfirmed === true;

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
    if (online) {
      if (typeof p.userId !== "string" || p.userId.length === 0) {
        errors.push(`${at}.userId is required in online leagues.`);
      } else if (userIds.has(p.userId)) {
        errors.push(`${at}.userId is already a participant.`);
      } else {
        userIds.add(p.userId);
      }
    } else if (p.userId !== undefined) {
      errors.push(`${at}.userId is only allowed in online leagues.`);
    }
    if (
      p.activeTeamId !== undefined &&
      (!Array.isArray(p.teamIds) || !p.teamIds.includes(p.activeTeamId))
    ) {
      errors.push(`${at}.activeTeamId must be one of its teams.`);
    }
    if (typeof p.isHost !== "boolean") {
      errors.push(`${at}.isHost must be a boolean.`);
    } else if (p.isHost) {
      hostCount += 1;
    }
    const planned = p.plannedTeamCount;
    if (
      typeof planned !== "number" ||
      !Number.isInteger(planned) ||
      planned < 1
    ) {
      errors.push(`${at}.plannedTeamCount must be a positive integer.`);
      return;
    }
    if (!Array.isArray(p.teamIds)) {
      errors.push(`${at}.teamIds must be an array.`);
      return;
    }
    if (confirmed && p.teamIds.length !== planned) {
      errors.push(
        `${at} controls ${p.teamIds.length} teams but planned ${planned}.`,
      );
    } else if (!confirmed && p.teamIds.length > planned) {
      errors.push(`${at} controls more teams than planned.`);
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
