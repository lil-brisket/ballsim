import type { TeamId } from "@/domain/ids";

export type StandingStreak = {
  type: "W" | "L" | null;
  count: number;
};

export type TeamStanding = {
  teamId: TeamId;
  wins: number;
  losses: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  streak: StandingStreak;
  conferenceWins: number;
  conferenceLosses: number;
  divisionWins: number;
  divisionLosses: number;
};

export type Standings = {
  byTeamId: Record<string, TeamStanding>;
};

/** Zeroed standing row for a team with no counted games. */
export function createEmptyTeamStanding(teamId: TeamId): TeamStanding {
  return {
    teamId,
    wins: 0,
    losses: 0,
    winPercentage: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifferential: 0,
    streak: { type: null, count: 0 },
    conferenceWins: 0,
    conferenceLosses: 0,
    divisionWins: 0,
    divisionLosses: 0,
  };
}
