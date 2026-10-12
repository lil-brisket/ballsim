/**
 * Side-by-side possession vs box_score comparison on the Lab `normal` scenario.
 *
 * Run: npx tsx scripts/fidelity-compare.ts [games=200] [seed=42]
 */
import {
  createLabGameSession,
  playLabGame,
} from "@/simulation/lab/lab-game-session";
import type { GameSimulationFidelity } from "@/systems/game-simulation";

const games = Number(process.argv[2] ?? 200);
const seed = Number(process.argv[3] ?? 42);

function run(fidelity: GameSimulationFidelity) {
  const session = createLabGameSession({ seed, games, fidelity });
  const t = {
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    pts: 0,
    ast: 0,
    reb: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    min: 0,
    teams: 0,
    poss: 0,
  };
  const scores: number[] = [];
  const diffs: number[] = [];
  for (let i = 0; i < games; i++) {
    const { result } = playLabGame(session, i);
    if (!result) continue;
    t.teams += 2;
    scores.push(result.score.home, result.score.away);
    diffs.push(Math.abs(result.score.home - result.score.away));
    t.poss += result.possessionCounts.home + result.possessionCounts.away;
    t.pts += result.score.home + result.score.away;
    for (const p of result.playerStats) {
      t.fgm += p.fieldGoalsMade;
      t.fga += p.fieldGoalsAttempted;
      t.tpm += p.threePointersMade;
      t.tpa += p.threePointersAttempted;
      t.ftm += p.freeThrowsMade;
      t.fta += p.freeThrowsAttempted;
      t.ast += p.assists;
      t.reb += p.rebounds;
      t.stl += p.steals;
      t.blk += p.blocks;
      t.tov += p.turnovers;
      t.min += p.minutes;
    }
  }
  const n = t.teams;
  const m = t.pts / n;
  return {
    POSS: t.poss / n,
    PPGsd: Math.sqrt(
      scores.reduce((a, x) => a + (x - m) ** 2, 0) / scores.length,
    ),
    absDiff: diffs.reduce((a, x) => a + x, 0) / diffs.length,
    "FG%": t.fgm / t.fga,
    "3P%": t.tpm / t.tpa,
    "FT%": t.ftm / t.fta,
    PPG: t.pts / n,
    FGA: t.fga / n,
    "3PA": t.tpa / n,
    FTA: t.fta / n,
    AST: t.ast / n,
    REB: t.reb / n,
    STL: t.stl / n,
    BLK: t.blk / n,
    TO: t.tov / n,
    MIN: t.min / n,
  } as Record<string, number>;
}

const a = run("possession");
const b = run("box_score");
console.log(`games=${games} seed=${seed}`);
console.log(
  "metric".padEnd(8),
  "possession".padStart(11),
  "box_score".padStart(11),
);
for (const k of Object.keys(a)) {
  console.log(
    k.padEnd(8),
    a[k].toFixed(3).padStart(11),
    b[k].toFixed(3).padStart(11),
  );
}
