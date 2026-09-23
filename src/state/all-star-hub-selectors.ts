import type { GameState } from "@/state/game-state";
import type { AllStarSelection } from "@/domain/entities/season-events";

export type AllStarHubView = {
  saveId: string;
  status: string;
  eventDate: string | null;
  selectionsAnnouncedOn: string | null;
  selections: Array<{
    playerId: string;
    playerName: string;
    teamId: string | null;
    teamName: string | null;
    role: AllStarSelection["role"];
    conferenceId: string | null;
    voteRank: number | null;
    categoryId: string | null;
  }>;
  gameIds: string[];
};

export function toAllStarHubView(state: GameState): AllStarHubView {
  const allStar = state.competition.seasonEvents?.allStar ?? null;
  if (!allStar) {
    return {
      saveId: state.meta.saveId,
      status: "none",
      eventDate: null,
      selectionsAnnouncedOn: null,
      selections: [],
      gameIds: [],
    };
  }

  return {
    saveId: state.meta.saveId,
    status: allStar.status,
    eventDate: allStar.eventDate,
    selectionsAnnouncedOn: allStar.selectionsAnnouncedOn,
    gameIds: allStar.gameIds,
    selections: allStar.selections.map((s) => {
      const player = state.world.players[s.playerId];
      const team = s.teamId ? state.world.teams[s.teamId] : null;
      return {
        playerId: s.playerId,
        playerName: player
          ? `${player.firstName} ${player.lastName}`
          : s.playerId,
        teamId: s.teamId,
        teamName: team ? `${team.city} ${team.name}` : null,
        role: s.role,
        conferenceId: s.conferenceId,
        voteRank: s.voteRank,
        categoryId: s.categoryId,
      };
    }),
  };
}
