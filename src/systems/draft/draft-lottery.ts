/**
 * Draft lottery for teams that missed the playoffs.
 *
 * Lottery teams are ranked worst record first and given weights from the
 * odds preset. The top `picksDrawn` first-round slots are drawn one at a
 * time, each draw weighted among the teams still in it (no replacement);
 * the rest of the lottery teams follow in reverse standings, then playoff
 * teams. The draw uses its own seeded stream (`draft-lottery:<year>` from
 * the save seed), so it never shifts the main RNG.
 *
 * The result is stored on the draft class, so it is shown, not recomputed.
 * Pick assets (traded picks) resolve after the draw: the slot belongs to
 * whoever owns that team's pick.
 */

import type {
  DraftLotteryOddsPreset,
  DraftLotteryResult,
} from "@/domain/entities/draft-lottery";
import type { TeamId } from "@/domain/ids";
import { createSeededRng, type Rng } from "@/domain/rng";
import { deriveSeed } from "@/domain/rng/derive-seed";
import type { GameState } from "@/state/game-state";

/**
 * Flattened odds (per 1,000 combinations), worst record first. The three
 * worst teams share the best odds so finishing last stops being a plan.
 */
export const FLATTENED_LOTTERY_WEIGHTS: readonly number[] = [
  140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5,
];

/** Odds per team for `count` lottery teams, worst record first; sums to 1. */
export function lotteryOddsTable(
  count: number,
  preset: DraftLotteryOddsPreset,
): number[] {
  if (count <= 0) return [];
  const raw: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (preset === "weighted") {
      raw.push(count - i);
    } else {
      raw.push(
        FLATTENED_LOTTERY_WEIGHTS[i] ??
          FLATTENED_LOTTERY_WEIGHTS[FLATTENED_LOTTERY_WEIGHTS.length - 1]!,
      );
    }
  }
  const total = raw.reduce((sum, w) => sum + w, 0);
  return raw.map((w) => w / total);
}

/**
 * Draw `picksDrawn` winners from teams (worst record first) with the given
 * odds, without replacement. Returns the full lottery order: drawn winners,
 * then the others in their original order.
 */
export function drawLottery<T>(
  teams: readonly T[],
  odds: readonly number[],
  picksDrawn: number,
  rng: Rng,
): T[] {
  const remaining = teams.map((team, i) => ({ team, weight: odds[i] ?? 0 }));
  const drawn: T[] = [];
  const draws = Math.min(picksDrawn, teams.length);
  for (let d = 0; d < draws; d += 1) {
    const total = remaining.reduce((sum, r) => sum + r.weight, 0);
    let roll = rng.next() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i += 1) {
      roll -= remaining[i]!.weight;
      if (roll < 0) {
        index = i;
        break;
      }
    }
    drawn.push(remaining[index]!.team);
    remaining.splice(index, 1);
  }
  return [...drawn, ...remaining.map((r) => r.team)];
}

/**
 * Probability of each final lottery slot for each team, worst record first:
 * `matrix[team][slot]`. Exact (enumerates the draws), memoized; used by
 * trade valuation to project pick positions.
 */
export function lotterySlotProbabilities(
  count: number,
  preset: DraftLotteryOddsPreset,
  picksDrawn: number,
): number[][] {
  const key = `${count}:${preset}:${picksDrawn}`;
  const cached = slotCache.get(key);
  if (cached) return cached;
  const odds = lotteryOddsTable(count, preset);
  const matrix = Array.from({ length: count }, () =>
    new Array<number>(count).fill(0),
  );
  const draws = Math.min(picksDrawn, count);
  const walk = (taken: number[], probability: number) => {
    if (taken.length === draws) {
      const order = [
        ...taken,
        ...odds.map((_, i) => i).filter((i) => !taken.includes(i)),
      ];
      order.forEach((team, slot) => {
        matrix[team]![slot]! += probability;
      });
      return;
    }
    const left = odds
      .map((w, i) => ({ w, i }))
      .filter(({ i }) => !taken.includes(i));
    const total = left.reduce((sum, { w }) => sum + w, 0);
    for (const { w, i } of left) {
      if (w <= 0) continue;
      walk([...taken, i], probability * (w / total));
    }
  };
  walk([], 1);
  slotCache.set(key, matrix);
  return matrix;
}

const slotCache = new Map<string, number[][]>();

/** Teams in the lottery: those that did not make the playoffs. */
export function lotteryTeamsWorstFirst(state: GameState): TeamId[] {
  const playoffTeams = new Set<string>();
  for (const series of state.competition.playoffs.series ?? []) {
    if (series.higherSeedTeamId) playoffTeams.add(series.higherSeedTeamId);
    if (series.lowerSeedTeamId) playoffTeams.add(series.lowerSeedTeamId);
    if (series.byeParticipant) playoffTeams.add(series.byeParticipant.teamId);
  }
  const teams = (Object.keys(state.world.teams) as TeamId[]).filter(
    (id) => !playoffTeams.has(id),
  );
  return rankWorstFirst(state, teams);
}

export function rankWorstFirst(state: GameState, teamIds: TeamId[]): TeamId[] {
  const standings = state.competition.standings.byTeamId;
  return [...teamIds].sort((a, b) => {
    const wa = standings[a]?.wins ?? 0;
    const wb = standings[b]?.wins ?? 0;
    if (wa !== wb) return wa - wb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

export function isDraftLotteryEnabled(state: GameState): boolean {
  return state.settings.draftLottery?.enabled === true;
}

/**
 * Run the lottery for a draft year. Null when the lottery is off or fewer
 * than two teams missed the playoffs.
 */
export function runDraftLottery(
  state: GameState,
  draftYear: number,
): DraftLotteryResult | null {
  if (!isDraftLotteryEnabled(state)) return null;
  const teams = lotteryTeamsWorstFirst(state);
  if (teams.length < 2) return null;
  const { oddsPreset, picksDrawn } = state.settings.draftLottery;
  const odds = lotteryOddsTable(teams.length, oddsPreset);
  const rng = createSeededRng(
    deriveSeed(state.meta.rngSeed, `draft-lottery:${draftYear}`),
  );
  const order = drawLottery(teams, odds, picksDrawn, rng);
  return {
    draftYear,
    oddsPreset,
    picksDrawn: Math.min(picksDrawn, teams.length),
    preLotteryOrder: teams,
    odds,
    finalOrder: order,
    heldOn: state.world.calendar.currentDate,
  };
}
