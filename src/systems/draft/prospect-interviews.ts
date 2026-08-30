/**
 * Pre-draft interviews — personality-driven quotes + internal fit signals.
 * User sees quotes; preferenceSignal is internal only.
 */

import type { DraftClass, TeamDraftState } from "@/domain/entities/draft";
import { createEmptyTeamDraftState } from "@/domain/entities/draft";
import type { Player } from "@/domain/entities/player";
import type {
  InterviewTopic,
  ProspectInterview,
  ProspectInterviewAnswer,
} from "@/domain/entities/scouting-types";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft/draft-order";

const TOPIC_POOL: InterviewTopic[] = [
  "playing_time",
  "development",
  "winning",
  "team_role",
  "leadership",
  "motivation",
  "work_ethic",
  "career_goals",
];

function answerForTopic(
  player: Player,
  topic: InterviewTopic,
): ProspectInterviewAnswer {
  const p = player.personality;
  switch (topic) {
    case "playing_time":
      if (p.competitiveness >= 70) {
        return {
          topic,
          quote:
            "I want significant early playing time — I'm ready to contribute now.",
          preferenceSignal: "playingTimePriority",
          preferenceStrength: "high",
        };
      }
      return {
        topic,
        quote: "I'll earn my minutes. I just want a fair shot to develop.",
        preferenceSignal: "playingTimePriority",
        preferenceStrength: "medium",
      };
    case "development":
      if (p.workEthic >= 70) {
        return {
          topic,
          quote:
            "A development-focused organization is huge for me. I put in the work every day.",
          preferenceSignal: "developmentFocus",
          preferenceStrength: "high",
        };
      }
      return {
        topic,
        quote: "I want coaching that helps me grow, but winning still matters.",
        preferenceSignal: "developmentFocus",
        preferenceStrength: "medium",
      };
    case "winning":
      if (p.competitiveness >= 75 && p.loyalty >= 55) {
        return {
          topic,
          quote: "I want to join a team that's serious about winning now.",
          preferenceSignal: "winNow",
          preferenceStrength: "high",
        };
      }
      return {
        topic,
        quote: "Building something lasting appeals to me as much as quick wins.",
        preferenceSignal: "winNow",
        preferenceStrength: "low",
      };
    case "team_role":
      if (p.leadership >= 70) {
        return {
          topic,
          quote: "I'm comfortable taking on a leadership role if asked.",
          preferenceSignal: "leadershipRole",
          preferenceStrength: "high",
        };
      }
      return {
        topic,
        quote: "I'm happy to fill whatever role helps the team.",
        preferenceSignal: "leadershipRole",
        preferenceStrength: "low",
      };
    case "leadership":
      return {
        topic,
        quote:
          p.leadership >= 65
            ? "I've always tried to set an example for teammates."
            : "I lead more by how I play than by speaking up.",
        preferenceSignal: "leadershipRole",
        preferenceStrength: p.leadership >= 65 ? "high" : "low",
      };
    case "motivation":
      return {
        topic,
        quote:
          p.competitiveness >= 70
            ? "Proving myself against the best drives me."
            : "I want a long career and to keep improving each year.",
        preferenceSignal: "motivation",
        preferenceStrength: "medium",
      };
    case "work_ethic":
      return {
        topic,
        quote:
          p.workEthic >= 70
            ? "Film, gym, recovery — I'm locked in on the process."
            : "I work hard, but I also know how to stay balanced.",
        preferenceSignal: "workEthic",
        preferenceStrength: p.workEthic >= 70 ? "high" : "medium",
      };
    case "career_goals":
      return {
        topic,
        quote:
          p.loyalty >= 70
            ? "I'd love to build a career with one franchise if it fits."
            : "I'm open to wherever gives me the best chance to grow.",
        preferenceSignal: "loyalty",
        preferenceStrength: p.loyalty >= 70 ? "high" : "medium",
      };
    default:
      return {
        topic,
        quote: "I'm focused on finding the right fit and getting to work.",
        preferenceSignal: "general",
        preferenceStrength: "low",
      };
  }
}

export function conductProspectInterview(
  state: GameState,
  teamId: TeamId,
  prospectPlayerId: PlayerId,
): GameState {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftId];
  if (!draft) return state;
  const prospect = draft.prospects[prospectPlayerId];
  if (!prospect) return state;

  const topics = TOPIC_POOL.slice(0, 4);
  const answers = topics.map((topic) => answerForTopic(prospect.player, topic));
  const interview: ProspectInterview = {
    prospectPlayerId,
    conductedOn: state.world.calendar.currentDate,
    answers,
  };

  const existing =
    draft.teamDraftState[teamId] ?? createEmptyTeamDraftState();
  const nextTeam: TeamDraftState = {
    ...existing,
    interviews: {
      ...existing.interviews,
      [prospectPlayerId]: interview,
    },
  };

  const nextDraft: DraftClass = {
    ...draft,
    teamDraftState: {
      ...draft.teamDraftState,
      [teamId]: nextTeam,
    },
  };

  return {
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [draftId]: nextDraft,
      },
    },
  };
}

/** Internal fit adjustment from interview — not shown as honesty labels. */
export function interviewFitSignals(
  interview: ProspectInterview | undefined,
): Record<string, "low" | "medium" | "high"> {
  if (!interview) return {};
  const out: Record<string, "low" | "medium" | "high"> = {};
  for (const answer of interview.answers) {
    out[answer.preferenceSignal] = answer.preferenceStrength;
  }
  return out;
}
