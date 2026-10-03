import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  CUSTOM_CONTENT_FORMAT_VERSION,
  issue,
  validationResult,
  type CustomContentCompatibility,
  type CustomContentEnvelope,
  type CustomContentMetadata,
  type CustomContentPackage,
  type CustomContentType,
  type ImportValidationResult,
  type ValidationIssue,
} from "@/systems/custom-content/package-types";

function isIsoDate(value: string): boolean {
  if (value.length < 10) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSemverLike(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function validateMetadata(
  raw: unknown,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): CustomContentMetadata | undefined {
  const record = asRecord(raw);
  if (record === null) {
    errors.push(
      issue("metadata", "missing_metadata", "Package metadata is required."),
    );
    return undefined;
  }
  const title = record.title;
  const version = record.version;
  const createdAt = record.createdAt;
  const updatedAt = record.updatedAt;
  if (typeof title !== "string" || title.trim().length === 0) {
    errors.push(
      issue("metadata.title", "invalid_title", "metadata.title is required."),
    );
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    errors.push(
      issue(
        "metadata.version",
        "invalid_version",
        "metadata.version is required.",
      ),
    );
  } else if (!isSemverLike(version)) {
    warnings.push(
      issue(
        "metadata.version",
        "version_not_semver",
        "metadata.version should be semver (e.g. 1.0.0).",
        "warning",
      ),
    );
  }
  if (typeof createdAt !== "string" || !isIsoDate(createdAt)) {
    errors.push(
      issue(
        "metadata.createdAt",
        "invalid_created_at",
        "metadata.createdAt must be an ISO date string.",
      ),
    );
  }
  if (typeof updatedAt !== "string" || !isIsoDate(updatedAt)) {
    errors.push(
      issue(
        "metadata.updatedAt",
        "invalid_updated_at",
        "metadata.updatedAt must be an ISO date string.",
      ),
    );
  }
  if (record.description === undefined) {
    warnings.push(
      issue(
        "metadata.description",
        "missing_description",
        "Optional metadata.description is missing.",
        "warning",
      ),
    );
  } else if (typeof record.description !== "string") {
    errors.push(
      issue(
        "metadata.description",
        "invalid_description",
        "metadata.description must be a string.",
      ),
    );
  }
  if (record.author === undefined) {
    warnings.push(
      issue(
        "metadata.author",
        "missing_author",
        "Optional metadata.author is missing.",
        "warning",
      ),
    );
  } else if (typeof record.author !== "string") {
    errors.push(
      issue(
        "metadata.author",
        "invalid_author",
        "metadata.author must be a string.",
      ),
    );
  }
  if (errors.some((entry) => entry.path.startsWith("metadata"))) {
    return undefined;
  }
  return {
    title: String(title).trim(),
    version: String(version),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
    description:
      typeof record.description === "string" ? record.description : undefined,
    author: typeof record.author === "string" ? record.author : undefined,
  };
}

function validateCompatibility(
  raw: unknown,
  errors: ValidationIssue[],
): CustomContentCompatibility | undefined {
  const record = asRecord(raw);
  if (record === null) {
    errors.push(
      issue(
        "compatibility",
        "missing_compatibility",
        "Package compatibility is required.",
      ),
    );
    return undefined;
  }
  const gameStateSchemaVersion = record.gameStateSchemaVersion;
  const minSchemaVersion = record.minSchemaVersion;
  if (
    typeof gameStateSchemaVersion !== "number" ||
    !Number.isInteger(gameStateSchemaVersion)
  ) {
    errors.push(
      issue(
        "compatibility.gameStateSchemaVersion",
        "invalid_schema_version",
        "compatibility.gameStateSchemaVersion must be an integer.",
      ),
    );
  } else if (gameStateSchemaVersion > GAME_STATE_SCHEMA_VERSION) {
    errors.push(
      issue(
        "compatibility.gameStateSchemaVersion",
        "unsupported_schema",
        `Package targets schema ${gameStateSchemaVersion}, newer than ${GAME_STATE_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (
    typeof minSchemaVersion !== "number" ||
    !Number.isInteger(minSchemaVersion)
  ) {
    errors.push(
      issue(
        "compatibility.minSchemaVersion",
        "invalid_min_schema_version",
        "compatibility.minSchemaVersion must be an integer.",
      ),
    );
  } else if (minSchemaVersion > GAME_STATE_SCHEMA_VERSION) {
    errors.push(
      issue(
        "compatibility.minSchemaVersion",
        "unsupported_min_schema",
        `Package requires minSchemaVersion ${minSchemaVersion}, newer than ${GAME_STATE_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (
    typeof gameStateSchemaVersion !== "number" ||
    typeof minSchemaVersion !== "number"
  ) {
    return undefined;
  }
  return { gameStateSchemaVersion, minSchemaVersion };
}

export function parseCustomContentJson(
  raw: string,
): ImportValidationResult<unknown> {
  try {
    return validationResult([], [], JSON.parse(raw) as unknown);
  } catch {
    return validationResult(
      [
        issue(
          "",
          "invalid_json",
          "Package is not valid JSON.",
        ),
      ],
      [],
    );
  }
}

export function rosterTeamCountFromPackageJson(
  packageJson: string,
): number | null {
  if (packageJson.length === 0) {
    return null;
  }
  const parsed = parseCustomContentJson(packageJson);
  if (!parsed.ok || parsed.normalized === undefined) {
    return null;
  }
  const envelope = parseCustomContentEnvelope(parsed.normalized);
  if (!envelope.ok || envelope.normalized === undefined) {
    return null;
  }
  if (envelope.normalized.type !== "roster") {
    return null;
  }
  const payload = envelope.normalized.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const teams = (payload as { teams?: unknown }).teams;
  return Array.isArray(teams) ? teams.length : null;
}

export function parseCustomContentEnvelope(
  raw: unknown,
): ImportValidationResult<CustomContentPackage> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const record = asRecord(raw);
  if (record === null) {
    return validationResult(
      [issue("", "invalid_envelope", "Package envelope must be an object.")],
      [],
    );
  }

  if (record.formatVersion !== CUSTOM_CONTENT_FORMAT_VERSION) {
    errors.push(
      issue(
        "formatVersion",
        record.formatVersion === undefined
          ? "missing_format_version"
          : "unsupported_format_version",
        `formatVersion must be ${CUSTOM_CONTENT_FORMAT_VERSION}.`,
      ),
    );
  }

  const type = record.type;
  if (type !== "roster" && type !== "draft_class") {
    errors.push(
      issue(
        "type",
        "invalid_type",
        'type must be "roster" or "draft_class".',
      ),
    );
  }

  const contentId = record.contentId;
  if (typeof contentId !== "string" || contentId.trim().length === 0) {
    errors.push(
      issue("contentId", "invalid_content_id", "contentId is required."),
    );
  } else if (!isUuidLike(contentId)) {
    warnings.push(
      issue(
        "contentId",
        "content_id_not_uuid",
        "contentId should be a UUID.",
        "warning",
      ),
    );
  }

  const metadata = validateMetadata(record.metadata, errors, warnings);
  const compatibility = validateCompatibility(record.compatibility, errors);

  if (record.payload === undefined) {
    errors.push(issue("payload", "missing_payload", "payload is required."));
  }

  if (
    errors.length > 0 ||
    metadata === undefined ||
    compatibility === undefined ||
    (type !== "roster" && type !== "draft_class") ||
    typeof contentId !== "string"
  ) {
    return validationResult(errors, warnings);
  }

  const envelope: CustomContentEnvelope<CustomContentType, unknown> = {
    formatVersion: CUSTOM_CONTENT_FORMAT_VERSION,
    type,
    contentId: contentId.trim(),
    metadata,
    compatibility,
    payload: record.payload,
  };
  return validationResult(errors, warnings, envelope as CustomContentPackage);
}
