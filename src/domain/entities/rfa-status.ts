import type { ContractInput } from "@/domain/entities/contract";
import { assertContractShape } from "@/domain/entities/contract";
import type { PlayerId, TeamId } from "@/domain/ids";

export type RfaResolution =
  | "pending_rfa"
  | "pending_match"
  | "unsigned_ufa"
  | "matched"
  | "signed_elsewhere"
  | "declined_to_ufa";

export const RFA_RESOLUTIONS: readonly RfaResolution[] = [
  "pending_rfa",
  "pending_match",
  "unsigned_ufa",
  "matched",
  "signed_elsewhere",
  "declined_to_ufa",
] as const;

/**
 * Exact contract terms the original team must match.
 * Reuses ContractInput so matching creates the same shape as FA accept.
 */
export type RfaOfferSheet = {
  offeringTeamId: TeamId;
  terms: ContractInput;
  createdOn: string;
  matchDeadlineDate: string;
};

export type RfaStatus = {
  playerId: PlayerId;
  originalTeamId: TeamId;
  seasonYear: number;
  qualifyingOfferSalary: number;
  hasQualifyingOffer: boolean;
  /** At most one active offer sheet (hard lock). */
  activeOfferSheet: RfaOfferSheet | null;
  resolution: RfaResolution;
};

export type RfaStatusInput = RfaStatus;

export function isRfaResolution(value: unknown): value is RfaResolution {
  return (
    typeof value === "string" &&
    (RFA_RESOLUTIONS as readonly string[]).includes(value)
  );
}

export function createRfaStatus(input: RfaStatusInput): RfaStatus {
  assertRfaStatusShape(input);
  return {
    playerId: input.playerId,
    originalTeamId: input.originalTeamId,
    seasonYear: input.seasonYear,
    qualifyingOfferSalary: input.qualifyingOfferSalary,
    hasQualifyingOffer: input.hasQualifyingOffer,
    activeOfferSheet: input.activeOfferSheet
      ? {
          offeringTeamId: input.activeOfferSheet.offeringTeamId,
          terms: { ...input.activeOfferSheet.terms },
          createdOn: input.activeOfferSheet.createdOn,
          matchDeadlineDate: input.activeOfferSheet.matchDeadlineDate,
        }
      : null,
    resolution: input.resolution,
  };
}

export function assertRfaStatusShape(status: RfaStatusInput | RfaStatus): void {
  if (typeof status.playerId !== "string" || status.playerId.length === 0) {
    throw new Error("RfaStatus playerId must be a non-empty string.");
  }
  if (
    typeof status.originalTeamId !== "string" ||
    status.originalTeamId.length === 0
  ) {
    throw new Error("RfaStatus originalTeamId must be a non-empty string.");
  }
  if (!Number.isInteger(status.seasonYear)) {
    throw new Error("RfaStatus seasonYear must be an integer.");
  }
  if (
    typeof status.qualifyingOfferSalary !== "number" ||
    !Number.isFinite(status.qualifyingOfferSalary) ||
    status.qualifyingOfferSalary < 0
  ) {
    throw new Error("RfaStatus qualifyingOfferSalary must be a non-negative number.");
  }
  if (typeof status.hasQualifyingOffer !== "boolean") {
    throw new Error("RfaStatus hasQualifyingOffer must be a boolean.");
  }
  if (!isRfaResolution(status.resolution)) {
    throw new Error(`RfaStatus resolution invalid: ${String(status.resolution)}`);
  }
  if (status.activeOfferSheet !== null) {
    const sheet = status.activeOfferSheet;
    if (
      typeof sheet.offeringTeamId !== "string" ||
      sheet.offeringTeamId.length === 0
    ) {
      throw new Error("RfaOfferSheet offeringTeamId must be non-empty.");
    }
    assertContractShape(sheet.terms);
    if (typeof sheet.createdOn !== "string" || sheet.createdOn.length === 0) {
      throw new Error("RfaOfferSheet createdOn must be a date string.");
    }
    if (
      typeof sheet.matchDeadlineDate !== "string" ||
      sheet.matchDeadlineDate.length === 0
    ) {
      throw new Error("RfaOfferSheet matchDeadlineDate must be a date string.");
    }
  }
}

/** True when the player is still under RFA restrictions (cannot use UFA path). */
export function isActiveRfa(status: RfaStatus): boolean {
  return (
    status.hasQualifyingOffer &&
    (status.resolution === "pending_rfa" ||
      status.resolution === "pending_match")
  );
}
