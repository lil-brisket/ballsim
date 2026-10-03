import {
  isPlayerArchetype,
  ARCHETYPE_COMPATIBLE_POSITIONS,
} from "@/domain/entities/player-archetype";
import { isPlayerNationality } from "@/domain/entities/player-nationality";
import {
  PLAYER_ATTRIBUTE_KEYS,
  PLAYER_POSITIONS,
  RATING_MAX,
  RATING_MIN,
  type PlayerAttributes,
  type PlayerPersonality,
  type PlayerPosition,
  type PlayerPotential,
} from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import {
  POSITION_BODY_RANGES,
  potentialGapBandForAge,
} from "@/systems/player-generation-config";
import {
  issue,
  type PlayerSourceRecord,
  type ValidationIssue,
} from "@/systems/custom-content/package-types";

function isPlayerPosition(value: string): value is PlayerPosition {
  return (PLAYER_POSITIONS as readonly string[]).includes(value);
}

const BODY_ENVELOPE = {
  minHeightInches: 72,
  maxHeightInches: 84,
  minWeightPounds: 180,
  maxWeightPounds: 260,
};

const MIN_PLAUSIBLE_AGE = 18;
const MAX_PLAUSIBLE_AGE = 45;
const OVERALL_LOW_WARNING = 40;
const OVERALL_HIGH_WARNING = 85;

const PERSONALITY_KEYS = [
  "workEthic",
  "loyalty",
  "competitiveness",
  "leadership",
  "composure",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function assertRating(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(
      issue(path, "invalid_rating", `${path} must be an integer ${RATING_MIN}–${RATING_MAX}.`),
    );
    return undefined;
  }
  if (value < RATING_MIN || value > RATING_MAX) {
    errors.push(
      issue(
        path,
        "rating_out_of_range",
        `${path} must be between ${RATING_MIN} and ${RATING_MAX}.`,
      ),
    );
    return undefined;
  }
  return value;
}

