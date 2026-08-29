import type { StaffInterestLevel } from "@/domain/entities/staff-preferences";
import type { Staff } from "@/domain/entities/staff";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type StaffInterestResult = {
  level: StaffInterestLevel;
  interested: boolean;
  score: number;
};

/**
 * Evaluate whether a free-agent staff member would consider joining a team.
 * Uses preferences + team context. Experience improves negotiation consistency.
 */
export function evaluateStaffInterest(
  staff: Staff,
  teamId: TeamId,
  state: GameState,
  offer: { annualSalary: number; years: number },
): StaffInterestResult {
  if (staff.teamId !== null) {
    return { level: "unwilling", interested: false, score: 0 };
  }

  const prefs = staff.preferences;
  const existing = Object.values(state.world.staff).find(
    (s) => s.teamId === teamId && s.role === staff.role,
  );
  if (existing) {
    // Role already filled — unwilling unless they'd take a demotion/promotion path
    return { level: "unwilling", interested: false, score: 5 };
  }

  let score = 50;

  // Salary
  const salaryRatio =
    prefs.desiredSalary > 0
      ? offer.annualSalary / prefs.desiredSalary
      : 1;
  if (offer.annualSalary < prefs.minimumSalary) {
    score -= 40;
  } else {
    score +=
      (Math.min(1.3, salaryRatio) - 0.8) * (prefs.salaryWeight / 100) * 40;
  }

  // Security (years)
  const yearDiff = offer.years - prefs.preferredContractYears;
  score += yearDiff * (prefs.securityWeight / 100) * 8;

  // Winning
  const standing = state.competition.standings.byTeamId[teamId];
  if (standing) {
    const games = standing.wins + standing.losses;
    if (games > 0) {
      const winPct = standing.wins / games;
      score += (winPct - 0.5) * (prefs.winningWeight / 100) * 30;
    }
  }

  // Development opportunity (younger staff / high potential)
  if (staff.age < 40 && staff.potential - staff.overall >= 8) {
    score += (prefs.developmentOpportunityWeight / 100) * 10;
  }

  // Promotion path
  if (
    prefs.preferredRole &&
    prefs.preferredRole !== staff.role &&
    !Object.values(state.world.staff).some(
      (s) => s.teamId === teamId && s.role === prefs.preferredRole,
    )
  ) {
    score += (prefs.promotionWeight / 100) * 12;
  }

  // Experience: veterans more picky about salary, less random
  if (staff.experience >= 15 && offer.annualSalary < prefs.desiredSalary * 0.9) {
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: StaffInterestLevel;
  if (score >= 70) level = "interested";
  else if (score >= 50) level = "neutral";
  else if (score >= 30) level = "uninterested";
  else level = "unwilling";

  return {
    level,
    interested: level === "interested" || level === "neutral",
    score,
  };
}
