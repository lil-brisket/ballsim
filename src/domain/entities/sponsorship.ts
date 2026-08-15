import type { SponsorshipId, TeamId } from "@/domain/ids";

/**
 * Commercial sponsorship contract (E7). Separate from player and staff contracts.
 */

export type SponsorshipStatus = "active" | "expired" | "terminated";

export const SPONSORSHIP_STATUSES: readonly SponsorshipStatus[] = [
  "active",
  "expired",
  "terminated",
] as const;

export type Sponsorship = {
  id: SponsorshipId;
  teamId: TeamId;
  sponsorName: string;
  /** Annual contract value (integer dollars). */
  annualValue: number;
  startYear: number;
  endYear: number;
  /** Minimum Team.reputation required to keep / renew. */
  reputationFloor: number;
  /** Optional performance bonus paid once per season if playoffs reached. */
  playoffBonus: number;
  status: SponsorshipStatus;
};

export type SponsorshipInput = {
  id: SponsorshipId;
  teamId: TeamId;
  sponsorName: string;
  annualValue: number;
  startYear: number;
  endYear: number;
  reputationFloor: number;
  playoffBonus: number;
  status: SponsorshipStatus;
};

export function isSponsorshipStatus(
  value: unknown,
): value is SponsorshipStatus {
  return (
    typeof value === "string" &&
    (SPONSORSHIP_STATUSES as readonly string[]).includes(value)
  );
}

export function createSponsorship(input: SponsorshipInput): Sponsorship {
  assertSponsorshipShape(input);
  return {
    id: input.id,
    teamId: input.teamId,
    sponsorName: input.sponsorName,
    annualValue: input.annualValue,
    startYear: input.startYear,
    endYear: input.endYear,
    reputationFloor: input.reputationFloor,
    playoffBonus: input.playoffBonus,
    status: input.status,
  };
}

export function assertSponsorshipShape(
  sponsorship: SponsorshipInput | Sponsorship,
): void {
  assertNonEmptyId(sponsorship.id, "id");
  assertNonEmptyId(sponsorship.teamId, "teamId");
  if (
    typeof sponsorship.sponsorName !== "string" ||
    sponsorship.sponsorName.trim().length === 0
  ) {
    throw new Error("Sponsorship sponsorName must be a non-empty string.");
  }
  assertNonNegativeInteger(sponsorship.annualValue, "annualValue");
  assertIntegerYear(sponsorship.startYear, "startYear");
  assertIntegerYear(sponsorship.endYear, "endYear");
  if (sponsorship.startYear > sponsorship.endYear) {
    throw new Error("Sponsorship startYear must be <= endYear.");
  }
  assertRating(sponsorship.reputationFloor, "reputationFloor");
  assertNonNegativeInteger(sponsorship.playoffBonus, "playoffBonus");
  if (!isSponsorshipStatus(sponsorship.status)) {
    throw new Error(
      `Sponsorship status must be one of ${SPONSORSHIP_STATUSES.join(", ")}.`,
    );
  }
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Sponsorship ${field} must be a non-empty string.`);
  }
}

function assertIntegerYear(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`Sponsorship ${field} must be an integer.`);
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Sponsorship ${field} must be a non-negative integer.`);
  }
}

function assertRating(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error(`Sponsorship ${field} must be an integer between 1 and 99.`);
  }
}
