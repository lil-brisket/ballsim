import { addCalendarDays } from "@/domain/calendar-date";
import {
  createNarrativeSituation,
  NARRATIVE_SITUATIONS_MAX,
  NARRATIVE_UPDATES_MAX,
  type NarrativeSituation,
  type NarrativeSituationStatus,
} from "@/domain/entities/narrative-situation";
import {
  createOwnerNotification,
  type OwnerNotification,
  type OwnerNotificationSeverity,
} from "@/domain/entities/owner-notification";
import {
  asNarrativeSituationId,
  asOwnerNotificationId,
  asOwnerObjectiveId,
  asSponsorshipId,
  asTeamId,
  type NarrativeSituationId,
} from "@/domain/ids";
import type { DetectorCandidate } from "@/systems/narrative/types";
import type { RenderedNarrative } from "@/systems/narrative/templates";
import { DEFAULT_COOLDOWN_DAYS } from "@/systems/narrative/spam";

function mapSeverity(
  severity: DetectorCandidate["severity"],
): OwnerNotificationSeverity {
  switch (severity) {
    case "critical":
      return "critical";
    case "important":
      return "warning";
    case "notable":
      return "info";
    default:
      return "info";
  }
}

function situationIdFor(
  detectorKey: string,
  teamId: string,
  window: string,
): NarrativeSituationId {
  return asNarrativeSituationId(`nar_${detectorKey}_${teamId}_${window}`);
}

export function findOpenSituation(
  situations: readonly NarrativeSituation[],
  detectorKey: string,
): NarrativeSituation | undefined {
  const keys =
    detectorKey === "fan_demand"
      ? ["fan_demand", "attendance_decline"]
      : [detectorKey];
  return situations.find(
    (situation) =>
      keys.includes(situation.detectorKey) &&
      (situation.status === "active" ||
        situation.status === "acknowledged" ||
        situation.status === "escalated"),
  );
}

export function acknowledgeSituation(
  situation: NarrativeSituation,
  date: string,
): NarrativeSituation {
  if (
    situation.status === "resolved" ||
    situation.status === "expired"
  ) {
    return situation;
  }
  return {
    ...situation,
    status: "acknowledged",
    updatedOn: date,
  };
}

export function expireSituation(
  situation: NarrativeSituation,
  date: string,
): NarrativeSituation {
  return {
    ...situation,
    status: "expired",
    updatedOn: date,
  };
}

export function resolveSituation(
  situation: NarrativeSituation,
  date: string,
  rendered?: RenderedNarrative,
): NarrativeSituation {
  const updates = rendered
    ? [
        ...situation.updates,
        {
          occurredOn: date,
          severity: rendered.severity,
          title: rendered.title,
          summary: rendered.summary,
          evidence: situation.evidence,
        },
      ].slice(-NARRATIVE_UPDATES_MAX)
    : situation.updates;

  return {
    ...situation,
    status: "resolved",
    updatedOn: date,
    title: rendered?.title ?? situation.title,
    summary: rendered?.summary ?? situation.summary,
    body: rendered?.body ?? situation.body,
    updates,
  };
}

export type ApplyCandidateResult = {
  situations: NarrativeSituation[];
  notification: OwnerNotification | null;
  cooldownKey?: string;
  cooldownUntil?: string;
};

/**
 * Open, escalate, or resolve a situation from a selected candidate + rendered copy.
 */
