import type {
  DraftClassId,
  DraftPickId,
  PlayerId,
  TeamId,
} from "@/domain/ids";
import {
  PLAYER_ATTRIBUTE_KEYS,
  RATING_MAX,
  RATING_MIN,
  type Player,
  type PlayerAttributes,
} from "@/domain/entities/player";
import type { DraftPickRound } from "@/domain/entities/draft-pick";
import type { DraftPickResult } from "@/domain/entities/draft-pick-result";
import type {
  DraftBoardEntry,
  EstimatedProspectData,
  ProspectInterview,
  ScoutAssignment,
} from "@/domain/entities/scouting-types";

export type DraftLifecycleStatus = "not_started" | "active" | "complete";

export const DRAFT_LIFECYCLE_STATUSES: readonly DraftLifecycleStatus[] = [
  "not_started",
  "active",
  "complete",
];

export type DraftProspectStatus = "eligible" | "selected";

export const DRAFT_PROSPECT_STATUSES: readonly DraftProspectStatus[] = [
  "eligible",
  "selected",
];

export type DraftOrderSlotStatus = "available" | "used";

export const DRAFT_ORDER_SLOT_STATUSES: readonly DraftOrderSlotStatus[] = [
  "available",
  "used",
];

/**
 * Pre-selection representation of a future Player.
 * `playerId` is the permanent future PlayerId; selection inserts this exact
 * snapshot into world.players and must not regenerate the player.
 */
export type DraftProspect = {
  playerId: PlayerId;
  player: Player;
  ranking: number;
  status: DraftProspectStatus;
};

/**
 * @deprecated Legacy point-estimate report. Prefer EstimatedProspectData on TeamDraftState.
 * Kept for migration of pre-v51 saves.
 */
export type DraftScoutReport = {
  teamId: TeamId;
  prospectPlayerId: PlayerId;
  estimatedAttributes: PlayerAttributes;
  estimatedPotentialOverall: number;
  projectedRank: number;
};

/**
 * Selection state for one pick asset in a draft.
 * Once generated, ownerTeamId is authoritative for this draft (not DraftPick.ownerTeamId).
 */
export type DraftOrderSlot = {
  draftPickId: DraftPickId;
  overallPick: number;
  round: DraftPickRound;
  ownerTeamId: TeamId;
  status: DraftOrderSlotStatus;
  selectedPlayerId?: PlayerId;
};

export type DraftSelection = {
  draftClassId: DraftClassId;
  seasonYear: number;
  round: DraftPickRound;
  overallPick: number;
  draftPickId: DraftPickId;
  teamId: TeamId;
  playerId: PlayerId;
};

/** League-wide mock draft slot (shared simulation). */
export type LeagueMockDraftSlot = {
  overallPick: number;
  teamId: TeamId;
  prospectPlayerId: PlayerId;
};

export type LeagueMockDraft = {
  cacheKey: string;
  generatedOn: string;
  slots: LeagueMockDraftSlot[];
};

/** Team-specific view of the mock draft. */
export type TeamMockDraftView = {
  cacheKey: string;
  projectedPicks: Array<{
    prospectPlayerId: PlayerId;
    projectedOverallPick: number;
    previousProjectedOverallPick: number | null;
    delta: number | null;
    availabilityLabel: string;
  }>;
};

/**
 * Per-team draft intelligence — every team (user + AI) has its own copy.
 * activeOwnerTeamId only controls which team's data the UI displays.
 */
export type TeamDraftState = {
  scouting: EstimatedProspectData[];
  scoutAssignments: ScoutAssignment[];
  board: DraftBoardEntry[];
  interviews: Record<string, ProspectInterview>;
  /** Region coverage multipliers: domestic / international. */
  regionCoverage: { domestic: number; international: number };
  teamMockDraftCacheKey?: string;
  teamMockDraftView?: TeamMockDraftView;
};

export type TeamDraftGrade = {
  overallGrade: string;
  bestPickPlayerId: PlayerId | null;
  biggestReachPlayerId: PlayerId | null;
  needAddressed: boolean;
  explanation: string;
};

export type DraftClass = {
  id: DraftClassId;
  seasonYear: number;
  status: DraftLifecycleStatus;
  prospects: Record<string, DraftProspect>;
  order: DraftOrderSlot[];
  /**
   * @deprecated Legacy flat scouting array. New drafts use teamDraftState[teamId].scouting.
   * Migrated saves may still have entries until regenerated.
   */
  scouting: DraftScoutReport[];
  selections: DraftSelection[];
  /** Per-team scouting, boards, interviews (user + AI). */
  teamDraftState: Record<string, TeamDraftState>;
  /** Authoritative pick history for grading. */
  pickResults: DraftPickResult[];
  leagueMockDraft?: LeagueMockDraft;
  /** Post-draft grades keyed by teamId. */
  teamGrades?: Record<string, TeamDraftGrade>;
};

export function draftClassIdFor(seasonYear: number): DraftClassId {
  return `draft_${seasonYear}` as DraftClassId;
}

export function isDraftLifecycleStatus(
  value: unknown,
): value is DraftLifecycleStatus {
  return (
    typeof value === "string" &&
    (DRAFT_LIFECYCLE_STATUSES as readonly string[]).includes(value)
  );
}

export function isDraftProspectStatus(
  value: unknown,
): value is DraftProspectStatus {
  return (
    typeof value === "string" &&
    (DRAFT_PROSPECT_STATUSES as readonly string[]).includes(value)
  );
}

export function isDraftOrderSlotStatus(
  value: unknown,
): value is DraftOrderSlotStatus {
  return (
    typeof value === "string" &&
    (DRAFT_ORDER_SLOT_STATUSES as readonly string[]).includes(value)
  );
}

