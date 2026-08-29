import type { ContractId, PlayerId, TeamId } from "@/domain/ids";

export const FANTASY_DRAFT_SCHEMA_VERSION = 1;

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
