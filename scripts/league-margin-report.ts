/**
 * Game margins in full simulated leagues (real schedules, rotations,
 * coaching), next to rough NBA reference points. Diagnostic, not a gate.
 *
 * Run:
 *   npx tsx scripts/league-margin-report.ts --leagues 3 --seed 42
 *   npx tsx scripts/league-margin-report.ts --fidelity box_score
 */

import { runLeagueCareer } from "@/simulation/league-sanity";
import {
  NBA_MARGIN_REFERENCE,
  summarizeGameMargins,
  type MarginSummary,
} from "@/simulation/league-sanity/margins";
import type { Game } from "@/domain/entities/game";
import type { GameSimulationFidelity } from "@/systems/game-simulation";

function parseArgs(argv: string[]): {
  leagues: number;
  seed: number;
  fidelities: GameSimulationFidelity[];
} {
  let leagues = 3;
  let seed = 42;
  let fidelity = "both";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === "--leagues" && next) {
      leagues = Number(next);
      i += 1;
    } else if (arg === "--seed" && next) {
      seed = Number(next);
      i += 1;
    } else if (arg === "--fidelity" && next) {
      fidelity = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx scripts/league-margin-report.ts [--leagues N] [--seed N] [--fidelity possession|box_score|both]",
      );
      process.exit(0);
    }
  }
  if (!Number.isInteger(leagues) || leagues < 1) {
    throw new Error("--leagues must be an integer >= 1");
  }
  if (!["possession", "box_score", "both"].includes(fidelity)) {
    throw new Error("--fidelity must be possession, box_score or both");
  }
  const fidelities: GameSimulationFidelity[] =
    fidelity === "both"
      ? ["possession", "box_score"]
      : [fidelity as GameSimulationFidelity];
  return { leagues, seed, fidelities };
}

/** One regular season per league; averages the per-league summaries. */
function measure(
  fidelity: GameSimulationFidelity,
  leagues: number,
  seed: number,
): MarginSummary {
  const summaries: MarginSummary[] = [];
  for (let index = 0; index < leagues; index += 1) {
    const started = Date.now();
    runLeagueCareer({
      seed: seed + index,
      seasons: 1,
      simulationIndex: index,
      gameFidelity: fidelity,
      onSeasonComplete: (state) => {
        const games = Object.values(state.competition.games).filter(
          (game: Game) => game.competitionType === "regular_season",
        );
        summaries.push(summarizeGameMargins(games));
      },
    });
    console.error(
      `  ${fidelity} league ${index + 1}/${leagues} (${((Date.now() - started) / 1000).toFixed(0)}s)`,
    );
  }
  const keys = Object.keys(summaries[0]!) as (keyof MarginSummary)[];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      summaries.reduce((sum, summary) => sum + summary[key], 0) /
        summaries.length,
    ]),
  ) as MarginSummary;
}

const ROWS: { key: keyof MarginSummary; label: string; pct?: boolean }[] = [
  { key: "games", label: "games / league" },
  { key: "teamPoints", label: "team PPG" },
  { key: "meanAbsMargin", label: "mean |margin|" },
  { key: "marginSd", label: "margin SD" },
  { key: "residualMarginSd", label: "noise SD (strength removed)" },
  { key: "blowoutShare", label: "decided by 20+", pct: true },
  { key: "closeShare", label: "decided by <= 3", pct: true },
  { key: "overtimeShare", label: "overtime", pct: true },
  { key: "homeWinShare", label: "home wins", pct: true },
  { key: "homeEdge", label: "home edge (pts)" },
  { key: "winPctSd", label: "team win% SD" },
  { key: "bestWinPct", label: "best win%", pct: true },
  { key: "worstWinPct", label: "worst win%", pct: true },
];

const args = parseArgs(process.argv.slice(2));
console.error(
  `League margins: leagues=${args.leagues} seed=${args.seed} fidelity=${args.fidelities.join(",")}`,
);
const results = args.fidelities.map((fidelity) => ({
  fidelity,
  summary: measure(fidelity, args.leagues, args.seed),
}));

const format = (value: number | undefined, pct?: boolean) =>
  value == null
    ? "-"
    : pct
      ? `${(value * 100).toFixed(1)}%`
      : value.toFixed(value >= 100 ? 0 : 2);
const reference = NBA_MARGIN_REFERENCE as Partial<Record<string, number>>;

console.log(
  [
    "metric".padEnd(30),
    ...results.map((r) => r.fidelity.padStart(12)),
    "NBA (approx)".padStart(14),
  ].join(""),
);
for (const row of ROWS) {
  console.log(
    [
      row.label.padEnd(30),
      ...results.map((r) => format(r.summary[row.key], row.pct).padStart(12)),
      format(reference[row.key], row.pct).padStart(14),
    ].join(""),
  );
}
