/**
 * Standings rank labels. Every rank on screen names its scope ("League #2",
 * "Coastal #1") so a league rank is never mistaken for a conference rank.
 */

/** "#2", or "—" when unranked (before the team's first game). */
export function rankNumberLabel(rank: number | null | undefined): string {
  return rank == null || rank < 1 ? "—" : `#${rank}`;
}

/** "League #2", or "—" when unranked. */
export function leagueRankLabel(rank: number | null | undefined): string {
  return rank == null || rank < 1 ? "—" : `League #${rank}`;
}

/** Conference or division rank, e.g. "Coastal #1". */
export function groupRankLabel(groupName: string, rank: number): string {
  return `${groupName} #${rank}`;
}