export function applyCandidateToSituations(
  situations: readonly NarrativeSituation[],
  candidate: DetectorCandidate,
  rendered: RenderedNarrative,
  date: string,
  teamId: string,
  monthId: string,
): ApplyCandidateResult {
  const storageKey =
    candidate.detectorKey === "fan_demand"
      ? "attendance_decline"
      : candidate.detectorKey;

  if (candidate.kind === "story") {
    const notification = createOwnerNotification({
      id: asOwnerNotificationId(
        `notif_nar_${storageKey}_${teamId}_${date}_${candidate.stage}`,
      ),
      type: "narrative",
      title: rendered.title,
      message: rendered.body,
      occurredOn: date,
      severity: mapSeverity(rendered.severity),
      read: false,
      dedupeKey: `narrative:${storageKey}:${teamId}:${date}:${candidate.stage}`,
      relatedTeamId: asTeamId(teamId),
    });
    return { situations: [...situations], notification };
  }

  if (candidate.resolve) {
    const open = findOpenSituation(situations, storageKey);
    if (!open) {
      return { situations: [...situations], notification: null };
    }
    const resolved = resolveSituation(open, date, rendered);
    const next = situations.map((situation) =>
      situation.id === open.id ? resolved : situation,
    );
    const notification = createOwnerNotification({
      id: asOwnerNotificationId(
        `notif_nar_${storageKey}_${teamId}_${date}_resolved`,
      ),
      type: "narrative",
      title: rendered.title,
      message: rendered.body,
      occurredOn: date,
      severity: "success",
      read: false,
      dedupeKey: `narrative:${storageKey}:${teamId}:${date}:resolved`,
      relatedTeamId: asTeamId(teamId),
      relatedSituationId: open.id,
    });
    return {
      situations: next,
      notification,
      cooldownKey: storageKey,
      cooldownUntil: addCalendarDays(date, DEFAULT_COOLDOWN_DAYS),
    };
  }

  const existing = findOpenSituation(situations, storageKey);
  const updateEntry = {
    occurredOn: date,
    severity: rendered.severity,
    title: rendered.title,
    summary: rendered.summary,
    evidence: candidate.evidence,
  };

  if (existing) {
    const status: NarrativeSituationStatus =
      candidate.stage > existing.stage ? "escalated" : "active";
    const updated: NarrativeSituation = {
      ...existing,
      detectorKey: storageKey,
      status,
      stage: candidate.stage,
      severity: candidate.severity,
      title: rendered.title,
      summary: rendered.summary,
      body: rendered.body,
      updatedOn: date,
      evidence: candidate.evidence,
      actions: candidate.actions,
      updates: [...existing.updates, updateEntry].slice(-NARRATIVE_UPDATES_MAX),
    };
    const notification = createOwnerNotification({
      id: asOwnerNotificationId(
        `notif_nar_${storageKey}_${teamId}_${date}_${candidate.stage}`,
      ),
      type: "narrative",
      title: rendered.title,
      message: rendered.body,
      occurredOn: date,
      severity: mapSeverity(rendered.severity),
      read: false,
      dedupeKey: `narrative:${storageKey}:${teamId}:${date}:${candidate.stage}`,
      relatedTeamId: asTeamId(teamId),
      relatedSituationId: existing.id,
      ...(candidate.relatedObjectiveId
        ? {
            relatedObjectiveId: asOwnerObjectiveId(
              candidate.relatedObjectiveId,
            ),
          }
        : {}),
    });
    updated.relatedNotificationId = notification.id;
    return {
      situations: situations.map((situation) =>
        situation.id === existing.id ? updated : situation,
      ),
      notification,
    };
  }

  const id = situationIdFor(storageKey, teamId, `${monthId}_s${candidate.stage}`);
  const created = createNarrativeSituation({
    id,
    detectorKey: storageKey,
    category: candidate.category,
    severity: candidate.severity,
    status: "active",
    stage: candidate.stage,
    title: rendered.title,
    summary: rendered.summary,
    body: rendered.body,
    createdOn: date,
    updatedOn: date,
    evidence: candidate.evidence,
    actions: candidate.actions,
    updates: [updateEntry],
    related: {
      teamId: asTeamId(teamId),
      ...(candidate.relatedObjectiveId
        ? {
            objectiveId: asOwnerObjectiveId(candidate.relatedObjectiveId),
          }
        : {}),
      ...(candidate.relatedSponsorshipId
        ? {
            sponsorshipId: asSponsorshipId(candidate.relatedSponsorshipId),
          }
        : {}),
      ...(candidate.relatedRivalTeamId
        ? { rivalTeamId: asTeamId(String(candidate.relatedRivalTeamId)) }
        : {}),
    },
  });

  const notification = createOwnerNotification({
    id: asOwnerNotificationId(
      `notif_nar_${storageKey}_${teamId}_${date}_${candidate.stage}`,
    ),
    type: "narrative",
    title: rendered.title,
    message: rendered.body,
    occurredOn: date,
    severity: mapSeverity(rendered.severity),
    read: false,
    dedupeKey: `narrative:${storageKey}:${teamId}:${date}:${candidate.stage}`,
    relatedTeamId: asTeamId(teamId),
    relatedSituationId: id,
  });

  const withNotif = {
    ...created,
    relatedNotificationId: notification.id,
  };

  const next = [...situations, withNotif].slice(-NARRATIVE_SITUATIONS_MAX);
  return { situations: next, notification };
}

export function expireDueSituations(
  situations: readonly NarrativeSituation[],
  date: string,
): NarrativeSituation[] {
  return situations.map((situation) => {
    if (
      situation.expiresOn &&
      situation.expiresOn <= date &&
      (situation.status === "active" ||
        situation.status === "acknowledged" ||
        situation.status === "escalated")
    ) {
      return expireSituation(situation, date);
    }
    return situation;
  });
}
