/**
 * Keeps jersey numbers unique within each franchise, NBA style. A
 * franchise's players are its non-retired players with that teamId
 * (top-league roster and development-league assignees).
 *
 * - A player keeps his number for as long as he stays with the franchise:
 *   players whose number is registered there (`jerseyTeamId`) go first, so
 *   a newcomer can never take it, even while the incumbent is in the
 *   Development League and off `Team.roster`.
 * - A newcomer keeps his previous number when it is free on his new team,
 *   otherwise he takes his next free number (src/domain/jersey-number.ts).
 *   Newcomers are ordered by roster position, then by id.
 * - Registration moves with the player to his new franchise and is cleared
 *   when he becomes a free agent, so a player who returns later is a
 *   newcomer again.
 *
 * Run on save and load and after every simulation advance, so every join
 * path (draft, free agency, trades, expansion, generation, custom content)
 * is covered without each one assigning numbers itself. Deterministic and
 * RNG-free; the simulation never reads jersey numbers.
 */
import { freeJerseyNumber } from "@/domain/jersey-number";
import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

type World = Pick<GameState["world"], "players" | "teams"> &
  Partial<Pick<GameState["world"], "retiredNumbers">>;

/** A franchise's players: registered incumbents first, then newcomers. */
function franchiseOrder(world: World, teamId: TeamId): Player[] {
  const members = Object.values(world.players).filter(
    (player) => player.teamId === teamId && player.retired !== true,
  );
  const rosterIndex = new Map(
    (world.teams[teamId]?.roster ?? []).map((id, index) => [id, index]),
  );
  const isIncumbent = (player: Player) => player.jerseyTeamId === teamId;
  return members.sort((a, b) => {
    const ia = isIncumbent(a);
    if (ia !== isIncumbent(b)) {
      return ia ? -1 : 1;
    }
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
  // Retired numbers are never issued again by that franchise.
  const taken = new Set<number>(
    (world.retiredNumbers?.[teamId] ?? []).map((entry) => entry.number),
  );
  const numbers = new Map<PlayerId, number>();
  for (const player of franchiseOrder(world, teamId)) {
    const number = freeJerseyNumber(player.id, player.jerseyNumber, taken);
    taken.add(number);
    numbers.set(player.id, number);
  }
  return numbers;
}

/**
 * Resolves duplicate (or missing) jersey numbers in every franchise and
 * registers each player's number with his franchise. Free agents lose their
 * registration. Returns the same state object when nothing changes.
 */
export function reconcileJerseyNumbers<S extends { world: World }>(
  state: S,
): S {
  let players: Record<PlayerId, Player> | null = null;
  const update = (playerId: PlayerId, next: Player) => {
    players ??= { ...state.world.players };
    players[playerId] = next;
  };

  for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
    for (const [playerId, number] of teamJerseyNumbers(state.world, teamId)) {
      const player = state.world.players[playerId]!;
      if (player.jerseyNumber !== number || player.jerseyTeamId !== teamId) {
        update(playerId, {
          ...player,
          jerseyNumber: number,
          jerseyTeamId: teamId,
        });
      }
    }
  }
  for (const player of Object.values(state.world.players)) {
    if (player.teamId === null && player.jerseyTeamId !== undefined) {
      const { jerseyTeamId: _released, ...freeAgent } = player;
      update(player.id, freeAgent);
    }
  }

  return players === null
    ? state
    : { ...state, world: { ...state.world, players } };
}
