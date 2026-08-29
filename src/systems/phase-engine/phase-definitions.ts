import type {
  AdvanceMode,
  AiPhaseRoutine,
  LeaguePhaseId,
  PhaseStage,
} from "@/systems/phase-engine/phase-types";

export type PhaseDefinition = {
  id: LeaguePhaseId;
  stage: PhaseStage;
  name: string;
  theme: string;
  objective: string;
  description: string;
  advanceMode: AdvanceMode;
  /** Fixed next phase when advancing (null = end of known sequence). */
  nextPhaseId: LeaguePhaseId | null;
  /** Phase after next — for "Later" UI. */
  laterPhaseId: LeaguePhaseId | null;
  aiRoutines: readonly AiPhaseRoutine[];
  previewConsequences: readonly string[];
};

/**
 * Default offseason management sequence (V1).
 * Season transition is automatic; the rest are user-controlled.
 */
export const OFFSEASON_SEQUENCE: readonly LeaguePhaseId[] = [
  "offseason.season_transition",
  "offseason.roster_decisions",
  "offseason.draft_preparation",
  "offseason.draft",
  "offseason.free_agency",
  "offseason.staff_development",
  "preseason.preparation",
] as const;

export const PHASE_DEFINITIONS: Record<LeaguePhaseId, PhaseDefinition> = {
  "postseason.season_review": {
    id: "postseason.season_review",
    stage: "postseason",
    name: "Season Review",
    theme: "Reflect on the season.",
    objective: "Review results before beginning the offseason.",
    description:
      "Season Review is a player-paced checkpoint. Begin the offseason when ready.",
    advanceMode: "user",
    nextPhaseId: "offseason.season_transition",
    laterPhaseId: "offseason.roster_decisions",
    aiRoutines: [],
    previewConsequences: [
      "Archive the completed season.",
      "Process player development and league economy.",
      "Enter roster decision period.",
    ],
  },
  "offseason.season_transition": {
    id: "offseason.season_transition",
    stage: "offseason",
    name: "Season Transition",
    theme: "Close the books.",
    objective: "Process season-end league events automatically.",
    description:
      "The league archives games, generates reports, ages players, and settles economy.",
    advanceMode: "automatic",
    nextPhaseId: "offseason.roster_decisions",
    laterPhaseId: "offseason.draft_preparation",
    aiRoutines: [],
    previewConsequences: [
      "Season archives and reports are finalized.",
      "Player development is applied.",
      "Roster decisions open.",
    ],
  },
  "offseason.roster_decisions": {
    id: "offseason.roster_decisions",
    stage: "offseason",
    name: "Roster Decisions",
    theme: "Protect what you have.",
    objective:
      "Resolve contracts and determine which players remain part of your plans.",
    description:
      "Handle player options, extensions, releases, and roster evaluation before the draft.",
    advanceMode: "user",
    nextPhaseId: "offseason.draft_preparation",
    laterPhaseId: "offseason.draft",
    aiRoutines: ["contracts", "releases", "trades"],
    previewConsequences: [
      "Unresolved team/player options must be resolved.",
      "Expired contracts will be released to free agency.",
      "AI teams will finalize their roster decisions.",
      "Draft preparation will open.",
    ],
  },
  "offseason.draft_preparation": {
    id: "offseason.draft_preparation",
    stage: "offseason",
    name: "Draft Preparation",
    theme: "Find your future.",
    objective: "Scout prospects and build your draft strategy.",
    description:
      "Review draft order, scout prospects, identify team needs, and set your board.",
    advanceMode: "user",
    nextPhaseId: "offseason.draft",
    laterPhaseId: "offseason.free_agency",
    aiRoutines: ["scout", "trades"],
    previewConsequences: [
      "The draft will begin.",
      "AI teams will finalize scouting and boards.",
      "Live pick selection will open.",
    ],
  },
  "offseason.draft": {
    id: "offseason.draft",
    stage: "offseason",
    name: "Draft",
    theme: "Make your picks.",
    objective: "Execute your draft strategy and react to other teams.",
    description: "Select prospects when your team is on the clock.",
    advanceMode: "user",
    nextPhaseId: "offseason.free_agency",
    laterPhaseId: "offseason.staff_development",
    aiRoutines: ["draft", "trades"],
    previewConsequences: [
      "Remaining AI draft picks will be completed if needed.",
      "Free agency will open.",
      "Roster needs will be reassessed after draft results.",
    ],
  },
  "offseason.free_agency": {
    id: "offseason.free_agency",
    stage: "offseason",
    name: "Free Agency",
    theme: "Build your roster.",
    objective: "Fill remaining weaknesses and manage your player budget.",
    description:
      "Negotiate with free agents, make offers, and construct your roster.",
    advanceMode: "user",
    nextPhaseId: "offseason.staff_development",
    laterPhaseId: "preseason.preparation",
    aiRoutines: ["free_agency", "trades"],
    previewConsequences: [
      "AI teams will finish remaining free-agency activity.",
      "Staff and development period will open.",
    ],
  },
  "offseason.staff_development": {
    id: "offseason.staff_development",
    stage: "offseason",
    name: "Staff & Development",
    theme: "Improve your organization.",
    objective: "Build your staff and develop your players.",
    description:
      "Hire or fire staff, review coaching, and prepare development priorities.",
    advanceMode: "user",
    nextPhaseId: "preseason.preparation",
    laterPhaseId: "regular",
    aiRoutines: ["staff"],
    previewConsequences: [
      "AI teams will fill staff vacancies.",
      "A new season will initialize.",
      "Preseason preparation will begin.",
    ],
  },
  "preseason.preparation": {
    id: "preseason.preparation",
    stage: "preseason",
    name: "Preseason Preparation",
    theme: "Prepare to compete.",
    objective: "Finalize your roster, rotation, and strategy.",
    description:
      "Set depth charts, rotations, and lineups before the regular season.",
    advanceMode: "user",
    nextPhaseId: "regular",
    laterPhaseId: "playoffs",
    aiRoutines: ["staff"],
    previewConsequences: [
      "The regular season will begin.",
      "The league schedule will generate if needed.",
    ],
  },
  regular: {
    id: "regular",
    stage: "regular",
    name: "Regular Season",
    theme: "Compete every night.",
    objective: "Manage your team through the regular season.",
    description: "Play games, manage injuries, and chase a playoff berth.",
    advanceMode: "user",
    nextPhaseId: "playoffs",
    laterPhaseId: "postseason.season_review",
    aiRoutines: ["trades", "staff"],
    previewConsequences: ["Playoffs will begin when the regular season ends."],
  },
  playoffs: {
    id: "playoffs",
    stage: "playoffs",
    name: "Playoffs",
    theme: "Win or go home.",
    objective: "Advance through the playoff bracket.",
    description: "Prepare series and compete for a championship.",
    advanceMode: "user",
    nextPhaseId: "postseason.season_review",
    laterPhaseId: "offseason.season_transition",
    aiRoutines: [],
    previewConsequences: ["Season Review will open when the tournament ends."],
  },
  "end_of_season.wrap_up": {
    id: "end_of_season.wrap_up",
    stage: "end_of_season",
    name: "End of Season",
    theme: "Close the chapter.",
    objective: "Review awards, finances, and transition into the next season.",
    description: "League recap and transition into Season Review.",
    advanceMode: "automatic",
    nextPhaseId: "postseason.season_review",
    laterPhaseId: "offseason.season_transition",
    aiRoutines: [],
    previewConsequences: ["Season Review opens."],
  },
};

export function getPhaseDefinition(phaseId: LeaguePhaseId): PhaseDefinition {
  return PHASE_DEFINITIONS[phaseId];
}

export function isLeaguePhaseId(value: unknown): value is LeaguePhaseId {
  return (
    typeof value === "string" &&
    (Object.keys(PHASE_DEFINITIONS) as string[]).includes(value)
  );
}
