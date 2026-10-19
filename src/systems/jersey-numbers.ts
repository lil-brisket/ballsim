/**
 * Keeps jersey numbers unique within each franchise. A franchise's players
 * are its non-retired players with that teamId (top-league roster and
 * development-league assignees). When two of them share a number, the one
 * who has been with the team longer keeps it: roster order (joins append),
 * then players off the roster by id. Everyone else takes his next free
 * number (src/domain/jersey-number.ts).
 *
 * Run on save and load, so every join path (draft, free agency, trades,
 * expansion, generation, custom content) is covered without each one
 * assigning numbers itself. Deterministic and RNG-free; the simulation never
 * reads jersey numbers.
 */
import { freeJerseyNumber } from "@/domain/jersey-number";
import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

type World = Pick<GameState["world"], "players" | "teams">;

/** A franchise's players, longest-serving first. */
function franchiseOrder(world: World, teamId: TeamId): Player[] {
  const members = Object.values(world.players).filter(
    (player) => player.teamId === teamId && player.retired !== true,
  );
  const rosterIndex = new Map(
    (world.teams[teamId]?.roster ?? []).map((id, index) => [id, index]),
  );
  return members.sort((a, b) => {
    const ra = rosterIndex.get(a.id) ?? Number.POSITIVE_INFINITY;
    const rb = rosterIndex.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) {
      return ra - rb;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * The number each of a franchise's players wears after duplicates are
 * resolved. Screens use this so they always agree with what is saved.
 */
export function teamJerseyNumbers(
  world: World,
  teamId: TeamId,
): Map<PlayerId, number> {
  const taken = new Set<number>();
  const numbers = new Map<PlayerId, number>();
  for (const player of franchiseOrder(world, teamId)) {
    const number = freeJerseyNumber(player.id, player.jerseyNumber, taken);
    taken.add(number);
    numbers.set(player.id, number);
  }
  return numbers;
}

/**
 * Resolves duplicate (or missing) jersey numbers in every franchise.
 * Returns the same state object when nothing changes.
 */
export function reconcileJerseyNumbers<S extends { world: World }>(
  state: S,
): S {
  let players: Record<PlayerId, Player> | null = null;
  for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
    for (const [playerId, number] of teamJerseyNumbers(state.world, teamId)) {
      const player = state.world.players[playerId]!;
      if (player.jerseyNumber !== number) {
        players ??= { ...state.world.players };
        players[playerId] = { ...player, jerseyNumber: number };
      }
    }
  }
  return players === null
    ? state
    : { ...state, world: { ...state.world, players } };
}
