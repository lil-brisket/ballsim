import type { TeamId } from "@/domain/ids";

export type TeamStanding = {
  teamId: TeamId;
  wins: number;
  losses: number;
};

export type Standings = {
  byTeamId: Record<string, TeamStanding>;
};
