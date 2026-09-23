/**
 * Fan voting presentation selectors.
 */

import type { GameState } from "@/state/game-state";
import type { FanVoteCampaign, FanVoteCandidate } from "@/domain/entities/season-events";

export type FanVoteLeaderRow = {
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new";
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  voteTotal: number;
  voteShare: number;
};

export type FanVoteCategoryView = {
  id: string;
  label: string;
  leaders: FanVoteLeaderRow[];
};

export type FanVotingHubView = {
  saveId: string;
  title: string;
  status: FanVoteCampaign["status"] | "none";
  openDate: string | null;
  closeDate: string | null;
  currentDate: string;
  daysRemaining: number | null;
  categories: FanVoteCategoryView[];
};

function movementOf(candidate: FanVoteCandidate): FanVoteLeaderRow["movement"] {
  if (candidate.previousRank == null) return "new";
  if (candidate.rank < candidate.previousRank) return "up";
  if (candidate.rank > candidate.previousRank) return "down";
  return "same";
}

export function toFanVotingHubView(state: GameState): FanVotingHubView {
  const saveId = state.meta.saveId;
  const campaigns = Object.values(state.competition.seasonEvents?.fanVoting ?? {});
  const campaign = campaigns[0];
  if (!campaign) {
    return {
      saveId,
      title: "Midseason Fan Voting",
      status: "none",
      openDate: null,
      closeDate: null,
      currentDate: state.world.calendar.currentDate,
      daysRemaining: null,
      categories: [],
    };
  }

  const categories: FanVoteCategoryView[] = Object.values(campaign.categories)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((category) => {
      const leaders = Object.values(category.candidates)
        .filter((c) => c.rank > 0)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 5)
        .map((c) => {
          const player = state.world.players[c.playerId];
          const team = c.teamId ? state.world.teams[c.teamId] : null;
          return {
            rank: c.rank,
            previousRank: c.previousRank,
            movement: movementOf(c),
            playerId: c.playerId,
            playerName: player
              ? `${player.firstName} ${player.lastName}`
              : c.playerId,
            teamId: c.teamId,
            teamName: team ? `${team.city} ${team.name}` : null,
            voteTotal: c.voteTotal,
            voteShare: c.voteShare,
          };
        });
      return { id: category.id, label: category.label, leaders };
    });

  let daysRemaining: number | null = null;
  if (campaign.status === "open") {
    const current = state.world.calendar.currentDate;
    if (current <= campaign.closeDate) {
      const a = Date.parse(`${current}T12:00:00Z`);
      const b = Date.parse(`${campaign.closeDate}T12:00:00Z`);
      daysRemaining = Math.max(0, Math.round((b - a) / 86_400_000));
    } else {
      daysRemaining = 0;
    }
  }

  return {
    saveId,
    title: campaign.title,
    status: campaign.status,
    openDate: campaign.openDate,
    closeDate: campaign.closeDate,
    currentDate: state.world.calendar.currentDate,
    daysRemaining,
    categories,
  };
}