export function readPlayerSourceRecord(
  raw: unknown,
  path: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): PlayerSourceRecord | undefined {
  const record = asRecord(raw);
  if (record === null) {
    errors.push(issue(path, "invalid_player", `${path} must be an object.`));
    return undefined;
  }

  const sourceId = record.sourceId;
  if (typeof sourceId !== "string" || sourceId.trim().length === 0) {
    errors.push(
      issue(`${path}.sourceId`, "missing_source_id", `${path}.sourceId is required.`),
    );
  }

  const firstName = record.firstName;
  const lastName = record.lastName;
  if (typeof firstName !== "string" || firstName.trim().length === 0) {
    errors.push(
      issue(`${path}.firstName`, "invalid_first_name", `${path}.firstName is required.`),
    );
  }
  if (typeof lastName !== "string" || lastName.trim().length === 0) {
    errors.push(
      issue(`${path}.lastName`, "invalid_last_name", `${path}.lastName is required.`),
    );
  }

  const nationality = record.nationality;
  if (typeof nationality !== "string" || !isPlayerNationality(nationality)) {
    errors.push(
      issue(
        `${path}.nationality`,
        "invalid_nationality",
        `${path}.nationality is not a supported nationality.`,
      ),
    );
  }

  const age = record.age;
  if (typeof age !== "number" || !Number.isInteger(age) || age < 0) {
    errors.push(issue(`${path}.age`, "invalid_age", `${path}.age must be a non-negative integer.`));
  } else if (age < MIN_PLAUSIBLE_AGE || age > MAX_PLAUSIBLE_AGE) {
    errors.push(
      issue(
        `${path}.age`,
        "age_out_of_bounds",
        `${path}.age must be between ${MIN_PLAUSIBLE_AGE} and ${MAX_PLAUSIBLE_AGE}.`,
      ),
    );
  }

  const position = record.position;
  if (typeof position !== "string" || !isPlayerPosition(position)) {
    errors.push(
      issue(`${path}.position`, "invalid_position", `${path}.position is not a valid position.`),
    );
  }

  const archetype = record.archetype;
  if (typeof archetype !== "string" || !isPlayerArchetype(archetype)) {
    errors.push(
      issue(
        `${path}.archetype`,
        "invalid_archetype",
        `${path}.archetype is not a valid archetype.`,
      ),
    );
  } else if (
    typeof position === "string" &&
    isPlayerPosition(position) &&
    !ARCHETYPE_COMPATIBLE_POSITIONS[archetype].includes(position)
  ) {
    errors.push(
      issue(
        `${path}.archetype`,
        "archetype_position_incompatible",
        `${archetype} is not compatible with position ${position}.`,
      ),
    );
  }

  const heightInches = record.heightInches;
  const weightPounds = record.weightPounds;
  if (typeof heightInches !== "number" || !Number.isFinite(heightInches) || heightInches <= 0) {
    errors.push(
      issue(
        `${path}.heightInches`,
        "invalid_height",
        `${path}.heightInches must be a positive number.`,
      ),
    );
  } else if (
    heightInches < BODY_ENVELOPE.minHeightInches ||
    heightInches > BODY_ENVELOPE.maxHeightInches
  ) {
    errors.push(
      issue(
        `${path}.heightInches`,
        "height_out_of_bounds",
        `${path}.heightInches is outside plausible bounds (${BODY_ENVELOPE.minHeightInches}–${BODY_ENVELOPE.maxHeightInches}).`,
      ),
    );
  } else if (typeof position === "string" && isPlayerPosition(position)) {
    const range = POSITION_BODY_RANGES[position as PlayerPosition];
    if (heightInches < range.minHeightInches || heightInches > range.maxHeightInches) {
      warnings.push(
        issue(
          `${path}.heightInches`,
          "unusual_height_for_position",
          `${path}.heightInches is unusual for ${position}.`,
          "warning",
        ),
      );
    }
  }

  if (typeof weightPounds !== "number" || !Number.isFinite(weightPounds) || weightPounds <= 0) {
    errors.push(
      issue(
        `${path}.weightPounds`,
        "invalid_weight",
        `${path}.weightPounds must be a positive number.`,
      ),
    );
  } else if (
    weightPounds < BODY_ENVELOPE.minWeightPounds ||
    weightPounds > BODY_ENVELOPE.maxWeightPounds
  ) {
    errors.push(
      issue(
        `${path}.weightPounds`,
        "weight_out_of_bounds",
        `${path}.weightPounds is outside plausible bounds (${BODY_ENVELOPE.minWeightPounds}–${BODY_ENVELOPE.maxWeightPounds}).`,
      ),
    );
  } else if (typeof position === "string" && isPlayerPosition(position)) {
    const range = POSITION_BODY_RANGES[position as PlayerPosition];
    if (weightPounds < range.minWeightPounds || weightPounds > range.maxWeightPounds) {
      warnings.push(
        issue(
          `${path}.weightPounds`,
          "unusual_weight_for_position",
          `${path}.weightPounds is unusual for ${position}.`,
          "warning",
        ),
      );
    }
  }

  const attributesRaw = asRecord(record.attributes);
  const attributes = {} as PlayerAttributes;
  if (attributesRaw === null) {
    errors.push(
      issue(`${path}.attributes`, "invalid_attributes", `${path}.attributes must be an object.`),
    );
  } else {
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const rating = assertRating(
        attributesRaw[key],
        `${path}.attributes.${key}`,
        errors,
      );
      if (rating !== undefined) {
        attributes[key] = rating;
      }
    }
  }

  const potentialRaw = asRecord(record.potential);
  let potential: PlayerPotential | undefined;
  if (potentialRaw === null) {
    errors.push(
      issue(`${path}.potential`, "invalid_potential", `${path}.potential must be an object.`),
    );
  } else {
    const overall = assertRating(
      potentialRaw.overall,
      `${path}.potential.overall`,
      errors,
    );
    if (overall !== undefined) {
      potential = { overall };
    }
  }

  const personalityRaw = asRecord(record.personality);
  const personality = {} as PlayerPersonality;
  if (personalityRaw === null) {
    errors.push(
      issue(
        `${path}.personality`,
        "invalid_personality",
        `${path}.personality must be an object.`,
      ),
    );
  } else {
    for (const key of PERSONALITY_KEYS) {
      const rating = assertRating(
        personalityRaw[key],
        `${path}.personality.${key}`,
        errors,
      );
      if (rating !== undefined) {
        personality[key] = rating;
      }
    }
  }

  if (record.durability !== undefined) {
    assertRating(record.durability, `${path}.durability`, errors);
  }

  if (
    typeof position === "string" &&
    isPlayerPosition(position) &&
    PLAYER_ATTRIBUTE_KEYS.every((key) => typeof attributes[key] === "number") &&
    potential !== undefined &&
    typeof age === "number"
  ) {
    const overall = calculatePlayerOverall(position, attributes);
    if (overall < OVERALL_LOW_WARNING || overall > OVERALL_HIGH_WARNING) {
      warnings.push(
        issue(
          `${path}.attributes`,
          "unusual_overall",
          `${path} overall ${overall} is far from typical league range.`,
          "warning",
        ),
      );
    }
    const band = potentialGapBandForAge(age);
    if (potential.overall > overall + band.max) {
      warnings.push(
        issue(
          `${path}.potential.overall`,
          "potential_above_age_ceiling",
          `${path}.potential.overall exceeds the age-appropriate ceiling.`,
          "warning",
        ),
      );
    }
  }

  if (
    typeof sourceId !== "string" ||
    sourceId.trim().length === 0 ||
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof nationality !== "string" ||
    !isPlayerNationality(nationality) ||
    typeof age !== "number" ||
    typeof heightInches !== "number" ||
    typeof weightPounds !== "number" ||
    typeof position !== "string" ||
    !isPlayerPosition(position) ||
    typeof archetype !== "string" ||
    !isPlayerArchetype(archetype) ||
    potential === undefined ||
    PLAYER_ATTRIBUTE_KEYS.some((key) => typeof attributes[key] !== "number") ||
    PERSONALITY_KEYS.some((key) => typeof personality[key] !== "number")
  ) {
    return undefined;
  }

  return {
    sourceId: sourceId.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    nationality,
    age,
    heightInches,
    weightPounds,
    position,
    archetype,
    attributes,
    potential,
    personality,
    durability:
      typeof record.durability === "number" ? record.durability : undefined,
  };
}

