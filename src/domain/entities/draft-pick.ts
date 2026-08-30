import type { DraftPickId, TeamId } from "@/domain/ids";

export type DraftPickRound = 1 | 2;

export const DRAFT_PICK_ROUNDS: readonly DraftPickRound[] = [1, 2];

export type DraftPickStatus = "available" | "used";

export const DRAFT_PICK_STATUSES: readonly DraftPickStatus[] = [
  "available",
  "used",
] as const;

export type DraftPick = {
  id: DraftPickId;
  /** Team that originally owned the pick. Immutable after generation. */
  originalTeamId: TeamId;
  /** Current owner. Updated by trades. */
  ownerTeamId: TeamId;
  seasonYear: number;
  round: DraftPickRound;
  /**
   * Ownership vs consumption:
   * - available: tradable (subject to horizon / deadline)
   * - used: spent in a draft; retains owner for history but untradeable
   */
  status: DraftPickStatus;
};

export type DraftPickInput = {
  id: DraftPickId;
  originalTeamId: TeamId;
  ownerTeamId: TeamId;
  seasonYear: number;
  round: DraftPickRound;
  status?: DraftPickStatus;
};

/**
 * Validates input and returns a new plain DraftPick.
 * Does not mutate input.
 */
export function createDraftPick(input: DraftPickInput): DraftPick {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyId(input.originalTeamId, "originalTeamId");
  assertNonEmptyId(input.ownerTeamId, "ownerTeamId");
  assertIntegerYear(input.seasonYear, "seasonYear");
  if (input.round !== 1 && input.round !== 2) {
    throw new Error("DraftPick round must be 1 or 2.");
  }
  const status = input.status ?? "available";
  if (status !== "available" && status !== "used") {
    throw new Error('DraftPick status must be "available" or "used".');
  }
  return {
    id: input.id,
    originalTeamId: input.originalTeamId,
    ownerTeamId: input.ownerTeamId,
    seasonYear: input.seasonYear,
    round: input.round,
    status,
  };
}

export function draftPickIdFor(
  teamId: TeamId,
  seasonYear: number,
  round: DraftPickRound,
): DraftPickId {
  return `pick_${teamId}_${seasonYear}_r${round}` as DraftPickId;
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`DraftPick ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`DraftPick ${field} cannot be whitespace-only.`);
  }
}

function assertIntegerYear(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`DraftPick ${field} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`DraftPick ${field} must be an integer.`);
  }
}
