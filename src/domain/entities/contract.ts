import type { ContractId, PlayerId, TeamId } from "@/domain/ids";

export type ContractStatus =
  | "active"
  | "expired"
  | "team_option"
  | "player_option";

export type ContractOptionStatus = "pending" | "exercised" | "declined";

export const CONTRACT_OPTION_STATUSES: readonly ContractOptionStatus[] = [
  "pending",
  "exercised",
  "declined",
];

export type ContractOption = {
  year: number;
  salary: number;
  status: ContractOptionStatus;
};

export type Contract = {
  id: ContractId;
  playerId: PlayerId;
  teamId: TeamId;
  startYear: number;
  endYear: number;
  salaryByYear: Record<string, number>;
  teamOption?: ContractOption;
  playerOption?: ContractOption;
};

/** Unvalidated construction payload for {@link createContract}. */
export type ContractInput = {
  id: ContractId;
  playerId: PlayerId;
  teamId: TeamId;
  startYear: number;
  endYear: number;
  salaryByYear: Record<string, number>;
  teamOption?: ContractOption;
  playerOption?: ContractOption;
};

/**
 * Validates input and returns a new plain Contract.
 * Does not derive status or length — those are computed by helpers.
 */
export function createContract(input: ContractInput): Contract {
  assertContractShape(input);
  const contract: Contract = {
    id: input.id,
    playerId: input.playerId,
    teamId: input.teamId,
    startYear: input.startYear,
    endYear: input.endYear,
    salaryByYear: { ...input.salaryByYear },
  };
  if (input.teamOption !== undefined) {
    contract.teamOption = { ...input.teamOption };
  }
  if (input.playerOption !== undefined) {
    contract.playerOption = { ...input.playerOption };
  }
  return contract;
}

/**
 * Structural contract invariants shared by the factory and persistence validation.
 * Throws on failure. Does not check referential integrity against GameState.
 */
export function assertContractShape(contract: ContractInput | Contract): void {
  assertNonEmptyId(contract.id, "id");
  assertNonEmptyId(contract.playerId, "playerId");
  assertNonEmptyId(contract.teamId, "teamId");
  assertIntegerYear(contract.startYear, "startYear");
  assertIntegerYear(contract.endYear, "endYear");
  if (contract.startYear > contract.endYear) {
    throw new Error("Contract startYear must be <= endYear.");
  }
  assertSalaryByYearKeys(contract);
  if (contract.teamOption !== undefined && contract.playerOption !== undefined) {
    throw new Error(
      "Contract cannot have both teamOption and playerOption.",
    );
  }
  if (contract.teamOption !== undefined) {
    assertContractOption(contract.teamOption, contract, "teamOption");
  }
  if (contract.playerOption !== undefined) {
    assertContractOption(contract.playerOption, contract, "playerOption");
  }
}

export function getContractLength(contract: Contract): number {
  return contract.endYear - contract.startYear + 1;
}

/**
 * Reads only salaryByYear. Never reads option salaries.
 * Returns undefined when the year is not a guaranteed salary key.
 */
export function getContractSalaryForYear(
  contract: Contract,
  year: number,
): number | undefined {
  const value = contract.salaryByYear[String(year)];
  return value === undefined ? undefined : value;
}

export function getContractStatus(
  contract: Contract,
  currentYear: number,
): ContractStatus {
  if (contract.startYear <= currentYear && currentYear <= contract.endYear) {
    return "active";
  }
  if (currentYear > contract.endYear) {
    if (contract.teamOption?.status === "pending") {
      return "team_option";
    }
    if (contract.playerOption?.status === "pending") {
      return "player_option";
    }
  }
  return "expired";
}

export function isContractActive(
  contract: Contract,
  currentYear: number,
): boolean {
  return getContractStatus(contract, currentYear) === "active";
}

export function isContractExpired(
  contract: Contract,
  currentYear: number,
): boolean {
  return getContractStatus(contract, currentYear) === "expired";
}

export function exerciseTeamOption(contract: Contract): Contract {
  return exerciseOption(contract, "teamOption");
}

export function declineTeamOption(contract: Contract): Contract {
  return declineOption(contract, "teamOption");
}

export function exercisePlayerOption(contract: Contract): Contract {
  return exerciseOption(contract, "playerOption");
}

export function declinePlayerOption(contract: Contract): Contract {
  return declineOption(contract, "playerOption");
}

