/**
 * Fan voting presentation selectors.
 */

import type { GameState } from "@/state/game-state";
import type {
  FanVoteCampaign,
  FanVoteCandidate,
  FanVoteCategory,
} from "@/domain/entities/season-events";

/** Players listed per conference column. */
export const FAN_VOTE_LEADERS_PER_CONFERENCE = 12;

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

export type FanVoteConferenceView = {
  /** Conference id, or "league" for a league-wide ballot. */
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
  conferences: FanVoteConferenceView[];
};

function movementOf(candidate: FanVoteCandidate): FanVoteLeaderRow["movement"] {
  if (candidate.previousRank == null) return "new";
  if (candidate.rank < candidate.previousRank) return "up";
  if (candidate.rank > candidate.previousRank) return "down";
  return "same";
}

export function toFanVotingHubView(state: GameState): FanVotingHubView {
  const saveId = state.meta.saveId;
  const campaigns = Object.values(
    state.competition.seasonEvents?.fanVoting ?? {},
  );
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
      conferences: [],
    };
  }

  const byConference = new Map<string, FanVoteCategory[]>();
  for (const category of Object.values(campaign.categories)) {
    const key = category.conferenceId ?? "league";
    byConference.set(key, [...(byConference.get(key) ?? []), category]);
  }

  const conferences: FanVoteConferenceView[] = [...byConference.entries()]
    .map(([id, categories]) => {
      const conference = state.world.conferences[id];
      // Campaigns planned before the all-positions ballot split each
      // conference by position; their per-category ranks don't compare.
      const singleBallot = categories.length === 1;
      const leaders = categories
        .flatMap((category) => Object.values(category.candidates))
        .filter((c) => c.rank > 0)
        .sort(
          (a, b) =>
            b.voteTotal - a.voteTotal || a.playerId.localeCompare(b.playerId),
        )
        .slice(0, FAN_VOTE_LEADERS_PER_CONFERENCE)
        .map((c, index): FanVoteLeaderRow => {
          const player = state.world.players[c.playerId];
          const team = c.teamId ? state.world.teams[c.teamId] : null;
          return {
            rank: index + 1,
            previousRank: singleBallot ? c.previousRank : null,
            movement: singleBallot ? movementOf(c) : "new",
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
      const label = singleBallot
        ? categories[0]!.label
        : conference
          ? `${conference.name} Conference`
          : "League";
      return { id, label, leaders };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

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
    conferences,
  };
}
