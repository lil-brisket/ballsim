import type { StaffContractId, StaffId, TeamId } from "@/domain/ids";

/**
 * Commercial employment terms for staff. Separate domain from player Contract
 * and sponsorship contracts — do not unify into one universal contract type.
 */
export type StaffContract = {
  id: StaffContractId;
  staffId: StaffId;
  teamId: TeamId;
  startYear: number;
  endYear: number;
  /** Keys are String(year). Values are non-negative integer dollars. */
  salaryByYear: Record<string, number>;
};

export type StaffContractInput = {
  id: StaffContractId;
  staffId: StaffId;
  teamId: TeamId;
  startYear: number;
  endYear: number;
  salaryByYear: Record<string, number>;
};

export function createStaffContract(input: StaffContractInput): StaffContract {
  assertStaffContractShape(input);
  return {
    id: input.id,
    staffId: input.staffId,
    teamId: input.teamId,
    startYear: input.startYear,
    endYear: input.endYear,
    salaryByYear: { ...input.salaryByYear },
  };
}

export function assertStaffContractShape(
  contract: StaffContractInput | StaffContract,
): void {
  assertNonEmptyId(contract.id, "id");
  assertNonEmptyId(contract.staffId, "staffId");
  assertNonEmptyId(contract.teamId, "teamId");
  assertIntegerYear(contract.startYear, "startYear");
  assertIntegerYear(contract.endYear, "endYear");
  if (contract.startYear > contract.endYear) {
    throw new Error("StaffContract startYear must be <= endYear.");
  }
  assertSalaryByYearKeys(contract);
}

export function getStaffContractSalaryForYear(
  contract: StaffContract,
  year: number,
): number | undefined {
  const value = contract.salaryByYear[String(year)];
  return value === undefined ? undefined : value;
}

export function isStaffContractActive(
  contract: StaffContract,
  currentYear: number,
): boolean {
  return contract.startYear <= currentYear && currentYear <= contract.endYear;
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
    throw new Error("StaffContract salaryByYear must be an object.");
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
      "StaffContract salaryByYear keys must equal [startYear, ..., endYear] as strings.",
    );
  }
  for (const key of expectedKeys) {
    assertNonNegativeIntegerSalary(
      contract.salaryByYear[key]!,
      `salaryByYear[${key}]`,
    );
  }
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`StaffContract ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`StaffContract ${field} cannot be whitespace-only.`);
  }
}

function assertIntegerYear(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`StaffContract ${field} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`StaffContract ${field} must be an integer.`);
  }
}

function assertNonNegativeIntegerSalary(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`StaffContract ${field} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`StaffContract ${field} must be an integer.`);
  }
  if (value < 0) {
    throw new Error(`StaffContract ${field} must be >= 0.`);
  }
}
