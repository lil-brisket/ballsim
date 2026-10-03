import { asPlayerId, type PlayerId } from "@/domain/ids";
import type { RosterTeamSource } from "@/systems/custom-content/package-types";

export function canonicalCustomPlayerId(
  contentId: string,
  sourceId: string,
): string {
  return `custom_${contentId}_${sourceId}`;
}

export function asCanonicalPlayerId(
  contentId: string,
  sourceId: string,
): PlayerId {
  return asPlayerId(canonicalCustomPlayerId(contentId, sourceId));
}

export function mapTeamSourceIds(
  teams: readonly RosterTeamSource[],
  generatedTeamIds: readonly string[],
): Map<string, string> {
  const packageIds = [...teams.map((team) => team.sourceId)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const worldIds = [...generatedTeamIds].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const mapping = new Map<string, string>();
  for (let index = 0; index < packageIds.length; index += 1) {
    const sourceId = packageIds[index]!;
    const teamId = worldIds[index];
    if (teamId !== undefined) {
      mapping.set(sourceId, teamId);
    }
  }
  return mapping;
}
