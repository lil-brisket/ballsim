/**
 * Compact, deterministic summary of a league for balance checks and
 * readable failure diffs.
 */

import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { listFreeAgents } from "@/systems/free-agency";
import { getActivePhaseId } from "@/systems/phase-engine";
import { getTeamPayroll } from "@/systems/salary-cap";
import { contractCoverageYear } from "./invariants";

export const AGE_BUCKETS = ["<=22", "23-26", "27-30", "31-33", "34+"] as const;

export type AgeBucket = (typeof AGE_BUCKETS)[number];

export type AgeBucketSummary = { count: number; meanOverall: number };

export type OffseasonSnapshot = {
  seasonYear: number;
  phaseId: string;
  date: string;
  activePlayers: number;
  retiredPlayers: number;
  /** Active players by age bucket (rostered, Development League and free agents). */
  byAge: Record<AgeBucket, AgeBucketSummary>;
  overall90Plus: number;
  freeAgentPool: number;
  /** Payroll for the season contracts must cover now. */
  payroll: { year: number; min: number; median: number; max: number };
  rosterSizes: { min: number; max: number; byTeam: Record<string, number> };
};

export function ageBucket(age: number): AgeBucket {
  if (age <= 22) return "<=22";
  if (age <= 26) return "23-26";
  if (age <= 30) return "27-30";
  if (age <= 33) return "31-33";
  return "34+";
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function snapshotOffseason(state: GameState): OffseasonSnapshot {
  const totals = new Map<AgeBucket, { count: number; sum: number }>();
  let activePlayers = 0;
  let retiredPlayers = 0;
  let overall90Plus = 0;
  for (const player of Object.values(state.world.players)) {
    if (player.retired === true) {
      retiredPlayers += 1;
      continue;
    }
    activePlayers += 1;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    if (overall >= 90) overall90Plus += 1;
    const bucket = ageBucket(player.age);
    const entry = totals.get(bucket) ?? { count: 0, sum: 0 };
    totals.set(bucket, { count: entry.count + 1, sum: entry.sum + overall });
  }
  const byAge = {} as Record<AgeBucket, AgeBucketSummary>;
  for (const bucket of AGE_BUCKETS) {
    const entry = totals.get(bucket) ?? { count: 0, sum: 0 };
    byAge[bucket] = {
      count: entry.count,
      meanOverall: entry.count === 0 ? 0 : round(entry.sum / entry.count),
    };
  }

  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  const year = contractCoverageYear(state);
  const payrolls = teamIds
    .map((teamId) => getTeamPayroll(teamId, year, state))
    .sort((a, b) => a - b);
  const byTeam: Record<string, number> = {};
  for (const teamId of teamIds) {
    byTeam[teamId] = state.world.teams[teamId]!.roster.length;
  }
  const sizes = Object.values(byTeam);

  return {
    seasonYear: state.competition.season.year,
    phaseId: getActivePhaseId(state),
    date: state.world.calendar.currentDate,
    activePlayers,
    retiredPlayers,
    byAge,
    overall90Plus,
    freeAgentPool: listFreeAgents(state).playerIds.length,
    payroll: {
      year,
      min: payrolls[0] ?? 0,
      median: payrolls[Math.floor(payrolls.length / 2)] ?? 0,
      max: payrolls.at(-1) ?? 0,
    },
    rosterSizes: {
      min: sizes.length === 0 ? 0 : Math.min(...sizes),
      max: sizes.length === 0 ? 0 : Math.max(...sizes),
      byTeam,
    },
  };
}

/**
 * The state with its wall-clock and random parts neutralised: event ids
 * (random UUID by design) become their position and type, and every
 * `generatedAt` timestamp (franchise reports) is blanked. Two runs of the
 * same seed and actions are equal only modulo those fields.
 */
export function stateForComparison(state: GameState): GameState {
  const blank = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(blank);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          key === "generatedAt" ? "" : blank(child),
        ]),
      );
    }
    return value;
  };
  const cleaned = blank(state) as GameState;
  return {
    ...cleaned,
    competition: {
      ...cleaned.competition,
      seasonEventLog: cleaned.competition.seasonEventLog.map(
        (event, index) => ({
          ...event,
          id: `evt_${index}_${event.type}` as typeof event.id,
        }),
      ),
    },
  };
}

function flatten(
  value: unknown,
  path: string,
  out: Map<string, unknown>,
): Map<string, unknown> {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, path === "" ? key : `${path}.${key}`, out);
    }
  } else {
    out.set(path, value);
  }
  return out;
}

/** One line per changed field, e.g. `freeAgentPool: 31 -> 12`. */
export function diffOffseasonSnapshots(
  before: OffseasonSnapshot,
  after: OffseasonSnapshot,
): string[] {
  const a = flatten(before, "", new Map());
  const b = flatten(after, "", new Map());
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  return keys
    .filter((key) => a.get(key) !== b.get(key))
    .map((key) => `${key}: ${String(a.get(key))} -> ${String(b.get(key))}`);
}
