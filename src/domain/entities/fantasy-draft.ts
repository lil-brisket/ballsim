import type { ContractId, PlayerId, TeamId } from "@/domain/ids";

export const FANTASY_DRAFT_SCHEMA_VERSION = 2;

export type FantasyDraftStatus =
  | "setup"
  | "active"
  | "paused"
  | "complete";

export const FANTASY_DRAFT_STATUSES: readonly FantasyDraftStatus[] = [
  "setup",
  "active",
  "paused",
  "complete",
];

export type FantasyDraftType = "snake" | "linear";

export const FANTASY_DRAFT_TYPES: readonly FantasyDraftType[] = [
  "snake",
  "linear",
];

export type FantasyDraftOrderMode = "random" | "manual";

export const FANTASY_DRAFT_ORDER_MODES: readonly FantasyDraftOrderMode[] = [
  "random",
  "manual",
];

export type FantasyDraftAutoPickStrategy =
  | "queue_then_best_fit"
  | "queue_then_best_available"
  | "best_fit"
  | "best_available";

export const FANTASY_DRAFT_AUTO_PICK_STRATEGIES: readonly FantasyDraftAutoPickStrategy[] =
  [
    "queue_then_best_fit",
    "queue_then_best_available",
    "best_fit",
    "best_available",
  ];

export type FantasyDraftSettings = {
  confirmPicks: boolean;
};

export type FantasyDraftSelection = {
  pickNumber: number;
  round: number;
  pickInRound: number;
  teamId: TeamId;
  playerId: PlayerId;
  contractId: ContractId;
  selectedAt: string;
};

export type FantasyDraftTimer = {
  enabled: boolean;
  secondsPerPick: number;
  /** Authoritative start time for the current pick; expiresAt is derived. */
  pickStartedAt: string | null;
};

export type FantasyDraftPickAssessment =
  | "Excellent"
  | "Strong"
  | "Good"
  | "Fair"
  | "Reach";

export type FantasyDraftPickAnalysis = {
  pickNumber: number;
  teamId: TeamId;
  playerId: PlayerId;
  talentRankAtPick: number;
  fitRankAtPick: number;
  wasBestAvailable: boolean;
  wasBestFit: boolean;
  valueStars: number;
  pickAssessment: FantasyDraftPickAssessment;
  reachDelta: number;
  compositeScore: number;
};

export type FantasyDraftPositionBalanceLevel =
  | "Excellent"
  | "Good"
  | "Average"
  | "Below Average"
  | "Weak";

export type FantasyDraftPositionBalance = {
  position: string;
  count: number;
  level: FantasyDraftPositionBalanceLevel;
  averageOverall: number | null;
};

export type FantasyDraftPickHighlight = {
  playerId: PlayerId;
  playerName: string;
  pickNumber: number;
  overall: number;
  potential: number;
  position: string;
};

export type FantasyDraftPickBreakdownRow = {
  pickNumber: number;
  round: number;
  playerId: PlayerId;
  playerName: string;
  position: string;
  overall: number;
  potential: number;
  age: number;
  assessment: FantasyDraftPickAssessment;
  valueStars: number;
};

export type FantasyDraftTeamSummary = {
  teamId: TeamId;
  playerCount: number;
  avgOvr: number;
  avgPot: number;
  avgAge: number;
  positionCounts: Array<{ position: string; count: number }>;
  positionBalance: FantasyDraftPositionBalance[];
  archetypeCounts: Array<{ archetype: string; count: number }>;
  positionalOverlap: string[];
  bestPlayer: FantasyDraftPickHighlight | null;
  highestPotential: FantasyDraftPickHighlight | null;
  oldestPick: FantasyDraftPickHighlight | null;
  youngestPick: FantasyDraftPickHighlight | null;
  rosterStrength: number;
  longTermStrength: number;
  remainingWeaknesses: Array<{ position: string; level: string }>;
  bestPick: FantasyDraftPickHighlight | null;
  biggestReach: FantasyDraftPickHighlight | null;
  bestValue: FantasyDraftPickHighlight | null;
  strongValuePickCount: number;
  draftGrade: string;
  draftGradeLabel: string;
  draftVerdict: string;
  strengths: string[];
  concerns: string[];
  teamOutlook: {
    shortTerm: string;
    longTerm: string;
    narrative: string;
  };
  recommendedNextSteps: string[];
  pickBreakdown: FantasyDraftPickBreakdownRow[];
};

export type FantasyDraftLeagueAward = {
  teamId: TeamId;
  teamName: string;
  playerId?: PlayerId;
  playerName?: string;
  pickNumber?: number;
  value?: number;
  detail: string;
};

