/**
 * Team.playStyle as it was stored from schema v11 to v69. Nothing ever read
 * it (Team.coachingPhilosophy drives the simulation), so v70 removed it. Only
 * the migrations that add and later drop it still need the shape.
 */
export type TeamPlayStyle = {
  pace: number;
  threePointFrequency: number;
  insideFrequency: number;
  passing: number;
  defensiveAggression: number;
  offensiveFocus: number;
};

export const NEUTRAL_TEAM_PLAY_STYLE: TeamPlayStyle = {
  pace: 50,
  threePointFrequency: 50,
  insideFrequency: 50,
  passing: 50,
  defensiveAggression: 50,
  offensiveFocus: 50,
};
