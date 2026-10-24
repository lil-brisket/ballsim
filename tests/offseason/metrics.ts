/**
 * Offseason balance metrics: runs one delegated CBL league through the real
 * engine, one phase at a time, and keeps RAW per-season samples. The pure
 * aggregation, tolerance rule and baseline comparison live in
 * `balance-stats.ts` (re-exported here).
 *
 * Metric definitions are in `METRIC_SPECS` (balance-stats.ts). Where a metric
 * cannot be read straight from a state, the choice made is:
 *
 * - Development: players that are not retired in both the
 *   `offseason.season_transition` state (before development and the age
 *   rollover) and the `offseason.roster_decisions` state (after), whether
 *   rostered, in the Development League or free agents. Age bucket is the age
 *   before development. Overall is `calculatePlayerOverall`.
 * - "Signed in free agency": a player in the free-agent pool at the start of
 *   `offseason.free_agency` who is on a team roster at the start of
 *   `offseason.staff_development`. Salary is his contract salary for the
 *   coverage year (season year + 1 during the offseason).
 * - "Best free agent": highest overall at free_agency start, then potential,
 *   then younger age, then attribute sum (ids are random and never compared).
 *   "Highest payroll" is the league's highest payroll for the coverage year
 *   at free_agency start, before the signings; a tie for first counts.
 * - Season-end economy is read at `postseason.season_review`, when regular
 *   season standings are final. Payroll is that season's.
 * - Draft: the class drafted in the offseason (`draftYearForSeason`), read at
 *   free_agency start when it is complete. Rookie overall is the overall of
 *   the drafted player at that moment. "Starter" is judged at the next
 *   `preseason.preparation`.
 */

import { draftClassIdFor } from "@/domain/entities/draft";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Player } from "@/domain/entities/player";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import { listFreeAgents } from "@/systems/free-agency";
import { getActivePhaseId, type LeaguePhaseId } from "@/systems/phase-engine";
import { getTeamPayroll } from "@/systems/salary-cap";
import { advanceThroughPhase, createOffseasonLeague } from "./driver";
import { contractCoverageYear } from "./invariants";
import { ageBucket } from "./snapshot";
import {
  salaryTier,
  type SeasonSample,
  type SeedSamples,
} from "./balance-stats";

export * from "./balance-stats";

function overallOf(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function rosterTeamByPlayer(state: GameState): Map<string, string> {
  const map = new Map<string, string>();
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    for (const playerId of team.roster) map.set(playerId, teamId);
  }
  return map;
}

function activePlayers(state: GameState): Player[] {
  return Object.values(state.world.players).filter((p) => p.retired !== true);
}

function count90Plus(state: GameState): number {
  return activePlayers(state).filter((p) => overallOf(p) >= 90).length;
}

function attributeSum(player: Player): number {
  return Object.values(player.attributes).reduce<number>(
    (sum, v) => sum + (typeof v === "number" ? v : 0),
    0,
  );
}

type Cycle = Partial<Record<LeaguePhaseId, GameState>>;

const WATCHED: readonly LeaguePhaseId[] = [
  "postseason.season_review",
  "offseason.season_transition",
  "offseason.roster_decisions",
  "offseason.free_agency",
  "offseason.staff_development",
];

function need(cycle: Cycle, phase: LeaguePhaseId): GameState {
  const state = cycle[phase];
  if (state === undefined) {
    throw new Error(`Season cycle never reached ${phase}.`);
  }
  return state;
}

