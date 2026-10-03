import {
  issue,
  validationResult,
  type DraftClassPackage,
  type DraftClassPackagePayload,
  type DraftClassValidationContext,
  type ImportValidationResult,
  type PlayerSourceRecord,
  type ValidationIssue,
} from "@/systems/custom-content/package-types";
import { parseCustomContentEnvelope } from "@/systems/custom-content/parse";
import { canonicalCustomPlayerId } from "@/systems/custom-content/normalize";
import {
  duplicateNameIssues,
  readPlayerSourceRecord,
} from "@/systems/custom-content/validate-source-player";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function validateDraftClassPayload(
  raw: unknown,
  context: DraftClassValidationContext,
  envelopeContentId: string,
): ImportValidationResult<DraftClassPackagePayload> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const record = asRecord(raw);
  if (record === null) {
    return validationResult(
      [issue("payload", "invalid_payload", "payload must be an object.")],
      [],
    );
  }

  const draftYear = record.draftYear;
  if (typeof draftYear !== "number" || !Number.isInteger(draftYear)) {
    errors.push(
      issue(
        "payload.draftYear",
        "invalid_draft_year",
        "payload.draftYear must be an integer.",
      ),
    );
  } else if (draftYear < context.seasonYear + 1) {
    errors.push(
      issue(
        "payload.draftYear",
        "draft_year_in_past",
        `payload.draftYear ${draftYear} is in the past relative to season ${context.seasonYear}.`,
      ),
    );
  } else if (draftYear > context.draftHorizonYear) {
    errors.push(
      issue(
        "payload.draftYear",
        "draft_year_beyond_horizon",
        `payload.draftYear ${draftYear} is beyond the pick horizon ${context.draftHorizonYear}.`,
      ),
    );
  }

  const prospectsRaw = asArray(record.prospects);
  if (prospectsRaw === null) {
    errors.push(
      issue(
        "payload.prospects",
        "invalid_prospects",
        "payload.prospects must be an array.",
      ),
    );
    return validationResult(errors, warnings);
  }

  const prospects: PlayerSourceRecord[] = [];
  const sourceIds = new Set<string>();
  const identityKeys = new Set<string>();
  for (let index = 0; index < prospectsRaw.length; index += 1) {
    const path = `payload.prospects[${index}]`;
    const source = readPlayerSourceRecord(prospectsRaw[index], path, errors, warnings);
    if (source === undefined) {
      continue;
    }
    if (sourceIds.has(source.sourceId)) {
      errors.push(
        issue(
          `${path}.sourceId`,
          "duplicate_source_id",
          `Duplicate prospect sourceId "${source.sourceId}".`,
        ),
      );
    }
    sourceIds.add(source.sourceId);
    const identity = `${source.firstName.toLowerCase()}|${source.lastName.toLowerCase()}|${source.position}|${source.age}`;
    if (identityKeys.has(identity)) {
      errors.push(
        issue(
          path,
          "duplicate_prospect",
          `Duplicate prospect ${source.firstName} ${source.lastName} (${source.position}, age ${source.age}).`,
        ),
      );
    }
    identityKeys.add(identity);
    const canonicalId = canonicalCustomPlayerId(envelopeContentId, source.sourceId);
    if (context.existingPlayerIds?.has(canonicalId)) {
      errors.push(
        issue(
          `${path}.sourceId`,
          "canonical_id_collision",
          `Canonical player ID "${canonicalId}" already exists in the world.`,
        ),
      );
    }
    prospects.push(source);
  }

  const nameIssues = duplicateNameIssues(prospects, "payload.prospects");
  for (const nameIssue of nameIssues) {
    if (nameIssue.severity === "error") {
      errors.push(nameIssue);
    } else {
      warnings.push(nameIssue);
    }
  }

  if (typeof draftYear !== "number") {
    return validationResult(errors, warnings);
  }
  return validationResult(errors, warnings, { draftYear, prospects });
}

export function validateDraftClassPackage(
  raw: unknown,
  context: DraftClassValidationContext,
): ImportValidationResult<DraftClassPackage> {
  const envelope = parseCustomContentEnvelope(raw);
  const errors = [...envelope.errors];
  const warnings = [...envelope.warnings];
  if (!envelope.ok || envelope.normalized === undefined) {
    return validationResult(errors, warnings);
  }
  if (envelope.normalized.type !== "draft_class") {
    errors.push(
      issue("type", "wrong_package_type", 'Package type must be "draft_class".'),
    );
    return validationResult(errors, warnings);
  }
  const payload = validateDraftClassPayload(
    envelope.normalized.payload,
    context,
    envelope.normalized.contentId,
  );
  errors.push(...payload.errors);
  warnings.push(...payload.warnings);
  if (!payload.ok || payload.normalized === undefined) {
    return validationResult(errors, warnings);
  }
  return validationResult(errors, warnings, {
    ...envelope.normalized,
    type: "draft_class",
    payload: payload.normalized,
  });
}
