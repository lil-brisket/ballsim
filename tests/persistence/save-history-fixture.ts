import {
  createEmptyDraftClass,
  draftClassIdFor,
  type DraftClass,
} from "@/domain/entities/draft";
import { buildGameArchiveIndex } from "@/domain/entities/game-archive-index";
import { asGameId, asSeasonId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { createTestGame } from "../factories/game";
import { createTestGameState } from "../factories/game-state";
import { seasonRecord, withFranchiseHistory } from "../state/history-fixtures";

/**
 * A league in season Y with three finished seasons on record, archived games
 * in each of them, in the current season and in a season with no record,
 * and draft classes: last year's (complete), this year's (complete) and
 * the next (not started).
 */
export function leagueWithHistory(saveId = "save_history"): GameState {
  const base = createTestGameState({ saveId });
  const year = base.competition.season.year;
  const records = [
    seasonRecord({ year: year - 3 }),
    seasonRecord({ year: year - 2 }),
    seasonRecord({ year: year - 1 }),
  ];
  const withRecords = withFranchiseHistory(
    base,
    Object.fromEntries(
      Object.keys(base.world.teams).map((teamId) => [teamId, records]),
    ),
  );
  const game = (id: string, seasonId: string) =>
    createTestGame({ id: asGameId(id), seasonId: asSeasonId(seasonId) });
  const games = [
    game("g_old_1", `season_${year - 3}`),
    game("g_old_2", `season_${year - 2}`),
    game("g_prev", `season_${year - 1}`),
    game("g_current", withRecords.competition.season.id),
    game("g_unknown", "season_unrecorded"),
  ];
  const gameArchive = Object.fromEntries(games.map((g) => [g.id, g]));
  const draft = (seasonYear: number, status: DraftClass["status"]) => ({
    ...createEmptyDraftClass({ id: draftClassIdFor(seasonYear), seasonYear }),
    status,
  });
  const drafts = [
    draft(year - 1, "complete"),
    draft(year, "complete"),
    draft(year + 1, "not_started"),
  ];
  return {
    ...withRecords,
    world: {
      ...withRecords.world,
      drafts: Object.fromEntries(drafts.map((d) => [d.id, d])),
    },
    business: {
      ...withRecords.business,
      gameArchive,
      gameArchiveIndex: buildGameArchiveIndex(gameArchive),
    },
  };
}