function sampleSeason(
  seasonIndex: number,
  start: GameState,
  cycle: Cycle,
  next: GameState,
): SeasonSample {
  const review = need(cycle, "postseason.season_review");
  const before = need(cycle, "offseason.season_transition");
  const after = need(cycle, "offseason.roster_decisions");
  const faStart = need(cycle, "offseason.free_agency");
  const staffStart = need(cycle, "offseason.staff_development");
  const seasonYear = review.competition.season.year;

  // Development.
  const development: SeasonSample["development"] = [];
  for (const player of activePlayers(before)) {
    const later = after.world.players[player.id];
    if (later === undefined || later.retired === true) continue;
    development.push({
      bucket: ageBucket(player.age),
      change: overallOf(later) - overallOf(player),
    });
  }

  // Economy at season end.
  const teamIds = Object.keys(review.world.teams).sort();
  const teams: SeasonSample["teams"] = teamIds.map((teamId) => ({
    winPct:
      review.competition.standings.byTeamId[teamId as never]?.winPercentage ??
      0,
    payroll: getTeamPayroll(teamId as never, seasonYear, review),
    cash: review.business.finances[teamId as never]?.businessFunds ?? 0,
  }));
  const cashAfterOffseason = teamIds.map(
    (teamId) => next.business.finances[teamId as never]?.businessFunds ?? 0,
  );

  // Free agency.
  const poolAtStart = listFreeAgents(faStart).playerIds;
  const teamAtStaff = rosterTeamByPlayer(staffStart);
  const coverage = contractCoverageYear(staffStart);
  const faSignings: SeasonSample["faSignings"] = [];
  for (const playerId of poolAtStart) {
    const player = staffStart.world.players[playerId];
    if (player === undefined || !teamAtStaff.has(playerId)) continue;
    const contract =
      player.contractId === null
        ? undefined
        : staffStart.business.contracts[player.contractId];
    if (contract === undefined) continue;
    const salary =
      contract.salaryByYear[String(coverage)] ??
      Object.values(contract.salaryByYear)[0] ??
      0;
    faSignings.push({ tier: salaryTier(overallOf(player)), salary });
  }

  let topFa: SeasonSample["topFa"] = null;
  const pool = poolAtStart
    .map((id) => faStart.world.players[id])
    .filter((p): p is Player => p !== undefined);
  if (pool.length > 0) {
    const best = [...pool].sort(
      (a, b) =>
        overallOf(b) - overallOf(a) ||
        b.potential.overall - a.potential.overall ||
        a.age - b.age ||
        attributeSum(b) - attributeSum(a),
    )[0]!;
    const signedTeam = teamAtStaff.get(best.id);
    if (signedTeam === undefined) {
      topFa = { signed: false, toHighestPayroll: false };
    } else {
      const faYear = contractCoverageYear(faStart);
      const payrolls = Object.keys(faStart.world.teams).map((teamId) => ({
        teamId,
        payroll: getTeamPayroll(teamId as never, faYear, faStart),
      }));
      const max = Math.max(...payrolls.map((p) => p.payroll));
      const own = payrolls.find((p) => p.teamId === signedTeam)?.payroll ?? 0;
      topFa = { signed: true, toHighestPayroll: own >= max };
    }
  }

  // Next preseason: pool, stars, churn.
  const unsigned = listFreeAgents(next).playerIds;
  const unsignedAtPreseason60Plus = unsigned.filter((id) => {
    const player = next.world.players[id];
    return player !== undefined && overallOf(player) >= 60;
  }).length;

  const teamNext = rosterTeamByPlayer(next);
  const starCounts = new Map<string, number>();
  let starTotal = 0;
  for (const [playerId, teamId] of teamNext) {
    const player = next.world.players[playerId as never];
    if (player === undefined || overallOf(player) < 80) continue;
    starTotal += 1;
    starCounts.set(teamId, (starCounts.get(teamId) ?? 0) + 1);
  }
  const sortedStars = [...starCounts.values()].sort((a, b) => b - a);

  const rosterTurnover: number[] = [];
  for (const teamId of teamIds) {
    const previous = start.world.teams[teamId as never]?.roster ?? [];
    if (previous.length === 0) continue;
    const gone = previous.filter((id) => teamNext.get(id) !== teamId).length;
    rosterTurnover.push(gone / previous.length);
  }

  // Draft.
  const draft =
    faStart.world.drafts[draftClassIdFor(draftYearForSeason(seasonYear))];
  const rookies: SeasonSample["rookies"] = [];
  const top5Picks: SeasonSample["top5Picks"] = [];
  for (const selection of draft?.selections ?? []) {
    const player = faStart.world.players[selection.playerId];
    if (player === undefined) continue;
    rookies.push({ pick: selection.overallPick, overall: overallOf(player) });
    if (selection.overallPick > 5) continue;
    const roster = next.world.teams[selection.teamId]?.roster ?? [];
    const now = next.world.players[selection.playerId];
    let starter = false;
    if (now !== undefined && roster.includes(selection.playerId)) {
      const mine = overallOf(now);
      const better = roster.filter((id) => {
        const mate = next.world.players[id];
        return (
          id !== selection.playerId &&
          mate !== undefined &&
          overallOf(mate) > mine
        );
      }).length;
      starter = better < 5;
    }
    top5Picks.push({ pick: selection.overallPick, starter });
  }

  return {
    seasonIndex,
    seasonYear,
    development,
    teams,
    cashAfterOffseason,
    unsignedAtPreseason: unsigned.length,
    unsignedAtPreseason60Plus,
    faSignings,
    topFa,
    starTotal,
    starMaxOnOneTeam: sortedStars[0] ?? 0,
    starTop4Count: sortedStars.slice(0, 4).reduce((a, b) => a + b, 0),
    rosterTurnover,
    rookies,
    top5Picks,
  };
}

export type CollectSeedOptions = {
  seed: number;
  seasons: number;
  /** Progress line per finished season (wall time in ms). */
  onSeason?: (seasonIndex: number, ms: number) => void;
  now?: () => number;
};

/**
 * Runs one delegated league for `seasons` full seasons (each: regular season,
 * postseason, then the offseason up to the next preseason start) and returns
 * the raw per-season samples.
 */
export function collectSeedMetrics(options: CollectSeedOptions): SeedSamples {
  const now = options.now ?? Date.now;
  let start = createOffseasonLeague(options.seed, "delegated");
  if (getActivePhaseId(start) !== "preseason.preparation") {
    throw new Error(
      `Expected a new league in preseason.preparation, got ${getActivePhaseId(start)}.`,
    );
  }
  const series = [count90Plus(start)];
  const seasons: SeasonSample[] = [];

  for (let index = 1; index <= options.seasons; index += 1) {
    const began = now();
    const cycle: Cycle = {};
    let current = start;
    do {
      const phase = getActivePhaseId(current);
      if (WATCHED.includes(phase)) cycle[phase] = current;
      current = advanceThroughPhase(current, phase).state;
    } while (getActivePhaseId(current) !== "preseason.preparation");
    seasons.push(sampleSeason(index, start, cycle, current));
    series.push(count90Plus(current));
    start = current;
    options.onSeason?.(index, now() - began);
  }
  return { seed: options.seed, overall90PlusSeries: series, seasons };
}
