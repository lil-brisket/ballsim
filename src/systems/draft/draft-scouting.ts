import {
  createDraftScoutReport,
  type DraftProspect,
  type DraftScoutReport,
} from "@/domain/entities/draft";
import {
  PLAYER_ATTRIBUTE_KEYS,
  RATING_MAX,
  RATING_MIN,
  type PlayerAttributes,
} from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import {
  DRAFT_SCOUT_ATTRIBUTE_NOISE,
  DRAFT_SCOUT_RANK_NOISE,
} from "@/systems/draft-config";
import { teamIdsSorted } from "@/systems/draft/draft-order";
import type { GameState } from "@/state/game-state";

/**
 * Team-specific noisy scouting reports. Never mutates prospect snapshots.
 * One report per team × prospect. Deterministic for a given rng stream.
 */
export function generateDraftScouting(
  state: GameState,
  rng: Rng,
  prospects: Record<string, DraftProspect>,
): DraftScoutReport[] {
  const teamIds = teamIdsSorted(state);
  const prospectList = Object.values(prospects).sort((a, b) =>
    a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0,
  );
  const classSize = prospectList.length;
  if (classSize < 1) {
    throw new Error("Cannot generate scouting: no prospects.");
  }
  if (teamIds.length < 1) {
    throw new Error("Cannot generate scouting: no teams.");
  }

  const reports: DraftScoutReport[] = [];
  for (const teamId of teamIds) {
    for (const prospect of prospectList) {
      reports.push(
        createScoutReportForTeam(teamId, prospect, classSize, rng),
      );
    }
  }
  return reports;
}

function createScoutReportForTeam(
  teamId: TeamId,
  prospect: DraftProspect,
  classSize: number,
  rng: Rng,
): DraftScoutReport {
  const estimatedAttributes = {} as PlayerAttributes;
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const trueValue = prospect.player.attributes[key];
    const offset = rng.nextInt(
      -DRAFT_SCOUT_ATTRIBUTE_NOISE,
      DRAFT_SCOUT_ATTRIBUTE_NOISE,
    );
    estimatedAttributes[key] = clampRating(trueValue + offset);
  }

  const potentialOffset = rng.nextInt(
    -DRAFT_SCOUT_ATTRIBUTE_NOISE,
    DRAFT_SCOUT_ATTRIBUTE_NOISE,
  );
  const estimatedPotentialOverall = clampRating(
    prospect.player.potential.overall + potentialOffset,
  );

  const rankOffset = rng.nextInt(
    -DRAFT_SCOUT_RANK_NOISE,
    DRAFT_SCOUT_RANK_NOISE,
  );
  const projectedRank = clampInt(
    prospect.ranking + rankOffset,
    1,
    classSize,
  );

  return createDraftScoutReport({
    teamId,
    prospectPlayerId: prospect.playerId,
    estimatedAttributes,
    estimatedPotentialOverall,
    projectedRank,
  });
}

function clampRating(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
