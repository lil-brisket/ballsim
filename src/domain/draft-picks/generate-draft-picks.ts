import {
  createDraftPick,
  draftPickIdFor,
  DRAFT_PICK_ROUNDS,
  type DraftPick,
} from "@/domain/entities/draft-pick";
import type { Team } from "@/domain/entities/team";
import type { TeamId } from "@/domain/ids";

/** How many future draft seasons each team must hold picks for. */
export const DRAFT_PICK_HORIZON_YEARS = 3;

/**
 * Pure deterministic draft-pick generation for a season.
 * Does not read GameState or RNG. Safe for persistence migrations.
 *
 * Creates picks for seasonYear+1 through seasonYear+DRAFT_PICK_HORIZON_YEARS,
 * rounds 1 and 2, for every team.
 */
export function generateDraftPicksForSeason(
  teams: readonly Team[],
  seasonYear: number,
): Record<string, DraftPick> {
  if (!Number.isInteger(seasonYear)) {
    throw new Error("seasonYear must be an integer.");
  }
  const picks: Record<string, DraftPick> = {};
  const sortedTeams = [...teams].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  for (const team of sortedTeams) {
    for (let offset = 1; offset <= DRAFT_PICK_HORIZON_YEARS; offset += 1) {
      const year = seasonYear + offset;
      for (const round of DRAFT_PICK_ROUNDS) {
        const id = draftPickIdFor(team.id, year, round);
        picks[id] = createDraftPick({
          id,
          originalTeamId: team.id,
          ownerTeamId: team.id,
          seasonYear: year,
          round,
        });
      }
    }
  }
  return picks;
}

/**
 * Idempotent merge: preserve existing picks by id; create only missing expected picks.
 * Never deletes picks. Never replaces existing pick records.
 */
export function mergeDraftPicksForSeason(
  existing: Record<string, DraftPick>,
  teams: readonly Team[],
  seasonYear: number,
): Record<string, DraftPick> {
  const expected = generateDraftPicksForSeason(teams, seasonYear);
  const merged: Record<string, DraftPick> = { ...existing };
  for (const [id, pick] of Object.entries(expected)) {
    if (merged[id] === undefined) {
      merged[id] = pick;
    }
  }
  return merged;
}

/**
 * Expected pick count for a set of teams at a season year (for tests / docs).
 */
export function expectedDraftPickCount(teamCount: number): number {
  return teamCount * DRAFT_PICK_HORIZON_YEARS * DRAFT_PICK_ROUNDS.length;
}

export function teamDraftPickIds(
  teamId: TeamId,
  seasonYear: number,
): string[] {
  const ids: string[] = [];
  for (let offset = 1; offset <= DRAFT_PICK_HORIZON_YEARS; offset += 1) {
    const year = seasonYear + offset;
    for (const round of DRAFT_PICK_ROUNDS) {
      ids.push(draftPickIdFor(teamId, year, round));
    }
  }
  return ids;
}
