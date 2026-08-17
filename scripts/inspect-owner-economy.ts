/**
 * One-off Phase 1B cash trajectory inspect (not part of CI).
 * Run: npx tsx scripts/inspect-owner-economy.ts
 */
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { toFranchiseBusinessView } from "@/state/franchise-selectors";
import { getTeamPayroll } from "@/systems/salary-cap";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { bootstrapWorld } from "@/systems/world-pipeline";

let state = createInitialGameState({
  saveId: "inspect_economy",
  rngSeed: 77,
  settings: CBL_GAME_SETTINGS,
});
const rng = createSeededRng(state.meta.rngState);
state = bootstrapWorld(state, rng).state;
const teamId = state.user.controlledTeamId;
const year = state.competition.season.year;
const cash0 = state.business.finances[teamId]!.cash;
const payroll = getTeamPayroll(teamId, year, state);
console.log(
  JSON.stringify({
    cash0,
    annualPayroll: payroll,
    weeklyPayroll: Math.floor(payroll / 52),
  }),
);

for (let day = 0; day < 90; day += 1) {
  const result = advanceSimulation(state, rng, { days: 1 });
  state = result.state;
}
state = {
  ...state,
  meta: { ...state.meta, rngState: rng.getState() },
};

const cash90 = state.business.finances[teamId]!.cash;
const view = toFranchiseBusinessView(state);
console.log(
  JSON.stringify({
    afterDays: 90,
    cash: cash90,
    cashDelta: cash90 - cash0,
    forecastAttendance: view.forecast.attendance,
    awareness: view.awareness,
    runwayWeeks: view.cashRunway.runwayWeeks,
    netWeeklyBurn: view.cashRunway.netWeeklyBurn,
  }),
);
