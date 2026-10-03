import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import {
  issue,
  validationResult,
  type ImportValidationResult,
  type PlayerContractSource,
  type RosterPackage,
  type RosterPackagePayload,
  type RosterPlayerSource,
  type RosterTeamSource,
  type RosterValidationContext,
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

function readTeam(
  raw: unknown,
  path: string,
  errors: ValidationIssue[],
): RosterTeamSource | undefined {
  const record = asRecord(raw);
  if (record === null) {
    errors.push(issue(path, "invalid_team", `${path} must be an object.`));
    return undefined;
  }
  const sourceId = record.sourceId;
  const name = record.name;
  if (typeof sourceId !== "string" || sourceId.trim().length === 0) {
    errors.push(
      issue(`${path}.sourceId`, "missing_source_id", `${path}.sourceId is required.`),
    );
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push(issue(`${path}.name`, "invalid_team_name", `${path}.name is required.`));
  }
  if (record.city !== undefined && typeof record.city !== "string") {
    errors.push(issue(`${path}.city`, "invalid_city", `${path}.city must be a string.`));
  }
  if (record.abbreviation !== undefined && typeof record.abbreviation !== "string") {
    errors.push(
      issue(
        `${path}.abbreviation`,
        "invalid_abbreviation",
        `${path}.abbreviation must be a string.`,
      ),
    );
  }
  if (typeof sourceId !== "string" || typeof name !== "string") {
    return undefined;
  }
  return {
    sourceId: sourceId.trim(),
    name: name.trim(),
    city: typeof record.city === "string" ? record.city : undefined,
    abbreviation:
      typeof record.abbreviation === "string" ? record.abbreviation : undefined,
  };
}

function readContract(
  raw: unknown,
  path: string,
  errors: ValidationIssue[],
): PlayerContractSource | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const record = asRecord(raw);
  if (record === null) {
    errors.push(issue(path, "invalid_contract", `${path} must be an object.`));
    return undefined;
  }
  const years = record.years;
  if (typeof years !== "number" || !Number.isInteger(years) || years < 1 || years > 6) {
    errors.push(
      issue(`${path}.years`, "invalid_contract_years", `${path}.years must be 1–6.`),
    );
  }
  if (
    record.annualSalary !== undefined &&
    (typeof record.annualSalary !== "number" ||
      !Number.isInteger(record.annualSalary) ||
      record.annualSalary < 1)
  ) {
    errors.push(
      issue(
        `${path}.annualSalary`,
        "invalid_annual_salary",
        `${path}.annualSalary must be a positive integer.`,
      ),
    );
  }
  if (typeof years !== "number") {
    return undefined;
  }
  return {
    years,
    annualSalary:
      typeof record.annualSalary === "number" ? record.annualSalary : undefined,
  };
}