function exerciseOption(
  contract: Contract,
  field: "teamOption" | "playerOption",
): Contract {
  const option = contract[field];
  if (option === undefined) {
    throw new Error(`Contract has no ${field} to exercise.`);
  }
  if (option.status !== "pending") {
    throw new Error(`Contract ${field} must be pending to exercise.`);
  }
  const salaryByYear = {
    ...contract.salaryByYear,
    [String(option.year)]: option.salary,
  };
  const next: Contract = {
    ...contract,
    endYear: option.year,
    salaryByYear,
    [field]: { ...option, status: "exercised" as const },
  };
  assertContractShape(next);
  return next;
}

function declineOption(
  contract: Contract,
  field: "teamOption" | "playerOption",
): Contract {
  const option = contract[field];
  if (option === undefined) {
    throw new Error(`Contract has no ${field} to decline.`);
  }
  if (option.status !== "pending") {
    throw new Error(`Contract ${field} must be pending to decline.`);
  }
  const next: Contract = {
    ...contract,
    salaryByYear: { ...contract.salaryByYear },
    [field]: { ...option, status: "declined" as const },
  };
  assertContractShape(next);
  return next;
}

function assertContractOption(
  option: ContractOption,
  contract: { startYear: number; endYear: number; salaryByYear: Record<string, number> },
  field: string,
): void {
  assertIntegerYear(option.year, `${field}.year`);
  assertNonNegativeIntegerSalary(option.salary, `${field}.salary`);
  if (!isContractOptionStatus(option.status)) {
    throw new Error(
      `Contract ${field}.status must be one of ${CONTRACT_OPTION_STATUSES.join(", ")}.`,
    );
  }
  const yearKey = String(option.year);
  const salaryForYear = contract.salaryByYear[yearKey];

  if (option.status === "pending") {
    if (option.year !== contract.endYear + 1) {
      throw new Error(
        `Contract ${field} pending year must be endYear + 1.`,
      );
    }
    if (salaryForYear !== undefined) {
      throw new Error(
        `Contract ${field} pending year must not appear in salaryByYear.`,
      );
    }
    return;
  }

  if (option.status === "exercised") {
    if (option.year !== contract.endYear) {
      throw new Error(
        `Contract ${field} exercised year must equal endYear.`,
      );
    }
    if (salaryForYear !== option.salary) {
      throw new Error(
        `Contract ${field} exercised salary must match salaryByYear.`,
      );
    }
    return;
  }

  // declined
  if (option.year !== contract.endYear + 1) {
    throw new Error(
      `Contract ${field} declined year must be endYear + 1.`,
    );
  }
  if (salaryForYear !== undefined) {
    throw new Error(
      `Contract ${field} declined year must not appear in salaryByYear.`,
    );
  }
}

function assertSalaryByYearKeys(contract: {
  startYear: number;
  endYear: number;
  salaryByYear: Record<string, number>;
}): void {
  if (
    contract.salaryByYear === null ||
    typeof contract.salaryByYear !== "object" ||
    Array.isArray(contract.salaryByYear)
  ) {
    throw new Error("Contract salaryByYear must be an object.");
  }
  const expectedKeys: string[] = [];
  for (let year = contract.startYear; year <= contract.endYear; year += 1) {
    expectedKeys.push(String(year));
  }
  const actualKeys = Object.keys(contract.salaryByYear).sort();
  const expectedSorted = [...expectedKeys].sort();
  if (
    actualKeys.length !== expectedSorted.length ||
    actualKeys.some((key, index) => key !== expectedSorted[index])
  ) {
    throw new Error(
      "Contract salaryByYear keys must equal [startYear, ..., endYear] as strings.",
    );
  }
  for (const key of expectedKeys) {
    assertNonNegativeIntegerSalary(
      contract.salaryByYear[key]!,
      `salaryByYear[${key}]`,
    );
  }
}

function isContractOptionStatus(value: string): value is ContractOptionStatus {
  return CONTRACT_OPTION_STATUSES.includes(value as ContractOptionStatus);
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Contract ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Contract ${field} cannot be whitespace-only.`);
  }
}

function assertIntegerYear(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Contract ${field} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`Contract ${field} must be an integer.`);
  }
}

function assertNonNegativeIntegerSalary(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Contract ${field} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`Contract ${field} must be an integer.`);
  }
  if (value < 0) {
    throw new Error(`Contract ${field} must be >= 0.`);
  }
}
