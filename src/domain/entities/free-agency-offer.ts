import {
  assertContractShape,
  type ContractInput,
} from "@/domain/entities/contract";
import type { ContractId, OfferId, PlayerId, TeamId } from "@/domain/ids";

export type FreeAgencyOfferStatus =
  | "pending"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "withdrawn";

export const FREE_AGENCY_OFFER_STATUSES: readonly FreeAgencyOfferStatus[] = [
  "pending",
  "negotiating",
  "accepted",
  "rejected",
  "withdrawn",
];

export const OPEN_FREE_AGENCY_OFFER_STATUSES: readonly FreeAgencyOfferStatus[] =
  ["pending", "negotiating"];

export const TERMINAL_FREE_AGENCY_OFFER_STATUSES: readonly FreeAgencyOfferStatus[] =
  ["accepted", "rejected", "withdrawn"];

export type FreeAgencyOffer = {
  id: OfferId;
  playerId: PlayerId;
  teamId: TeamId;
  /** Proposed contract terms; reused by {@link createContract} on accept. */
  terms: ContractInput;
  status: FreeAgencyOfferStatus;
  /** Set when status is accepted; links to the created contract. */
  contractId?: ContractId;
  /** World calendar date (YYYY-MM-DD) when the offer was created. */
  createdOn: string;
  /** World calendar date (YYYY-MM-DD); must be >= createdOn. */
  updatedOn: string;
};

export type FreeAgencyOfferInput = {
  id: OfferId;
  playerId: PlayerId;
  teamId: TeamId;
  terms: ContractInput;
  status: FreeAgencyOfferStatus;
  contractId?: ContractId;
  createdOn: string;
  updatedOn: string;
};

export function isOpenOffer(status: FreeAgencyOfferStatus): boolean {
  return status === "pending" || status === "negotiating";
}

export function isTerminalOffer(status: FreeAgencyOfferStatus): boolean {
  return (
    status === "accepted" || status === "rejected" || status === "withdrawn"
  );
}

/**
 * Validates input and returns a new plain FreeAgencyOffer.
 * Does not check GameState referential integrity.
 */
export function createFreeAgencyOffer(
  input: FreeAgencyOfferInput,
): FreeAgencyOffer {
  assertFreeAgencyOfferShape(input);
  const offer: FreeAgencyOffer = {
    id: input.id,
    playerId: input.playerId,
    teamId: input.teamId,
    terms: cloneContractInput(input.terms),
    status: input.status,
    createdOn: input.createdOn,
    updatedOn: input.updatedOn,
  };
  if (input.contractId !== undefined) {
    offer.contractId = input.contractId;
  }
  return offer;
}

/**
 * Structural offer invariants shared by the factory and persistence validation.
 * Throws on failure.
 */
export function assertFreeAgencyOfferShape(
  offer: FreeAgencyOfferInput | FreeAgencyOffer,
): void {
  assertNonEmptyId(offer.id, "id");
  assertNonEmptyId(offer.playerId, "playerId");
  assertNonEmptyId(offer.teamId, "teamId");
  if (!isFreeAgencyOfferStatus(offer.status)) {
    throw new Error(
      `FreeAgencyOffer status must be one of ${FREE_AGENCY_OFFER_STATUSES.join(", ")}.`,
    );
  }
  assertCalendarDate(offer.createdOn, "createdOn");
  assertCalendarDate(offer.updatedOn, "updatedOn");
  if (offer.updatedOn < offer.createdOn) {
    throw new Error("FreeAgencyOffer updatedOn must be >= createdOn.");
  }
  assertContractShape(offer.terms);
  if (offer.terms.playerId !== offer.playerId) {
    throw new Error("FreeAgencyOffer terms.playerId must match offer.playerId.");
  }
  if (offer.terms.teamId !== offer.teamId) {
    throw new Error("FreeAgencyOffer terms.teamId must match offer.teamId.");
  }
  if (offer.status === "accepted") {
    if (offer.contractId === undefined || offer.contractId.length === 0) {
      throw new Error(
        "FreeAgencyOffer accepted status requires a non-empty contractId.",
      );
    }
  } else if (offer.contractId !== undefined) {
    throw new Error(
      "FreeAgencyOffer contractId is only allowed when status is accepted.",
    );
  }
}

function cloneContractInput(terms: ContractInput): ContractInput {
  const cloned: ContractInput = {
    id: terms.id,
    playerId: terms.playerId,
    teamId: terms.teamId,
    startYear: terms.startYear,
    endYear: terms.endYear,
    salaryByYear: { ...terms.salaryByYear },
  };
  if (terms.teamOption !== undefined) {
    cloned.teamOption = { ...terms.teamOption };
  }
  if (terms.playerOption !== undefined) {
    cloned.playerOption = { ...terms.playerOption };
  }
  return cloned;
}

function isFreeAgencyOfferStatus(
  value: string,
): value is FreeAgencyOfferStatus {
  return FREE_AGENCY_OFFER_STATUSES.includes(value as FreeAgencyOfferStatus);
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`FreeAgencyOffer ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`FreeAgencyOffer ${field} cannot be whitespace-only.`);
  }
}

function assertCalendarDate(value: string, field: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `FreeAgencyOffer ${field} must be a YYYY-MM-DD calendar date.`,
    );
  }
}
