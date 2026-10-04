import { collectPlaytestMetrics } from "../src/simulation/playtest/collect-playtest-metrics";
import { createInitialGameState } from "../src/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "../src/domain/game-settings";
import { bootstrapWorld } from "../src/systems/world-pipeline";
import { createSeededRng } from "../src/domain/rng";

const SEED = 42_001;

const state = bootstrapWorld(
  createInitialGameState({
    saveId: "playtest_baseline",
    rngSeed: SEED,
    nowIso: "2026-01-01T00:00:00.000Z",
    settings: CBL_GAME_SETTINGS,
  }),
  createSeededRng(SEED),
).state;

const metrics = collectPlaytestMetrics(state);
process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