export function createDraftProspect(input: {
  player: Player;
  ranking: number;
  status?: DraftProspectStatus;
}): DraftProspect {
  if (input.player.teamId !== null) {
    throw new Error("DraftProspect player.teamId must be null.");
  }
  if (input.player.contractId !== null) {
    throw new Error("DraftProspect player.contractId must be null.");
  }
  if (!Number.isInteger(input.ranking) || input.ranking < 1) {
    throw new Error("DraftProspect ranking must be an integer >= 1.");
  }
  const status = input.status ?? "eligible";
  if (!isDraftProspectStatus(status)) {
    throw new Error(`Invalid DraftProspect status "${String(status)}".`);
  }
  return {
    playerId: input.player.id,
    player: input.player,
    ranking: input.ranking,
    status,
  };
}

export function createDraftScoutReport(input: {
  teamId: TeamId;
  prospectPlayerId: PlayerId;
  estimatedAttributes: PlayerAttributes;
  estimatedPotentialOverall: number;
  projectedRank: number;
}): DraftScoutReport {
  assertNonEmptyId(input.teamId, "teamId");
  assertNonEmptyId(input.prospectPlayerId, "prospectPlayerId");
  assertAttributes(input.estimatedAttributes);
  assertRating(
    input.estimatedPotentialOverall,
    "estimatedPotentialOverall",
  );
  if (!Number.isInteger(input.projectedRank) || input.projectedRank < 1) {
    throw new Error("DraftScoutReport projectedRank must be an integer >= 1.");
  }
  return {
    teamId: input.teamId,
    prospectPlayerId: input.prospectPlayerId,
    estimatedAttributes: { ...input.estimatedAttributes },
    estimatedPotentialOverall: input.estimatedPotentialOverall,
    projectedRank: input.projectedRank,
  };
}

export function createEmptyTeamDraftState(): TeamDraftState {
  return {
    scouting: [],
    scoutAssignments: [],
    board: [],
    interviews: {},
    regionCoverage: { domestic: 1, international: 1 },
  };
}

export function createDraftOrderSlot(input: {
  draftPickId: DraftPickId;
  overallPick: number;
  round: DraftPickRound;
  ownerTeamId: TeamId;
  status?: DraftOrderSlotStatus;
  selectedPlayerId?: PlayerId;
}): DraftOrderSlot {
  assertNonEmptyId(input.draftPickId, "draftPickId");
  assertNonEmptyId(input.ownerTeamId, "ownerTeamId");
  if (!Number.isInteger(input.overallPick) || input.overallPick < 1) {
    throw new Error("DraftOrderSlot overallPick must be an integer >= 1.");
  }
  if (input.round !== 1 && input.round !== 2) {
    throw new Error("DraftOrderSlot round must be 1 or 2.");
  }
  const status = input.status ?? "available";
  if (!isDraftOrderSlotStatus(status)) {
    throw new Error(`Invalid DraftOrderSlot status "${String(status)}".`);
  }
  const slot: DraftOrderSlot = {
    draftPickId: input.draftPickId,
    overallPick: input.overallPick,
    round: input.round,
    ownerTeamId: input.ownerTeamId,
    status,
  };
  if (input.selectedPlayerId !== undefined) {
    assertNonEmptyId(input.selectedPlayerId, "selectedPlayerId");
    slot.selectedPlayerId = input.selectedPlayerId;
  }
  return slot;
}

export function createDraftSelection(input: {
  draftClassId: DraftClassId;
  seasonYear: number;
  round: DraftPickRound;
  overallPick: number;
  draftPickId: DraftPickId;
  teamId: TeamId;
  playerId: PlayerId;
}): DraftSelection {
  assertNonEmptyId(input.draftClassId, "draftClassId");
  assertNonEmptyId(input.draftPickId, "draftPickId");
  assertNonEmptyId(input.teamId, "teamId");
  assertNonEmptyId(input.playerId, "playerId");
  if (!Number.isInteger(input.seasonYear)) {
    throw new Error("DraftSelection seasonYear must be an integer.");
  }
  if (!Number.isInteger(input.overallPick) || input.overallPick < 1) {
    throw new Error("DraftSelection overallPick must be an integer >= 1.");
  }
  if (input.round !== 1 && input.round !== 2) {
    throw new Error("DraftSelection round must be 1 or 2.");
  }
  return {
    draftClassId: input.draftClassId,
    seasonYear: input.seasonYear,
    round: input.round,
    overallPick: input.overallPick,
    draftPickId: input.draftPickId,
    teamId: input.teamId,
    playerId: input.playerId,
  };
}

export function createEmptyDraftClass(input: {
  id: DraftClassId;
  seasonYear: number;
}): DraftClass {
  assertNonEmptyId(input.id, "id");
  if (!Number.isInteger(input.seasonYear)) {
    throw new Error("DraftClass seasonYear must be an integer.");
  }
  return {
    id: input.id,
    seasonYear: input.seasonYear,
    status: "not_started",
    prospects: {},
    order: [],
    scouting: [],
    selections: [],
    teamDraftState: {},
    pickResults: [],
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Draft ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Draft ${field} cannot be whitespace-only.`);
  }
}

function assertRating(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Draft ${field} must be a finite number.`);
  }
  if (!Number.isInteger(value) || value < RATING_MIN || value > RATING_MAX) {
    throw new Error(
      `Draft ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}

function assertAttributes(attributes: PlayerAttributes): void {
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    assertRating(attributes[key], `estimatedAttributes.${key}`);
  }
}
