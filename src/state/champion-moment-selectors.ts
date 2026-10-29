/**
 * Championship moment: who won the title and how the Finals went. Built from
 * the playoff tournament only; the game records no Finals MVP, so none is shown.
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";

export type ChampionMomentView = {
  seasonYear: number;
  championTeamId: string;
  championName: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
  finalsOpponentName: string | null;
  /** Series score with the champion first, e.g. "4–2". */
  finalsWins: string;
  userTeamIsChampion: boolean;
  /** The title was just decided: postseason or offseason of a complete run. */
  isCurrent: boolean;
};

/** The title was just decided: postseason or offseason of a complete run. */
export function isChampionMomentCurrent(state: GameState): boolean {
  const phase = state.competition.season.phase;
  return (
    state.competition.playoffs.status === "complete" &&
    (phase === "postseason" || phase === "offseason")
  );
}

function fullName(state: GameState, teamId: string): string {
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

/** Null until the tournament has a champion. */
export function toChampionMomentView(
  state: GameState,
): ChampionMomentView | null {
  const playoffs = state.competition.playoffs;
  const championTeamId = playoffs.championTeamId;
  if (!championTeamId) return null;

  const final = playoffs.series.reduce<(typeof playoffs.series)[number] | null>(
    (best, series) =>
      best === null ||
      series.round > best.round ||
      (series.round === best.round && series.slot < best.slot)
        ? series
        : best,
    null,
  );
  const opponentId =
    final == null
      ? null
      : final.higherSeedTeamId === championTeamId
        ? final.lowerSeedTeamId
        : final.lowerSeedTeamId === championTeamId
          ? final.higherSeedTeamId
          : null;
  const championWins = final?.wins[championTeamId] ?? 0;
  const opponentWins = opponentId ? (final?.wins[opponentId] ?? 0) : 0;
  const team = state.world.teams[championTeamId];

  return {
    seasonYear: state.competition.season.year,
    championTeamId,
    championName: fullName(state, championTeamId),
    abbreviation: team?.abbreviation ?? championTeamId,
    branding: toBrandingView(team?.branding),
    finalsOpponentName: opponentId ? fullName(state, opponentId) : null,
    finalsWins: `${championWins}–${opponentWins}`,
    userTeamIsChampion: getActiveOwnerTeamId(state) === championTeamId,
    isCurrent: isChampionMomentCurrent(state),
  };
}
