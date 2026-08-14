import {
  asArenaId,
  asConferenceId,
  asDivisionId,
  asPlayerId,
  asStaffId,
  asTeamId,
  type ConferenceId,
  type DivisionId,
  type TeamId,
} from "@/domain/ids";
import {
  createTeam as createDomainTeam,
  NEUTRAL_TEAM_PLAY_STYLE,
  type Team,
  type TeamInput,
  type TeamPlayStyle,
} from "@/domain/entities/team";
import {
  DEFAULT_COACHING_PHILOSOPHY,
  type CoachingPhilosophy,
} from "@/domain/coaching/coaching-philosophy";

export type CreateTeamOverrides = {
  id?: TeamId | string;
  conferenceId?: ConferenceId | string;
  divisionId?: DivisionId | string;
  city?: string;
  name?: string;
  abbreviation?: string;
  roster?: TeamInput["roster"];
  staff?: TeamInput["staff"];
  finances?: TeamInput["finances"];
  arenaId?: string;
  reputation?: number;
  playStyle?: TeamPlayStyle;
  coachingPhilosophy?: CoachingPhilosophy;
};

/**
 * Deterministic Team factory. Defaults are stable; pass overrides to customize.
 */
export function createTeam(overrides: CreateTeamOverrides = {}): Team {
  return createDomainTeam({
    id: asTeamId(overrides.id ?? "team_test"),
    conferenceId: asConferenceId(overrides.conferenceId ?? "conf_test"),
    divisionId: asDivisionId(overrides.divisionId ?? "div_test"),
    city: overrides.city ?? "Harbor",
    name: overrides.name ?? "Titans",
    abbreviation: overrides.abbreviation ?? "HAR",
    roster: overrides.roster ?? [],
    staff: overrides.staff ?? [],
    finances: overrides.finances ?? {},
    arenaId: asArenaId(overrides.arenaId ?? "arena_test"),
    reputation: overrides.reputation ?? 50,
    playStyle: overrides.playStyle
      ? { ...overrides.playStyle }
      : { ...NEUTRAL_TEAM_PLAY_STYLE },
    coachingPhilosophy: overrides.coachingPhilosophy
      ? { ...overrides.coachingPhilosophy }
      : { ...DEFAULT_COACHING_PHILOSOPHY },
  });
}

export { asPlayerId, asStaffId };