export function validateRosterPayload(
  raw: unknown,
  context: RosterValidationContext,
  envelopeContentId: string,
): ImportValidationResult<RosterPackagePayload> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const record = asRecord(raw);
  if (record === null) {
    return validationResult(
      [issue("payload", "invalid_payload", "payload must be an object.")],
      [],
    );
  }

  const teamsRaw = asArray(record.teams);
  const playersRaw = asArray(record.players);
  if (teamsRaw === null) {
    errors.push(issue("payload.teams", "invalid_teams", "payload.teams must be an array."));
  }
  if (playersRaw === null) {
    errors.push(
      issue("payload.players", "invalid_players", "payload.players must be an array."),
    );
  }
  if (teamsRaw === null || playersRaw === null) {
    return validationResult(errors, warnings);
  }

  const teams: RosterTeamSource[] = [];
  const teamSourceIds = new Set<string>();
  for (let index = 0; index < teamsRaw.length; index += 1) {
    const team = readTeam(teamsRaw[index], `payload.teams[${index}]`, errors);
    if (team === undefined) {
      continue;
    }
    if (teamSourceIds.has(team.sourceId)) {
      errors.push(
        issue(
          `payload.teams[${index}].sourceId`,
          "duplicate_source_id",
          `Duplicate team sourceId "${team.sourceId}".`,
        ),
      );
    }
    teamSourceIds.add(team.sourceId);
    teams.push(team);
  }

  if (teams.length !== context.teamCount) {
    errors.push(
      issue(
        "payload.teams",
        "team_count_mismatch",
        `Package has ${teams.length} teams; league has ${context.teamCount}.`,
      ),
    );
  }

  const players: RosterPlayerSource[] = [];
  const playerSourceIds = new Set<string>();
  const rosterCounts = new Map<string, number>();
  for (let index = 0; index < playersRaw.length; index += 1) {
    const path = `payload.players[${index}]`;
    const playerRecord = asRecord(playersRaw[index]);
    const source = readPlayerSourceRecord(playersRaw[index], path, errors, warnings);
    if (playerRecord === null) {
      continue;
    }
    const teamSourceId = playerRecord.teamSourceId;
    if (teamSourceId !== null && typeof teamSourceId !== "string") {
      errors.push(
        issue(
          `${path}.teamSourceId`,
          "invalid_team_source_id",
          `${path}.teamSourceId must be a string or null.`,
        ),
      );
    } else if (typeof teamSourceId === "string" && !teamSourceIds.has(teamSourceId)) {
      errors.push(
        issue(
          `${path}.teamSourceId`,
          "missing_team_ref",
          `${path}.teamSourceId "${teamSourceId}" does not match a package team.`,
        ),
      );
    }
    const contract = readContract(playerRecord.contract, `${path}.contract`, errors);
    if (contract !== undefined && (teamSourceId === null || teamSourceId === undefined)) {
      errors.push(
        issue(
          `${path}.contract`,
          "contract_without_team",
          `${path} has contract terms but no team assignment.`,
        ),
      );
    }
    if (source === undefined) {
      continue;
    }
    if (playerSourceIds.has(source.sourceId)) {
      errors.push(
        issue(
          `${path}.sourceId`,
          "duplicate_source_id",
          `Duplicate player sourceId "${source.sourceId}".`,
        ),
      );
    }
    playerSourceIds.add(source.sourceId);
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
    if (typeof teamSourceId === "string") {
      rosterCounts.set(teamSourceId, (rosterCounts.get(teamSourceId) ?? 0) + 1);
    }
    players.push({
      ...source,
      teamSourceId: typeof teamSourceId === "string" ? teamSourceId : null,
      contract,
    });
  }

  for (const [sourceId, count] of rosterCounts) {
    if (count < TRADE_ROSTER_RULES.minRosterSize || count > TRADE_ROSTER_RULES.maxRosterSize) {
      errors.push(
        issue(
          "payload.players",
          "roster_size_out_of_bounds",
          `Team "${sourceId}" roster size ${count} is outside ${TRADE_ROSTER_RULES.minRosterSize}–${TRADE_ROSTER_RULES.maxRosterSize}.`,
        ),
      );
    } else if (count !== DEFAULT_ROSTER_SIZE) {
      warnings.push(
        issue(
          "payload.players",
          "roster_size_differs_from_default",
          `Team "${sourceId}" roster size ${count} differs from the league default ${DEFAULT_ROSTER_SIZE}.`,
          "warning",
        ),
      );
    }
  }

  const nameIssues = duplicateNameIssues(players, "payload.players");
  for (const nameIssue of nameIssues) {
    if (nameIssue.severity === "error") {
      errors.push(nameIssue);
    } else {
      warnings.push(nameIssue);
    }
  }

  if (context.salaryCapEnabled === true && context.salaryCap !== undefined) {
    const payrollByTeam = new Map<string, number>();
    for (const player of players) {
      if (player.teamSourceId === null) {
        continue;
      }
      const salary = player.contract?.annualSalary;
      if (typeof salary === "number") {
        payrollByTeam.set(
          player.teamSourceId,
          (payrollByTeam.get(player.teamSourceId) ?? 0) + salary,
        );
      }
    }
    for (const [sourceId, payroll] of payrollByTeam) {
      if (payroll > context.salaryCap) {
        warnings.push(
          issue(
            "payload.players",
            "payroll_over_cap",
            `Team "${sourceId}" projected payroll exceeds the salary cap.`,
            "warning",
          ),
        );
      }
    }
  }

  return validationResult(errors, warnings, { teams, players });
}

export function validateRosterPackage(
  raw: unknown,
  context: RosterValidationContext,
): ImportValidationResult<RosterPackage> {
  const envelope = parseCustomContentEnvelope(raw);
  const errors = [...envelope.errors];
  const warnings = [...envelope.warnings];
  if (!envelope.ok || envelope.normalized === undefined) {
    return validationResult(errors, warnings);
  }
  if (envelope.normalized.type !== "roster") {
    errors.push(
      issue("type", "wrong_package_type", 'Package type must be "roster".'),
    );
    return validationResult(errors, warnings);
  }
  const payload = validateRosterPayload(
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
    type: "roster",
    payload: payload.normalized,
  });
}
