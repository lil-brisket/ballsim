export type TeamFilterValue = "all" | "my" | string;

/**
 * Parse the team filter query param into a typed value.
 * Can be used in both server and client components.
 */
export function parseTeamFilterParam(
  value: string | undefined,
  myTeamId: string,
): TeamFilterValue {
  if (!value || value === "all") {
    return "all";
  }
  if (value === "my" || value === myTeamId) {
    return value === myTeamId ? myTeamId : "my";
  }
  return value;
}

/**
 * Resolve a team filter value to a concrete team ID or null.
 * Can be used in both server and client components.
 */
export function resolveTeamFilterId(
  value: TeamFilterValue,
  myTeamId: string,
): string | null {
  if (value === "all") {
    return null;
  }
  if (value === "my") {
    return myTeamId;
  }
  return value;
}
