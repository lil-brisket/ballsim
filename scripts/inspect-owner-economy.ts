/**
 * One-off Owner Mode economy inspect (not part of CI).
 * Run: npx tsx scripts/inspect-owner-economy.ts [scenario] [seasons] [seed]
 * Scenarios: baseline | win_now | conservative | development | distress | recovery |
 *            aggressive | high_market | low_market
 */
import {
  ECONOMY_SCENARIOS,
  runEconomyScenario,
  type EconomyScenarioId,
  type SeasonEconomySnapshot,
} from "@/systems/economy/scenario-harness";

const scenarioArg = process.argv[2] ?? "baseline";
const seasons = Number(process.argv[3] ?? "1");
const seedArg = process.argv[4];
const seed = seedArg !== undefined ? Number(seedArg) : undefined;
if (!ECONOMY_SCENARIOS.includes(scenarioArg as EconomyScenarioId)) {
  throw new Error(
    `Unknown scenario "${scenarioArg}". Use: ${ECONOMY_SCENARIOS.join(", ")}`,
  );
}

const result = runEconomyScenario(scenarioArg as EconomyScenarioId, seasons, {
  seed,
});

function formatCashFlow(season: SeasonEconomySnapshot) {
  const { cashFlow } = season;
  return {
    startingCash: cashFlow.startingCash,
    endingCash: cashFlow.endingCash,
    netCash: cashFlow.netCash,
    netOperatingCashFlow: cashFlow.netOperatingCashFlow,
    nonOperatingCashFlow: cashFlow.nonOperatingCashFlow,
    revenue: cashFlow.revenue,
    costs: cashFlow.costs,
    /* Identity: netCash ≈ netOperatingCashFlow - facilityInvestment + nonOperatingCashFlow */
    identityCheck:
      cashFlow.netOperatingCashFlow -
      cashFlow.costs.facilityInvestment +
      cashFlow.nonOperatingCashFlow,
    minCash: cashFlow.minCash,
    firstNegativeDate: cashFlow.firstNegativeDate,
    daysNegative: cashFlow.daysNegative,
    endedNegative: cashFlow.endedNegative,
  };
}

const unclassifiedWarnings: string[] = [];
for (const season of result.seasons) {
  if (season.cashFlow.revenue.unclassified !== 0) {
    unclassifiedWarnings.push(
      `season ${season.seasonYear}: unclassifiedRevenue=${season.cashFlow.revenue.unclassified}`,
    );
  }
  if (season.cashFlow.costs.unclassified !== 0) {
    unclassifiedWarnings.push(
      `season ${season.seasonYear}: unclassifiedExpenses=${season.cashFlow.costs.unclassified}`,
    );
  }
}

console.log(
  JSON.stringify(
    {
      scenario: result.scenario,
      seed: result.seed,
      warnings: unclassifiedWarnings.length > 0 ? unclassifiedWarnings : undefined,
      recoveryDelta: result.recoveryDelta,
      actions: result.actions,
      seasons: result.seasons.map((season) => ({
        seasonYear: season.seasonYear,
        cash: season.cash,
        payroll: season.payroll,
        health: season.health,
        wins: season.wins,
        losses: season.losses,
        playoffResult: season.playoffResult,
        meanRosterOverall: season.meanRosterOverall,
        franchiseValue: season.franchiseValue,
        ticketPrice: season.ticketPrice,
        marketingBudget: season.marketingBudget,
        attendanceMean: season.attendanceMean,
        capacityMean: season.capacityMean,
        fillRateMean: season.fillRateMean,
        selloutGames: season.selloutGames,
        lowAttendanceGames: season.lowAttendanceGames,
        runwayWeeks: season.runwayWeeks,
        revenueShares: season.revenue.shares,
        cashFlow: formatCashFlow(season),
      })),
    },
    null,
    2,
  ),
);

if (unclassifiedWarnings.length > 0) {
  console.error(
    `\nWARNING: unclassified cash-flow amounts detected:\n- ${unclassifiedWarnings.join("\n- ")}`,
  );
}
