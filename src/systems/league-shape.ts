import {
  resolveLeagueShape,
  tryResolveLeagueShape,
  type LeagueShapeInput,
  type ResolvedLeagueShape,
  type ResolveLeagueShapeResult,
} from "@/domain/league-shape";
import type { LeagueGenerationConfig } from "@/systems/league-generation";

export {
  resolveLeagueShape,
  tryResolveLeagueShape,
  type LeagueShapeInput,
  type ResolvedLeagueShape,
  type ResolveLeagueShapeResult,
};

/**
 * Builds LeagueGenerationConfig fields from settings.
 * Caller supplies league identity fields.
 */
export function leagueGenerationConfigFromSettings(
  input: LeagueShapeInput & {
    leagueId?: string;
    leagueName: string;
    leagueAbbreviation?: string;
    rosterSize?: number;
  },
): LeagueGenerationConfig {
  const shape = resolveLeagueShape(input);
  return {
    leagueId: input.leagueId,
    leagueName: input.leagueName,
    leagueAbbreviation: input.leagueAbbreviation,
    conferenceCount: shape.conferenceCount,
    divisionsPerConference: shape.divisionsPerConference,
    teamsPerDivision: shape.teamsPerDivision,
    rosterSize: input.rosterSize,
  };
}
