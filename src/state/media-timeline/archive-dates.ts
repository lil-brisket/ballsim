import type { GameCompetitionType } from "@/domain/entities/game";
import type { GameState } from "@/state/game-state";

/** Latest final game date of an archived season, per competition type. */
export function lastArchivedGameDate(
  state: GameState,
  seasonId: string,
  competitionType: GameCompetitionType,
): string | null {
  const archive = state.business.gameArchive;
  const indexed = state.business.gameArchiveIndex?.bySeasonId[seasonId];
  const games = indexed
    ? indexed.map((id) => archive[id])
    : Object.values(archive).filter((game) => game.seasonId === seasonId);
  let latest: string | null = null;
  for (const game of games) {
    if (!game || game.status !== "final") continue;
    if (game.competitionType !== competitionType) continue;
    if (latest === null || game.date > latest) latest = game.date;
  }
  return latest;
}
