import {
  createDraftProspect,
  type DraftProspect,
} from "@/domain/entities/draft";
import { asPlayerId, type DraftClassId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import {
  DRAFT_EXTRA_PROSPECTS_PER_TEAM,
  DRAFT_LATE_STEAL_CHANCE,
  DRAFT_LATE_STEAL_QUALITY_MAX,
  DRAFT_LATE_STEAL_QUALITY_MIN,
  DRAFT_QUALITY_BY_PICK_BAND,
  MAX_DRAFT_PROSPECT_AGE,
  MIN_DRAFT_PROSPECT_AGE,
} from "@/systems/draft-config";
import { generatePlayerWithRng } from "@/systems/player-generation";
import { countDraftPicksForYear } from "@/systems/draft/draft-order";
import type { GameState } from "@/state/game-state";

/**
 * Generates ranked prospect snapshots for a draft class.
 * Players are NOT inserted into world.players.
 * Each prospect.playerId is the permanent future PlayerId.
 */
export function generateDraftProspects(
  state: GameState,
  rng: Rng,
  draftClassId: DraftClassId,
  draftYear: number,
): Record<string, DraftProspect> {
  const pickCount = countDraftPicksForYear(state, draftYear);
  if (pickCount < 1) {
    throw new Error(
      `Cannot generate prospects: no draft picks for seasonYear ${draftYear}.`,
    );
  }
  const teamCount = Object.keys(state.world.teams).length;
  if (teamCount < 1) {
    throw new Error("Cannot generate prospects: no teams in world.");
  }
  const prospectCount = pickCount + teamCount * DRAFT_EXTRA_PROSPECTS_PER_TEAM;
  const occupiedNames = new Set<string>();
  for (const player of Object.values(state.world.players)) {
    if (player.retired === true) continue;
    occupiedNames.add(`${player.firstName} ${player.lastName}`);
  }

  const generated: Array<{
    playerId: ReturnType<typeof asPlayerId>;
    player: ReturnType<typeof generatePlayerWithRng>;
    overall: number;
  }> = [];

  for (let index = 0; index < prospectCount; index += 1) {
    const playerId = asPlayerId(`prospect_${draftClassId}_${index}`);
    const age = rng.nextInt(MIN_DRAFT_PROSPECT_AGE, MAX_DRAFT_PROSPECT_AGE);
    const intendedPick = index + 1;
    const band =
      DRAFT_QUALITY_BY_PICK_BAND.find((entry) => intendedPick <= entry.maxPick) ??
      DRAFT_QUALITY_BY_PICK_BAND[DRAFT_QUALITY_BY_PICK_BAND.length - 1]!;
    const steal =
      intendedPick > 45 && rng.next() < DRAFT_LATE_STEAL_CHANCE;
    const quality = steal
      ? rng.nextInt(DRAFT_LATE_STEAL_QUALITY_MIN, DRAFT_LATE_STEAL_QUALITY_MAX)
      : rng.nextInt(band.qualityMin, band.qualityMax);
    const player = generatePlayerWithRng(rng, {
      id: playerId,
      teamId: null,
      contractId: null,
      age,
      quality,
      occupiedNames,
      potentialGap: { min: band.potMin, max: band.potMax },
    });
    occupiedNames.add(`${player.firstName} ${player.lastName}`);
    generated.push({
      playerId,
      player,
      overall: calculatePlayerOverall(player.position, player.attributes),
    });
  }

  generated.sort((left, right) => {
    if (left.overall !== right.overall) {
      return right.overall - left.overall;
    }
    return left.playerId < right.playerId
      ? -1
      : left.playerId > right.playerId
        ? 1
        : 0;
  });

  const prospects: Record<string, DraftProspect> = {};
  for (let rank = 0; rank < generated.length; rank += 1) {
    const entry = generated[rank]!;
    const prospect = createDraftProspect({
      player: entry.player,
      ranking: rank + 1,
      status: "eligible",
    });
    prospects[prospect.playerId] = prospect;
  }

  return prospects;
}
