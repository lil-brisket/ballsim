import {
  createEmptyFantasyDraft,
  type FantasyDraft,
} from "@/domain/entities/fantasy-draft";
import {
  PLAYER_POSITIONS,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { asPlayerId, type PlayerId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  computeFantasyPoolSize,
  computeFantasyTotalPicks,
  FANTASY_DRAFT_PICKS_PER_TEAM,
  FANTASY_POOL_POSITION_SHARE_MAX,
  FANTASY_POOL_POSITION_SHARE_MIN,
} from "@/systems/fantasy-draft/fantasy-draft-config";
import { generatePlayerWithRng } from "@/systems/player-generation";

/**
 * Generates an oversupplied, position-balanced fantasy draft player pool.
 * Teams keep empty rosters. Players have teamId/contractId null until drafted.
 * Idempotent: no-op when players already exist.
 */
export function generateFantasyPlayerPool(
  state: GameState,
  rng: Rng,
): SystemResult {
  if (Object.keys(state.world.players).length > 0) {
    return systemResult(state);
  }

  const teamCount = Object.keys(state.world.teams).length;
  if (teamCount < 1) {
    throw new Error("Cannot generate fantasy player pool: no teams.");
  }

  const poolSize = computeFantasyPoolSize(teamCount);
  const totalPicks = computeFantasyTotalPicks(teamCount);
  if (poolSize <= totalPicks) {
    throw new Error(
      `Fantasy pool size (${poolSize}) must exceed total picks (${totalPicks}).`,
    );
  }

  const positions = allocateBalancedPositions(poolSize, rng);
  const players: Record<string, Player> = {};
  const poolPlayerIds: PlayerId[] = [];

  for (let index = 0; index < poolSize; index += 1) {
    const playerId = asPlayerId(`fantasy_pool_${index}`);
    const position = positions[index]!;
    const player = generatePlayerWithRng(rng, {
      id: playerId,
      teamId: null,
      contractId: null,
      position,
    });
    players[playerId] = player;
    poolPlayerIds.push(playerId);
  }

  assertPositionBalance(positions);

  const draftSettings = state.settings.draft;
  const fantasyDraft: FantasyDraft = createEmptyFantasyDraft({
    draftType: draftSettings.type ?? "snake",
    orderMode: draftSettings.orderMode ?? "random",
    picksPerTeam: FANTASY_DRAFT_PICKS_PER_TEAM,
    totalPicks,
    poolPlayerIds,
    timerSeconds: draftSettings.timerSeconds ?? null,
  });

  // Teams remain empty — do not assign players yet.
  const teams = { ...state.world.teams };

  return systemResult({
    ...state,
    world: {
      ...state.world,
      players,
      teams,
      fantasyDraft,
    },
  });
}

/**
 * Builds a near-even position list (~20% each) with natural RNG variation,
 * then shuffles so generation order is not position-clustered.
 */
function allocateBalancedPositions(
  poolSize: number,
  rng: Rng,
): PlayerPosition[] {
  const base = Math.floor(poolSize / PLAYER_POSITIONS.length);
  const remainder = poolSize % PLAYER_POSITIONS.length;
  const positions: PlayerPosition[] = [];
  for (let i = 0; i < PLAYER_POSITIONS.length; i += 1) {
    const count = base + (i < remainder ? 1 : 0);
    for (let n = 0; n < count; n += 1) {
      positions.push(PLAYER_POSITIONS[i]!);
    }
  }
  // Fisher-Yates shuffle
  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    const tmp = positions[i]!;
    positions[i] = positions[j]!;
    positions[j] = tmp;
  }
  return positions;
}

function assertPositionBalance(positions: readonly PlayerPosition[]): void {
  const counts = new Map<PlayerPosition, number>();
  for (const position of PLAYER_POSITIONS) {
    counts.set(position, 0);
  }
  for (const position of positions) {
    counts.set(position, (counts.get(position) ?? 0) + 1);
  }
  const total = positions.length;
  for (const position of PLAYER_POSITIONS) {
    const share = (counts.get(position) ?? 0) / total;
    if (
      share < FANTASY_POOL_POSITION_SHARE_MIN ||
      share > FANTASY_POOL_POSITION_SHARE_MAX
    ) {
      throw new Error(
        `Fantasy pool position "${position}" share ${share.toFixed(3)} outside [${FANTASY_POOL_POSITION_SHARE_MIN}, ${FANTASY_POOL_POSITION_SHARE_MAX}].`,
      );
    }
  }
}
