/**
 * Deterministic multi-season behavioral harness for organizational fingerprints.
 * Diagnostic — not a CI gate.
 *
 * Run: npx tsx scripts/behavioral-harness.ts [seasons] [seed]
 *
 * Success criterion: after N seasons, can you tell organizations apart from history alone?
 */
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { AiProfile } from "@/domain/entities/franchise-ops";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  meanFingerprintsByProfile,
  snapshotFranchiseIdentityRow,
  type FranchiseIdentitySnapshotRow,
} from "@/systems/economy/franchise-identity-metrics";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import type { TeamId } from "@/domain/ids";

const PROFILE_CYCLE: AiProfile[] = [
  "win_now",
  "conservative",
  "development",
  "rebuild",
  "market_growth",
  "aggressive",
];

function assignDistinctProfiles(state: GameState): GameState {
  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  const franchiseOps = { ...state.business.franchiseOps };
  for (let index = 0; index < teamIds.length; index += 1) {
    const teamId = teamIds[index]!;
    const ops = franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    const profile = PROFILE_CYCLE[index % PROFILE_CYCLE.length]!;
    franchiseOps[teamId] = {
      ...ops,
      aiProfile: profile,
      spendingTolerance:
        profile === "conservative"
          ? 25
          : profile === "win_now" || profile === "aggressive"
            ? 75
            : 50,
      patience:
        profile === "development" || profile === "rebuild" ? 70 : 45,
      riskTolerance:
        profile === "conservative"
          ? 25
          : profile === "aggressive"
            ? 75
            : 50,
    };
  }
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps,
    },
  };
}

function advanceDays(state: GameState, days: number): GameState {
  let current = state;
  let rng = createSeededRng(current.meta.rngState);
  for (let day = 0; day < days; day += 1) {
    const result = advanceSimulation(current, rng);
    current = result.state;
    rng = createSeededRng(current.meta.rngState);
  }
  return current;
}

function summarizeHistory(state: GameState): void {
  const rows: FranchiseIdentitySnapshotRow[] = [];
  for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
    const row = snapshotFranchiseIdentityRow(state, teamId);
    if (row) {
      rows.push(row);
    }
  }
  const means = meanFingerprintsByProfile(rows);
  console.log("\n=== Organizational fingerprints (current season snapshot) ===\n");
  for (const mean of means) {
    console.log(
      [
        mean.profile.padEnd(14),
        `n=${mean.teamCount}`,
        `cash=${Math.round(mean.meanCash / 1_000_000)}M`,
        `payroll=${Math.round(mean.meanPayroll / 1_000_000)}M`,
        `mkt=${Math.round(mean.meanMarketing / 1_000_000)}M`,
        `ticket=${mean.meanTicketPrice.toFixed(1)}`,
        `age=${mean.meanRosterAge.toFixed(1)}`,
        `young%=${mean.meanYoungShare.toFixed(0)}`,
        `picks=${mean.meanDraftPicks.toFixed(1)}`,
        `devFac=${mean.meanDevFacilities.toFixed(1)}`,
      ].join("  "),
    );
  }

  console.log("\n=== Sample posture / preference debug ===\n");
  const samples = Object.keys(state.world.teams)
    .sort()
    .slice(0, 6) as TeamId[];
  for (const teamId of samples) {
    const resolved = resolveFranchisePreferences(state, teamId);
    const ops = state.business.franchiseOps[teamId];
    if (!resolved || !ops) {
      continue;
    }
    console.log(
      `${teamId} profile=${ops.aiProfile} posture=${resolved.posture} ` +
        `spend=${resolved.preferences.spendWillingness.toFixed(2)} ` +
        `cash=${resolved.preferences.cashPreservation.toFixed(2)} ` +
        `youth=${resolved.preferences.youthValue.toFixed(2)} ` +
        `mkt=${resolved.preferences.marketingPriority.toFixed(2)} ` +
        `window=${resolved.trajectory.competitiveWindow.toFixed(2)} ` +
        `rebuild=${resolved.trajectory.rebuildPressure.toFixed(2)}`,
    );
  }

  console.log("\n=== Franchise history arcs (last 3 seasons if present) ===\n");
  for (const teamId of samples) {
    const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
    const recent = seasons.slice(-3);
    const ops = state.business.franchiseOps[teamId];
    if (!ops || recent.length === 0) {
      console.log(`${teamId} (${ops?.aiProfile ?? "?"}): no history yet`);
      continue;
    }
    const arc = recent
      .map(
        (season) =>
          `${season.seasonYear}:${season.wins}-${season.losses}` +
          ` att=${season.attendance ?? "-"}` +
          ` cash=${Math.round(season.cash / 1_000_000)}M` +
          ` val=${Math.round(season.franchiseValue / 1_000_000)}M`,
      )
      .join(" | ");
    console.log(`${teamId} (${ops.aiProfile}): ${arc}`);
  }
}

const seasonsArg = Number(process.argv[2] ?? "2");
const seed = Number(process.argv[3] ?? "42");
const daysPerSeasonApprox = 200;
const days = Math.max(1, Math.round(seasonsArg * daysPerSeasonApprox));

console.log(
  `Behavioral harness: seed=${seed} seasons≈${seasonsArg} days=${days}`,
);

let state = createInitialGameState({
  saveId: "behavioral_harness",
  rngSeed: seed,
  settings: CBL_GAME_SETTINGS,
});
const rng = createSeededRng(state.meta.rngState);
state = bootstrapWorld(state, rng).state;
state = assignDistinctProfiles(state);
state = advanceDays(state, days);
summarizeHistory(state);

console.log(
  "\nInterpretation: compare marketing/payroll/youth/picks by profile.",
);
console.log(
  "If fingerprints converge, identity inertia or trajectory wiring needs tuning.",
);
