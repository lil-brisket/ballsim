import type { StaffContractId, StaffId, StaffOfferId, TeamId } from "@/domain/ids";

export type StaffOfferStatus =
  | "pending"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "withdrawn";

export const STAFF_OFFER_STATUSES: readonly StaffOfferStatus[] = [
  "pending",
  "negotiating",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export const OPEN_STAFF_OFFER_STATUSES: readonly StaffOfferStatus[] = [
  "pending",
  "negotiating",
];

export type StaffOfferTerms = {
  /** Proposed annual salary in dollars. */
  annualSalary: number;
  /** Contract length in years. */
  years: number;
};

export type StaffOffer = {
  id: StaffOfferId;
  staffId: StaffId;
  teamId: TeamId;
  terms: StaffOfferTerms;
  status: StaffOfferStatus;
  /** Set when status is accepted. */
  contractId?: StaffContractId;
  createdOn: string;
  updatedOn: string;
};

export type StaffOfferInput = {
  id: StaffOfferId;
  staffId: StaffId;
  teamId: TeamId;
  terms: StaffOfferTerms;
  status: StaffOfferStatus;
  contractId?: StaffContractId;
  createdOn: string;
  updatedOn: string;
};

export function isOpenStaffOffer(status: StaffOfferStatus): boolean {
  return status === "pending" || status === "negotiating";
}

export function createStaffOffer(input: StaffOfferInput): StaffOffer {
  assertStaffOfferShape(input);
  const offer: StaffOffer = {
    id: input.id,
    staffId: input.staffId,
    teamId: input.teamId,
    terms: {
      annualSalary: input.terms.annualSalary,
      years: input.terms.years,
    },
    status: input.status,
    createdOn: input.createdOn,
    updatedOn: input.updatedOn,
  };
  if (input.contractId !== undefined) {
    offer.contractId = input.contractId;
  }
  return offer;
}

export function assertStaffOfferShape(
  offer: StaffOfferInput | StaffOffer,
): void {
  assertNonEmptyId(offer.id, "id");
  assertNonEmptyId(offer.staffId, "staffId");
  assertNonEmptyId(offer.teamId, "teamId");
  if (
    typeof offer.status !== "string" ||
    !(STAFF_OFFER_STATUSES as readonly string[]).includes(offer.status)
  ) {
    throw new Error(
      `StaffOffer status must be one of ${STAFF_OFFER_STATUSES.join(", ")}.`,
    );
  }
  assertCalendarDate(offer.createdOn, "createdOn");
  assertCalendarDate(offer.updatedOn, "updatedOn");
  if (offer.updatedOn < offer.createdOn) {
    throw new Error("StaffOffer updatedOn must be >= createdOn.");
  }
  if (
    typeof offer.terms.annualSalary !== "number" ||
    !Number.isInteger(offer.terms.annualSalary) ||
    offer.terms.annualSalary < 0
  ) {
    throw new Error("StaffOffer terms.annualSalary must be a non-negative integer.");
  }
  if (
    typeof offer.terms.years !== "number" ||
    !Number.isInteger(offer.terms.years) ||
    offer.terms.years < 1 ||
    offer.terms.years > 10
  ) {
    throw new Error("StaffOffer terms.years must be an integer 1–10.");
  }
  if (offer.status === "accepted") {
    if (offer.contractId === undefined || offer.contractId.length === 0) {
      throw new Error(
        "StaffOffer accepted status requires a non-empty contractId.",
      );
    }
  } else if (offer.contractId !== undefined) {
    throw new Error(
      "StaffOffer contractId is only allowed when status is accepted.",
    );
  }
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`StaffOffer ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`StaffOffer ${field} cannot be whitespace-only.`);
  }
}

function assertCalendarDate(value: string, field: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `StaffOffer ${field} must be a YYYY-MM-DD calendar date.`,
    );
  }
}
