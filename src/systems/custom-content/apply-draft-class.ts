import {
  createDraftProspect,
  type DraftProspect,
} from "@/domain/entities/draft";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createPlayerFromSource } from "@/systems/custom-content/create-player-from-source";
import type { DraftClassPackage } from "@/systems/custom-content/package-types";

export function buildDraftProspectsFromPackage(
  pkg: DraftClassPackage,
): Record<string, DraftProspect> {
  const ranked = pkg.payload.prospects.map((source) => {
    const player = createPlayerFromSource({
      contentId: pkg.contentId,
      source,
      teamId: null,
      contractId: null,
    });
    return {
      player,
      overall: calculatePlayerOverall(player.position, player.attributes),
    };
  });
  ranked.sort((left, right) => {
    if (left.overall !== right.overall) {
      return right.overall - left.overall;
    }
    return left.player.id < right.player.id
      ? -1
      : left.player.id > right.player.id
        ? 1
        : 0;
  });
  const prospects: Record<string, DraftProspect> = {};
  for (let rank = 0; rank < ranked.length; rank += 1) {
    const entry = ranked[rank]!;
    const prospect = createDraftProspect({
      player: entry.player,
      ranking: rank + 1,
      status: "eligible",
    });
    prospects[prospect.playerId] = prospect;
  }
  return prospects;
}
