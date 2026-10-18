import { PLAYER_POSITIONS, type Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";

/**
 * Who guards whom. Both lineups are ordered by position (PG -> C, lineup
 * order breaking ties) and each offensive player is guarded by the defender
 * in the same slot. With `switchChance` a random defender contests instead
 * (switches, scrambles). On two-point shots, with `rimHelpChance` the
 * defense's best shot blocker rotates over to contest.
 */
export const DEFENSIVE_MATCHUP_CONFIG = {
  switchChance: 0.2,
  rimHelpChance: 0.25,
} as const;

/**
 * Defender on the play for `offensivePlayer`. Draws exactly one RNG value,
 * like the uniform pick it replaces: values below `switchChance` are rescaled
 * into a uniform pick of the defense, and with `rimHelp` the next
 * `rimHelpChance` of the range goes to the best shot blocker.
 */
export function pickMatchedDefender(
  offensivePlayer: Player,
  offensivePlayers: readonly Player[],
  defensivePlayers: readonly Player[],
  rng: Rng,
  rimHelp = false,
): Player {
  if (defensivePlayers.length === 0) {
    throw new Error("pickMatchedDefender requires defensive players.");
  }
  const roll = rng.next();
  const { switchChance } = DEFENSIVE_MATCHUP_CONFIG;
  if (roll < switchChance) {
    const index = Math.floor((roll / switchChance) * defensivePlayers.length);
    return defensivePlayers[Math.min(index, defensivePlayers.length - 1)]!;
  }
  if (rimHelp && roll < switchChance + DEFENSIVE_MATCHUP_CONFIG.rimHelpChance) {
    return bestShotBlocker(defensivePlayers);
  }
  const slot = byPosition(offensivePlayers).indexOf(offensivePlayer);
  const defense = byPosition(defensivePlayers);
  return defense[Math.min(Math.max(slot, 0), defense.length - 1)]!;
}

function byPosition(players: readonly Player[]): Player[] {
  return [...players].sort(
    (a, b) =>
      PLAYER_POSITIONS.indexOf(a.position) -
      PLAYER_POSITIONS.indexOf(b.position),
  );
}

function bestShotBlocker(players: readonly Player[]): Player {
  let best = players[0]!;
  for (const player of players) {
    if (player.attributes.block > best.attributes.block) {
      best = player;
    }
  }
  return best;
}
