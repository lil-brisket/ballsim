import { describe, expect, it } from "vitest";
import {
  createContract,
  declinePlayerOption,
  declineTeamOption,
  exercisePlayerOption,
  exerciseTeamOption,
  getContractLength,
  getContractSalaryForYear,
  getContractStatus,
  isContractActive,
  isContractExpired,
  type ContractInput,
} from "@/domain/entities/contract";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";

function salaryMap(
  startYear: number,
  endYear: number,
  salary: number,
): Record<string, number> {
  const salaryByYear: Record<string, number> = {};
  for (let year = startYear; year <= endYear; year += 1) {
    salaryByYear[String(year)] = salary;
  }
  return salaryByYear;
}

function validInput(overrides: Partial<ContractInput> = {}): ContractInput {
  return {
    id: asContractId("contract_1"),
    playerId: asPlayerId("player_1"),
    teamId: asTeamId("team_1"),
    startYear: 2026,
    endYear: 2026,
    salaryByYear: { "2026": 10_000_000 },
    ...overrides,
  };
}

describe("createContract", () => {
  it("creates a valid multi-year contract", () => {
    const contract = createContract(
      validInput({
        endYear: 2028,
        salaryByYear: {
          "2026": 10_000_000,
          "2027": 11_000_000,
          "2028": 12_000_000,
        },
      }),
    );
    expect(contract.startYear).toBe(2026);
    expect(contract.endYear).toBe(2028);
    expect(getContractLength(contract)).toBe(3);
    expect(contract.salaryByYear["2027"]).toBe(11_000_000);
  });

  it("rejects negative salary", () => {
    expect(() =>
      createContract(validInput({ salaryByYear: { "2026": -1 } })),
    ).toThrow(/>= 0/);
  });

  it("rejects missing salary year key", () => {
    expect(() =>
      createContract(
        validInput({
          endYear: 2027,
          salaryByYear: { "2026": 1 },
        }),
      ),
    ).toThrow(/salaryByYear keys/);
  });

  it("rejects extra salary year key", () => {
    expect(() =>
      createContract(
        validInput({
          salaryByYear: { "2026": 1, "2027": 1 },
        }),
      ),
    ).toThrow(/salaryByYear keys/);
  });

  it("rejects both teamOption and playerOption", () => {
    expect(() =>
      createContract(
        validInput({
          teamOption: { year: 2027, salary: 1, status: "pending" },
          playerOption: { year: 2027, salary: 1, status: "pending" },
        }),
      ),
    ).toThrow(/both teamOption and playerOption/);
  });

  it("rejects pending option year that is not endYear + 1", () => {
    expect(() =>
      createContract(
        validInput({
          teamOption: { year: 2028, salary: 1, status: "pending" },
        }),
      ),
    ).toThrow(/pending year must be endYear \+ 1/);
  });
});

describe("getContractSalaryForYear", () => {
  it("reads only salaryByYear and ignores pending option salary", () => {
    const contract = createContract(
      validInput({
        teamOption: {
          year: 2027,
          salary: 20_000_000,
          status: "pending",
        },
      }),
    );
    expect(getContractSalaryForYear(contract, 2026)).toBe(10_000_000);
    expect(getContractSalaryForYear(contract, 2027)).toBeUndefined();
  });
});

describe("contract status and expiration", () => {
  it("reports active during guaranteed term and expired afterward", () => {
    const contract = createContract(
      validInput({
        endYear: 2027,
        salaryByYear: salaryMap(2026, 2027, 5_000_000),
      }),
    );
    expect(getContractStatus(contract, 2026)).toBe("active");
    expect(isContractActive(contract, 2027)).toBe(true);
    expect(getContractStatus(contract, 2028)).toBe("expired");
    expect(isContractExpired(contract, 2028)).toBe(true);
  });
});

describe("team option lifecycle", () => {
  const pending = () =>
    createContract(
      validInput({
        teamOption: {
          year: 2027,
          salary: 20_000_000,
          status: "pending",
        },
      }),
    );

  it("pending at option year reports team_option with no salary", () => {
    const contract = pending();
    expect(getContractStatus(contract, 2027)).toBe("team_option");
    expect(getContractSalaryForYear(contract, 2027)).toBeUndefined();
  });

  it("exercise extends endYear and applies option salary", () => {
    const exercised = exerciseTeamOption(pending());
    expect(exercised.endYear).toBe(2027);
    expect(exercised.teamOption?.status).toBe("exercised");
    expect(exercised.teamOption?.year).toBe(2027);
    expect(getContractSalaryForYear(exercised, 2027)).toBe(20_000_000);
    expect(getContractStatus(exercised, 2027)).toBe("active");
  });

  it("decline retains option metadata and expires without salary", () => {
    const declined = declineTeamOption(pending());
    expect(declined.endYear).toBe(2026);
    expect(declined.teamOption?.status).toBe("declined");
    expect(declined.teamOption?.year).toBe(2027);
    expect(declined.teamOption?.salary).toBe(20_000_000);
    expect(getContractSalaryForYear(declined, 2027)).toBeUndefined();
    expect(getContractStatus(declined, 2027)).toBe("expired");
  });
});

describe("player option lifecycle", () => {
  const pending = () =>
    createContract(
      validInput({
        playerOption: {
          year: 2027,
          salary: 15_000_000,
          status: "pending",
        },
      }),
    );

  it("pending at option year reports player_option with no salary", () => {
    const contract = pending();
    expect(getContractStatus(contract, 2027)).toBe("player_option");
    expect(getContractSalaryForYear(contract, 2027)).toBeUndefined();
  });

  it("exercise extends endYear and applies option salary", () => {
    const exercised = exercisePlayerOption(pending());
    expect(exercised.endYear).toBe(2027);
    expect(exercised.playerOption?.status).toBe("exercised");
    expect(getContractSalaryForYear(exercised, 2027)).toBe(15_000_000);
    expect(getContractStatus(exercised, 2027)).toBe("active");
  });

  it("decline retains option metadata and expires without salary", () => {
    const declined = declinePlayerOption(pending());
    expect(declined.endYear).toBe(2026);
    expect(declined.playerOption?.status).toBe("declined");
    expect(declined.playerOption?.year).toBe(2027);
    expect(getContractSalaryForYear(declined, 2027)).toBeUndefined();
    expect(getContractStatus(declined, 2027)).toBe("expired");
  });
});
