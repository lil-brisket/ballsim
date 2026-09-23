import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { FanVoteCategory } from "@/domain/entities/season-events";
import type { GameState } from "@/state/game-state";
import type { Rng } from "@/domain/rng";
import type { PlayerId } from "@/domain/ids";
import { asPlayerId } from "@/domain/ids";
import { getPrimaryLeagueFinalGames } from "@/systems/awards/award-stat-sources";

const DAILY_VOTE_POOL = 50_000;
const VARIANCE_AMPLITUDE = 0.12; // RNG modulates, does not dominate

/**
 * Deterministic daily vote increments for one category.
 * Normalizes appeal weights across eligible candidates.
 */
export function computeDailyVoteIncrements(
  state: GameState,
  category: FanVoteCategory,
  rng: Rng,
  _tickDate: string,
): Map<PlayerId, number> {
  const weights = new Map<PlayerId, number>();
  let weightSum = 0;

  for (const playerId of Object.keys(category.candidates).sort()) {
    const candidate = category.candidates[playerId]!;
    const player = state.world.players[playerId];
    if (!player || player.retired) {
    weights.set(asPlayerId(playerId), 0);
      continue;
    }
    const teamId = candidate.teamId ?? player.teamId;
    const ops = teamId ? state.business.franchiseOps[teamId] : null;

    const overall = clamp01(
      calculatePlayerOverall(player.position, player.attributes) / 99,
    );
    const performance = performanceFactor(state, asPlayerId(playerId));
    const recent = recentFormFactor(state, asPlayerId(playerId));
    const popularity = clamp01((player.personality?.leadership ?? 50) / 100);
    const teamVisibility = clamp01((ops?.fanSentiment ?? 50) / 100);
    const market = clamp01((ops?.marketSize ?? 50) / 100);
    const media = clamp01((ops?.mediaAttention ?? 30) / 100);
    const awareness = clamp01((ops?.marketing.awareness ?? 40) / 100);

    const baseAppeal =
      0.35 * overall +
      0.2 * performance +
      0.15 * recent +
      0.1 * popularity +
      0.08 * teamVisibility +
      0.07 * market +
      0.05 * media;

    const variance = 1 + (rng.next() * 2 - 1) * VARIANCE_AMPLITUDE;
    const weight = Math.max(0.001, baseAppeal * (0.85 + 0.15 * awareness) * variance);
    weights.set(asPlayerId(playerId), weight);
    weightSum += weight;
  }

  const increments = new Map<PlayerId, number>();
  if (weightSum <= 0) {
    return increments;
  }

  let allocated = 0;
  const entries = [...weights.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  for (let i = 0; i < entries.length; i += 1) {
    const [playerId, weight] = entries[i]!;
    if (i === entries.length - 1) {
      increments.set(playerId, Math.max(0, DAILY_VOTE_POOL - allocated));
    } else {
      const share = Math.floor((weight / weightSum) * DAILY_VOTE_POOL);
      increments.set(playerId, share);
      allocated += share;
    }
  }
  return increments;
}

function performanceFactor(state: GameState, playerId: PlayerId): number {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  let points = 0;
  let count = 0;
  for (const game of games) {
    const row = game.playerStats.find((s) => s.playerId === playerId);
    if (!row) continue;
    points += row.points;
    count += 1;
  }
  if (count === 0) return 0.25;
  const ppg = points / count;
  return clamp01(ppg / 30);
}

function recentFormFactor(state: GameState, playerId: PlayerId): number {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  })
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  if (games.length === 0) return 0.25;
  let points = 0;
  let counted = 0;
  for (const game of games) {
    const row = game.playerStats.find((s) => s.playerId === playerId);
    if (!row) continue;
    points += row.points;
    counted += 1;
  }
  if (counted === 0) return 0.25;
  return clamp01(points / counted / 30);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
