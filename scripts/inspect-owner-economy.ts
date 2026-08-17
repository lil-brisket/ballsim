/**
 * One-off Owner Mode economy inspect (not part of CI).
 * Run: npx tsx scripts/inspect-owner-economy.ts [scenario] [seasons]
 * Scenarios: baseline | win_now | conservative | development | distress | recovery
 */
import {
  ECONOMY_SCENARIOS,
  runEconomyScenario,
  type EconomyScenarioId,
} from "@/systems/economy/scenario-harness";

const scenarioArg = process.argv[2] ?? "baseline";
const seasons = Number(process.argv[3] ?? "1");
if (!ECONOMY_SCENARIOS.includes(scenarioArg as EconomyScenarioId)) {
  throw new Error(
    `Unknown scenario "${scenarioArg}". Use: ${ECONOMY_SCENARIOS.join(", ")}`,
  );
}

const result = runEconomyScenario(scenarioArg as EconomyScenarioId, seasons);
console.log(
  JSON.stringify(
    {
      scenario: result.scenario,
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
        revenueShares: season.revenue.shares,
        revenueTotal: season.revenue.total,
        broadcast: season.revenue.broadcast,
        gate: season.revenue.gate,
        runwayWeeks: season.runwayWeeks,
      })),
    },
    null,
    2,
  ),
);
