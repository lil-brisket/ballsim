import {
  isCoachingPhilosophy,
  type CoachingPhilosophy,
} from "@/domain/coaching/coaching-philosophy";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import {
  assertTeamBranding,
  type TeamBranding,
} from "@/domain/entities/team-branding";
import {
  cloneTeamRosterManagement,
  emptyTeamRosterManagement,
  isTeamRosterManagement,
  type TeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import type {
  ArenaId,
  ConferenceId,
  DivisionId,
  PlayerId,
  StaffId,
  TeamId,
} from "@/domain/ids";

export type { TeamRosterManagement } from "@/domain/entities/team-roster-management";

/** Placeholder for future team-owned financial state. */
export type TeamFinanceState = Record<never, never>;

/**
 * Team-level offensive and defensive play-style tendencies (1–99).
 * These are independent tendencies, not mutually exclusive probabilities.
 * Simulation does not consume them yet. Discrete coaching uses
 * Team.coachingPhilosophy instead.
 */
export type TeamPlayStyle = {
  /** Preference for faster/slower tempo; does not calculate possessions per game. */
  pace: number;
  /** Preference for three-point attempts; does not determine shot selection yet. */
  threePointFrequency: number;
  /** Preference for interior offense; does not determine shot selection yet. */
  insideFrequency: number;
  /** Preference for ball movement; does not determine pass probability yet. */
  passing: number;
  /** Preference for aggressive defense; does not modify defensive resolution yet. */
  defensiveAggression: number;
  /**
   * How strongly offense is organized around primary priorities.
   * Abstract for v1 — not an offensive-system or player-role enum.
   */
  offensiveFocus: number;
};

export const TEAM_PLAY_STYLE_KEYS: readonly (keyof TeamPlayStyle)[] = [
  "pace",
  "threePointFrequency",
  "insideFrequency",
  "passing",
  "defensiveAggression",
  "offensiveFocus",
];

/** Neutral / average tendencies (50). Call sites must spread: `{ ...NEUTRAL_TEAM_PLAY_STYLE }`. */
export const NEUTRAL_TEAM_PLAY_STYLE: TeamPlayStyle = {
  pace: 50,
  threePointFrequency: 50,
  insideFrequency: 50,
  passing: 50,
  defensiveAggression: 50,
  offensiveFocus: 50,
};

export type Team = {
  id: TeamId;
  name: string;
  city: string;
  abbreviation: string;
  conferenceId: ConferenceId;
  divisionId: DivisionId;
  roster: PlayerId[];
  staff: StaffId[];
  finances: TeamFinanceState;
  arenaId: ArenaId;
  reputation: number;
  playStyle: TeamPlayStyle;
  coachingPhilosophy: CoachingPhilosophy;
  /** Visual identity (colours + logo). Persists across simulation. */
  branding: TeamBranding;
  /**
   * Lineup / rotation configuration. Not roster membership —
   * Team.roster + Player.teamId remain canonical for who is on the team.
   */
  rosterManagement: TeamRosterManagement;
};

/** Unvalidated construction payload for {@link createTeam}. */
export type TeamInput = {
  id: TeamId;
  name: string;
  city: string;
  abbreviation: string;
  conferenceId: ConferenceId;
  divisionId: DivisionId;
  roster: PlayerId[];
  staff: StaffId[];
  finances: TeamFinanceState;
  arenaId: ArenaId;
  reputation: number;
  playStyle: TeamPlayStyle;
  coachingPhilosophy: CoachingPhilosophy;
  branding: TeamBranding;
  rosterManagement?: TeamRosterManagement;
};

/**
 * Validates input and returns a new plain Team.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createTeam(input: TeamInput): Team {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyName(input.name, "name");
  assertNonEmptyName(input.city, "city");
  assertNonEmptyName(input.abbreviation, "abbreviation");
  assertNonEmptyId(input.conferenceId, "conferenceId");
  assertNonEmptyId(input.divisionId, "divisionId");
  assertIdList(input.roster, "roster");
  assertIdList(input.staff, "staff");
  assertFinances(input.finances);
  assertNonEmptyId(input.arenaId, "arenaId");
  assertRating(input.reputation, "reputation");
  assertPlayStyle(input.playStyle);
  assertCoachingPhilosophy(input.coachingPhilosophy);
  const branding = assertTeamBranding(input.branding);
  const rosterManagement =
    input.rosterManagement !== undefined
      ? assertRosterManagement(input.rosterManagement)
      : emptyTeamRosterManagement();

  return {
    id: input.id,
    name: input.name,
    city: input.city,
    abbreviation: input.abbreviation,
    conferenceId: input.conferenceId,
    divisionId: input.divisionId,
    roster: [...input.roster],
    staff: [...input.staff],
    finances: { ...input.finances },
    arenaId: input.arenaId,
    reputation: input.reputation,
    playStyle: { ...input.playStyle },
    coachingPhilosophy: { ...input.coachingPhilosophy },
    branding: { ...branding },
    rosterManagement: cloneTeamRosterManagement(rosterManagement),
  };
}

function assertRosterManagement(
  value: unknown,
): TeamRosterManagement {
  if (!isTeamRosterManagement(value)) {
    throw new Error(
      "Team rosterManagement must be a valid TeamRosterManagement object.",
    );
  }
  return value;
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Team ${field} must be a non-empty string.`);
  }
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Team ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Team ${field} cannot be whitespace-only.`);
  }
}

function assertIdList(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`Team ${field} must be an array.`);
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Team ${field} must not contain empty ids.`);
    }
    if (seen.has(id)) {
      throw new Error(`Team ${field} contains duplicate ids.`);
    }
    seen.add(id);
  }
}

function assertFinances(value: unknown): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Team finances must be an object.");
  }
}

function assertPlayStyle(value: unknown): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Team playStyle must be a non-null, non-array object.");
  }
  const playStyle = value as Record<string, unknown>;
  const knownKeys = new Set<string>(TEAM_PLAY_STYLE_KEYS);
  for (const key of Object.keys(playStyle)) {
    if (!knownKeys.has(key)) {
      throw new Error(`Team playStyle contains unknown key "${key}".`);
    }
  }
  for (const key of TEAM_PLAY_STYLE_KEYS) {
    const rating = playStyle[key];
    if (typeof rating !== "number") {
      throw new Error(
        `Team playStyle.${key} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
      );
    }
    assertRating(rating, `playStyle.${key}`);
  }
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Team ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}

function assertCoachingPhilosophy(value: unknown): void {
  if (!isCoachingPhilosophy(value)) {
    throw new Error(
      "Team coachingPhilosophy must be a valid CoachingPhilosophy object.",
    );
  }
}