export function duplicateNameIssues(
  players: readonly PlayerSourceRecord[],
  pathPrefix: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byName = new Map<string, PlayerSourceRecord[]>();
  for (const player of players) {
    const key = `${player.firstName.toLowerCase()}|${player.lastName.toLowerCase()}`;
    const existing = byName.get(key) ?? [];
    existing.push(player);
    byName.set(key, existing);
  }
  for (const group of byName.values()) {
    if (group.length < 2) {
      continue;
    }
    const [first, ...rest] = group;
    for (const other of rest) {
      const sameAttributes =
        JSON.stringify(first!.attributes) === JSON.stringify(other.attributes) &&
        first!.age === other.age &&
        first!.position === other.position &&
        first!.archetype === other.archetype;
      if (sameAttributes && first!.sourceId !== other.sourceId) {
        issues.push(
          issue(
            `${pathPrefix}`,
            "duplicate_player_copy",
            `Duplicate name ${first!.firstName} ${first!.lastName} with identical attributes and conflicting IDs.`,
          ),
        );
      } else {
        issues.push(
          issue(
            `${pathPrefix}`,
            "duplicate_player_name",
            `Duplicate name ${first!.firstName} ${first!.lastName} with different IDs.`,
            "warning",
          ),
        );
      }
    }
  }
  return issues;
}