export type FantasyDraftLeagueRecap = {
  bestDraft: FantasyDraftLeagueAward | null;
  biggestSteal: FantasyDraftLeagueAward | null;
  biggestReach: FantasyDraftLeagueAward | null;
  mostAggressive: FantasyDraftLeagueAward | null;
  youngestDraft: FantasyDraftLeagueAward | null;
  highestAvgOvr: FantasyDraftLeagueAward | null;
  highestAvgPot: FantasyDraftLeagueAward | null;
};

export type FantasyDraft = {
  /** Independent fantasy-draft schema version (starts at 1). */
  version: number;
  status: FantasyDraftStatus;
  draftType: FantasyDraftType;
  orderMode: FantasyDraftOrderMode;
  /** Round-1 order; snake reverse derived at runtime. Editable until locked. */
  draftOrder: TeamId[];
  orderConfirmed: boolean;
  picksPerTeam: number;
  totalPicks: number;
  /** All players generated for this fantasy pool. */
  poolPlayerIds: PlayerId[];
  /**
   * Next pick to make (1..totalPicks).
   * null when complete or no active pick.
   */
  currentPickNumber: number | null;
  selectedPlayerIds: PlayerId[];
  selections: FantasyDraftSelection[];
  timer: FantasyDraftTimer;
  /** When paused; timer frozen. */
  pausedAt: string | null;
  userTeamAutoPick: Record<string, boolean>;
  /** Franchise-scoped ordered draft queues (owned teams). */
  teamQueues: Record<string, PlayerId[]>;
  /** Per owned-team auto-pick strategy. */
  autoPickStrategy: Record<string, FantasyDraftAutoPickStrategy>;
  settings: FantasyDraftSettings;
  /** Populated at draft completion. */
  pickAnalyses: FantasyDraftPickAnalysis[];
  teamSummaries: Record<string, FantasyDraftTeamSummary>;
  leagueRecap: FantasyDraftLeagueRecap | null;
};

export function isFantasyDraftStatus(
  value: unknown,
): value is FantasyDraftStatus {
  return (
    typeof value === "string" &&
    (FANTASY_DRAFT_STATUSES as readonly string[]).includes(value)
  );
}

export function isFantasyDraftType(value: unknown): value is FantasyDraftType {
  return (
    typeof value === "string" &&
    (FANTASY_DRAFT_TYPES as readonly string[]).includes(value)
  );
}

export function isFantasyDraftOrderMode(
  value: unknown,
): value is FantasyDraftOrderMode {
  return (
    typeof value === "string" &&
    (FANTASY_DRAFT_ORDER_MODES as readonly string[]).includes(value)
  );
}

export function isFantasyDraftAutoPickStrategy(
  value: unknown,
): value is FantasyDraftAutoPickStrategy {
  return (
    typeof value === "string" &&
    (FANTASY_DRAFT_AUTO_PICK_STRATEGIES as readonly string[]).includes(value)
  );
}

export function createEmptyFantasyDraft(input: {
  draftType?: FantasyDraftType;
  orderMode?: FantasyDraftOrderMode;
  picksPerTeam: number;
  totalPicks: number;
  poolPlayerIds?: PlayerId[];
  timerSeconds?: number | null;
}): FantasyDraft {
  if (!Number.isInteger(input.picksPerTeam) || input.picksPerTeam < 1) {
    throw new Error("FantasyDraft picksPerTeam must be a positive integer.");
  }
  if (!Number.isInteger(input.totalPicks) || input.totalPicks < 1) {
    throw new Error("FantasyDraft totalPicks must be a positive integer.");
  }
  const timerSeconds = input.timerSeconds ?? null;
  return {
    version: FANTASY_DRAFT_SCHEMA_VERSION,
    status: "setup",
    draftType: input.draftType ?? "snake",
    orderMode: input.orderMode ?? "random",
    draftOrder: [],
    orderConfirmed: false,
    picksPerTeam: input.picksPerTeam,
    totalPicks: input.totalPicks,
    poolPlayerIds: input.poolPlayerIds ? [...input.poolPlayerIds] : [],
    currentPickNumber: null,
    selectedPlayerIds: [],
    selections: [],
    timer: {
      enabled: timerSeconds !== null && timerSeconds > 0,
      secondsPerPick: timerSeconds !== null && timerSeconds > 0 ? timerSeconds : 0,
      pickStartedAt: null,
    },
    pausedAt: null,
    userTeamAutoPick: {},
    teamQueues: {},
    autoPickStrategy: {},
    settings: {
      confirmPicks: true,
    },
    pickAnalyses: [],
    teamSummaries: {},
    leagueRecap: null,
  };
}

export type FantasyDraftPlayerTier =
  | "elite"
  | "starter"
  | "rotation"
  | "development";

export function fantasyDraftPlayerTier(overall: number): FantasyDraftPlayerTier {
  if (overall >= 85) {
    return "elite";
  }
  if (overall >= 78) {
    return "starter";
  }
  if (overall >= 70) {
    return "rotation";
  }
  return "development";
}
