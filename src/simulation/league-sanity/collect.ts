import { getActiveOwnedFranchise } from "@/state/owner-context";
/**
 * Collect numeric team-season observations from GameState.
 * No franchise-intelligence imports.
 */

import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import {
  isPlayoffAppearance,
  playoffResultDepth,
  type PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import {
  meanRosterAge,
  meanRosterOverall,
  youngRosterSharePct,
} from "@/state/roster-strength";
import { calculateCashRunway } from "@/state/franchise-selectors";
import { arenaCapacity } from "@/systems/facilities";
import { derivePlayoffResults } from "@/systems/franchise-history";
import { getTeamPayroll } from "@/systems/salary-cap";
import { getFinancialStatement } from "@/systems/team-finances";
import type { LeagueSanityTeamSeasonSnapshot } from "@/simulation/league-sanity/types";

function meanFacilityLevel(state: GameState, teamId: TeamId): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return 1;
  }
  let sum = 0;
  for (const category of FACILITY_CATEGORIES) {
    sum += ops.facilities[category as FacilityCategory].level;
  }
  return sum / FACILITY_CATEGORIES.length;
}

function leagueRanks(state: GameState): Map<TeamId, number> {
  const standings = Object.values(state.competition.standings.byTeamId);
  const sorted = [...standings].sort((a, b) => {
    if (b.winPercentage !== a.winPercentage) {
      return b.winPercentage - a.winPercentage;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return a.teamId.localeCompare(b.teamId);
  });
  const ranks = new Map<TeamId, number>();
  sorted.forEach((row, index) => {
    ranks.set(row.teamId, index + 1);
  });
  return ranks;
}

function sponsorshipRevenueForYear(
  state: GameState,
  teamId: TeamId,
  year: number,
): number {
  const statement = getFinancialStatement(state, teamId, year);
  return statement.revenue.sponsorships;
}

function meanRosterSalary(
  state: GameState,
  teamId: TeamId,
  year: number,
): number {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return 0;
  }
  const payroll = getTeamPayroll(teamId, year, state);
  return payroll / team.roster.length;
}

function fillRateForTeam(
  state: GameState,
  teamId: TeamId,
  year: number,
  attendance: number | null,
): number | null {
  if (attendance === null || attendance <= 0) {
    return null;
  }
  const capacity = arenaCapacity(state, teamId);
  if (capacity <= 0) {
    return null;
  }
  // Approximate: attendance is season total; divide by home games estimate.
  const standing = state.competition.standings.byTeamId[teamId];
  const games = (standing?.wins ?? 0) + (standing?.losses ?? 0);
  const homeGames = Math.max(1, Math.floor(games / 2));
  return Math.min(1.5, attendance / (capacity * homeGames));
}

function seasonsSinceFounding(
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): number {
  const ops = state.business.franchiseOps[teamId];
  const founded = ops?.foundedSeasonYear ?? seasonYear;
  return Math.max(1, seasonYear - founded + 1);
}

function isExpansionTeam(state: GameState, teamId: TeamId): boolean {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return false;
  }
  const leagueStart = getActiveOwnedFranchise(state).ownerStartSeasonYear ?? ops.foundedSeasonYear;
  return ops.foundedSeasonYear > leagueStart;
}

/**
 * Snapshot all teams at the current season boundary (postseason / season end).
 */
export function collectLeagueSanitySnapshots(
  state: GameState,
  simulationIndex: number,
  seasonIndex: number,
): LeagueSanityTeamSeasonSnapshot[] {
  const year = state.competition.season.year;
  const playoffMap = derivePlayoffResults(state);
  const ranks = leagueRanks(state);
  const championId = state.competition.playoffs.championTeamId;
  const snapshots: LeagueSanityTeamSeasonSnapshot[] = [];

  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    const standing = state.competition.standings.byTeamId[teamId];
    const ops = state.business.franchiseOps[teamId];
    const finances = state.business.finances[teamId];
    if (!ops || !finances) {
      continue;
    }
    const wins = standing?.wins ?? 0;
    const losses = standing?.losses ?? 0;
    const games = wins + losses;
    const winPct = games === 0 ? 0 : wins / games;
    const playoffResult =
      (playoffMap[teamId] as PlayoffResultSnapshot | undefined) ?? "missed";
    const playoff = isPlayoffAppearance(playoffResult);
    const statement = getFinancialStatement(state, teamId, year);
    const runway = calculateCashRunway(state, teamId);
    const attendance = finances.attendanceByYear[String(year)] ?? null;
    const relocated =
      state.business.relocationByTeamId[teamId]?.stage === "complete" &&
      state.business.relocationByTeamId[teamId]
        ?.lastCompletedRelocationSeasonYear === year;

    snapshots.push({
      simulationIndex,
      teamId,
      teamKey: `${simulationIndex}:${teamId}`,
      seasonYear: year,
      seasonIndex,
      seasonsSinceFounding: seasonsSinceFounding(state, teamId, year),
      wins,
      losses,
      winPct,
      leagueRank: ranks.get(teamId) ?? Object.keys(state.world.teams).length,
      playoff,
      playoffDepth: playoffResultDepth(playoffResult),
      champion: championId === teamId,
      cash: finances.businessFunds,
      revenue: statement.revenue.total,
      expenses: statement.expenses.total,
      netIncome: statement.netIncome,
      payroll: getTeamPayroll(teamId, year, state),
      franchiseValue: calculateFranchiseValue(state, teamId),
      financialHealth: runway.health,
      insolvent: runway.health === "insolvent" || finances.businessFunds <= 0,
      attendance,
      fillRate: fillRateForTeam(state, teamId, year, attendance),
      ticketPrice: ops.ticketPrice,
      marketSize: ops.marketSize,
      marketingBudget: ops.marketing.budget,
      sponsorshipRevenue: sponsorshipRevenueForYear(state, teamId, year),
      meanFacilityLevel: meanFacilityLevel(state, teamId),
      meanRosterAge: meanRosterAge(state, teamId),
      youngSharePct: youngRosterSharePct(state, teamId),
      meanSalary: meanRosterSalary(state, teamId, year),
      rosterStrength: meanRosterOverall(state, teamId),
      reputation: state.world.teams[teamId]?.reputation ?? 50,
      fanSentiment: ops.fanSentiment,
      relocated: Boolean(relocated),
      expansionTeam: isExpansionTeam(state, teamId),
    });
  }

  return snapshots;
}
