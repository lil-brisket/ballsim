import type {
  NarrativeSituationId,
  OwnerNotificationId,
  OwnerObjectiveId,
  SponsorshipId,
  StaffId,
  TeamId,
} from "@/domain/ids";

export type NarrativeCategory =
  | "financial"
  | "fans"
  | "team"
  | "staff"
  | "media"
  | "sponsors"
  | "league"
  | "facilities"
  | "ownership";

export const NARRATIVE_CATEGORIES: readonly NarrativeCategory[] = [
  "financial",
  "fans",
  "team",
  "staff",
  "media",
  "sponsors",
  "league",
  "facilities",
  "ownership",
] as const;

export function isNarrativeCategory(value: string): value is NarrativeCategory {
  return (NARRATIVE_CATEGORIES as readonly string[]).includes(value);
}

export type NarrativeSeverity =
  | "informational"
  | "notable"
  | "important"
  | "critical";

export const NARRATIVE_SEVERITIES: readonly NarrativeSeverity[] = [
  "informational",
  "notable",
  "important",
  "critical",
] as const;

export function isNarrativeSeverity(value: string): value is NarrativeSeverity {
  return (NARRATIVE_SEVERITIES as readonly string[]).includes(value);
}

export type NarrativeSituationStatus =
  | "active"
  | "acknowledged"
  | "resolved"
  | "expired"
  | "escalated";

export const NARRATIVE_SITUATION_STATUSES: readonly NarrativeSituationStatus[] =
  ["active", "acknowledged", "resolved", "expired", "escalated"] as const;

export function isNarrativeSituationStatus(
  value: string,
): value is NarrativeSituationStatus {
  return (NARRATIVE_SITUATION_STATUSES as readonly string[]).includes(value);
}

/** Structured evidence — numbers/flags only; prose is derived. */
export type NarrativeEvidence = Record<string, number | boolean | string>;

export type NarrativeSituationAction = {
  /** Application-adapter actionId — never a command string. */
  id: string;
  label: string;
  href?: string;
  /** Plain-language tradeoff for the dashboard. */
  effectSummary?: string;
};

export type NarrativeSituationUpdate = {
  occurredOn: string;
  severity: NarrativeSeverity;
  title: string;
  summary: string;
  evidence: NarrativeEvidence;
};

export const NARRATIVE_UPDATES_MAX = 8;
export const NARRATIVE_SITUATIONS_MAX = 100;
export const NARRATIVE_SNAPSHOTS_MAX = 24;

export type NarrativeSituationRelated = {
  teamId?: TeamId;
  objectiveId?: OwnerObjectiveId;
  staffId?: StaffId;
  sponsorshipId?: SponsorshipId;
  rivalTeamId?: TeamId;
};

export type NarrativeSituation = {
  id: NarrativeSituationId;
  detectorKey: string;
  category: NarrativeCategory;
  severity: NarrativeSeverity;
  status: NarrativeSituationStatus;
  stage: number;
  title: string;
  summary: string;
  body: string;
  createdOn: string;
  updatedOn: string;
  expiresOn?: string;
  evidence: NarrativeEvidence;
  related?: NarrativeSituationRelated;
  actions?: NarrativeSituationAction[];
  updates: NarrativeSituationUpdate[];
  relatedNotificationId?: OwnerNotificationId;
};

export type NarrativeSituationInput = {
  id: NarrativeSituationId;
  detectorKey: string;
  category: NarrativeCategory;
  severity: NarrativeSeverity;
  status: NarrativeSituationStatus;
  stage: number;
  title: string;
  summary: string;
  body: string;
  createdOn: string;
  updatedOn: string;
  expiresOn?: string;
  evidence: NarrativeEvidence;
  related?: NarrativeSituationRelated;
  actions?: NarrativeSituationAction[];
  updates: NarrativeSituationUpdate[];
  relatedNotificationId?: OwnerNotificationId;
};

export function createNarrativeSituation(
  input: NarrativeSituationInput,
): NarrativeSituation {
  assertNonEmptyString(input.id, "id");
  assertNonEmptyString(input.detectorKey, "detectorKey");
  if (!isNarrativeCategory(input.category)) {
    throw new Error(
      `NarrativeSituation category must be one of ${NARRATIVE_CATEGORIES.join(", ")}.`,
    );
  }
  if (!isNarrativeSeverity(input.severity)) {
    throw new Error(
      `NarrativeSituation severity must be one of ${NARRATIVE_SEVERITIES.join(", ")}.`,
    );
  }
  if (!isNarrativeSituationStatus(input.status)) {
    throw new Error(
      `NarrativeSituation status must be one of ${NARRATIVE_SITUATION_STATUSES.join(", ")}.`,
    );
  }
  if (!Number.isInteger(input.stage) || input.stage < 0) {
    throw new Error("NarrativeSituation stage must be a non-negative integer.");
  }
  assertNonEmptyString(input.title, "title");
  assertNonEmptyString(input.summary, "summary");
  assertNonEmptyString(input.body, "body");
  assertNonEmptyString(input.createdOn, "createdOn");
  assertNonEmptyString(input.updatedOn, "updatedOn");
  if (input.expiresOn !== undefined) {
    assertNonEmptyString(input.expiresOn, "expiresOn");
  }
  if (
    input.evidence === null ||
    typeof input.evidence !== "object" ||
    Array.isArray(input.evidence)
  ) {
    throw new Error("NarrativeSituation evidence must be a record.");
  }
  if (!Array.isArray(input.updates)) {
    throw new Error("NarrativeSituation updates must be an array.");
  }

  const situation: NarrativeSituation = {
    id: input.id,
    detectorKey: input.detectorKey,
    category: input.category,
    severity: input.severity,
    status: input.status,
    stage: input.stage,
    title: input.title,
    summary: input.summary,
    body: input.body,
    createdOn: input.createdOn,
    updatedOn: input.updatedOn,
    evidence: { ...input.evidence },
    updates: input.updates.slice(-NARRATIVE_UPDATES_MAX),
  };
  if (input.expiresOn !== undefined) {
    situation.expiresOn = input.expiresOn;
  }
  if (input.related !== undefined) {
    situation.related = { ...input.related };
  }
  if (input.actions !== undefined) {
    situation.actions = input.actions.map((action) => ({ ...action }));
  }
  if (input.relatedNotificationId !== undefined) {
    situation.relatedNotificationId = input.relatedNotificationId;
  }
  return situation;
}

/** Lean monthly ring — period deltas only, not a GameState copy. */
export type NarrativeMonthSnapshot = {
  monthId: string;
  attendanceAvg: number;
  fillRatePct: number;
  ticketMerchRevenue: number;
  fanSentiment: number;
  reputation: number;
  mediaAttention: number;
  cash: number;
  healthBand: string;
  wins: number;
  losses: number;
  franchiseValue: number;
};

export type NarrativeState = {
  situations: NarrativeSituation[];
  snapshots: NarrativeMonthSnapshot[];
  /** detectorKey → YYYY-MM-DD cooldown until */
  cooldowns: Record<string, string>;
};

export function createEmptyNarrativeState(): NarrativeState {
  return {
    situations: [],
    snapshots: [],
    cooldowns: {},
  };
}

function assertNonEmptyString(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`NarrativeSituation ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(
      `NarrativeSituation ${field} cannot be whitespace-only.`,
    );
  }
}
