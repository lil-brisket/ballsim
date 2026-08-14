import {
  asDivisionId,
  asTeamId,
  type DivisionId,
  type TeamId,
} from "@/domain/ids";
import type { Team } from "@/domain/entities/team";

export type CreateTeamOverrides = {
  id?: TeamId | string;
  divisionId?: DivisionId | string;
  city?: string;
  name?: string;
  abbreviation?: string;
};

/**
 * Deterministic Team factory. Defaults are stable; pass overrides to customize.
 */
export function createTeam(overrides: CreateTeamOverrides = {}): Team {
  return {
    id: asTeamId(overrides.id ?? "team_test"),
    divisionId: asDivisionId(overrides.divisionId ?? "div_test"),
    city: overrides.city ?? "Harbor",
    name: overrides.name ?? "Titans",
    abbreviation: overrides.abbreviation ?? "HAR",
  };
}
