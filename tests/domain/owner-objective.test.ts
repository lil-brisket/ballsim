import { describe, expect, it } from "vitest";
import {
  createOwnerObjective,
  isOwnerObjectiveStatus,
  isOwnerObjectiveType,
  OWNER_OBJECTIVE_STATUSES,
  OWNER_OBJECTIVE_TYPES,
  type OwnerObjectiveInput,
} from "@/domain/entities/owner-objective";
import { asOwnerObjectiveId } from "@/domain/ids";

function validInput(
  overrides: Partial<OwnerObjectiveInput> = {},
): OwnerObjectiveInput {
  return {
    id: asOwnerObjectiveId("obj_1"),
    type: "make_playoffs",
    description: "Make the playoffs",
    status: "active",
    seasonYear: 2026,
    category: "competitive",
    lifecycle: "seasonal",
    role: "primary",
    consequenceApplied: false,
    ...overrides,
  };
}

describe("createOwnerObjective", () => {
  it("creates a valid objective from OwnerObjectiveInput", () => {
    const objective = createOwnerObjective(validInput());
    expect(objective.id).toBe("obj_1");
    expect(objective.type).toBe("make_playoffs");
    expect(objective.description).toBe("Make the playoffs");
    expect(objective.status).toBe("active");
    expect(objective.seasonYear).toBe(2026);
    expect(objective.category).toBe("competitive");
    expect(objective.lifecycle).toBe("seasonal");
    expect(objective.role).toBe("primary");
    expect(objective.consequenceApplied).toBe(false);
    expect(objective.target).toBeUndefined();
    expect(objective.progress).toBeUndefined();
  });

  it("preserves supplied target and progress without inferring values", () => {
    const objective = createOwnerObjective(
      validInput({
        type: "minimum_win_total",
        description: "Win at least 45 games",
        target: 45,
        progress: 12,
        status: "active",
      }),
    );
    expect(objective.target).toBe(45);
    expect(objective.progress).toBe(12);
    expect(objective.status).toBe("active");
  });

  it("does not require target for minimum_win_total", () => {
    const objective = createOwnerObjective(
      validInput({
        type: "minimum_win_total",
        description: "Win enough games",
      }),
    );
    expect(objective.target).toBeUndefined();
  });

  it("rejects invalid type", () => {
    expect(() =>
      createOwnerObjective(
        validInput({ type: "win_lottery" as OwnerObjectiveInput["type"] }),
      ),
    ).toThrow(/type must be one of/);
  });

  it("rejects empty description", () => {
    expect(() => createOwnerObjective(validInput({ description: "" }))).toThrow(
      /description/,
    );
  });

  it("rejects whitespace-only description", () => {
    expect(() =>
      createOwnerObjective(validInput({ description: "   " })),
    ).toThrow(/description/);
  });

  it("rejects empty id", () => {
    expect(() =>
      createOwnerObjective(validInput({ id: asOwnerObjectiveId("") })),
    ).toThrow(/id/);
  });

  it("rejects non-finite target", () => {
    expect(() =>
      createOwnerObjective(validInput({ target: Number.NaN })),
    ).toThrow(/target/);
  });

  it("rejects negative progress", () => {
    expect(() => createOwnerObjective(validInput({ progress: -1 }))).toThrow(
      /progress must be >= 0/,
    );
  });

  it("rejects invalid status", () => {
    expect(() =>
      createOwnerObjective(
        validInput({ status: "done" as OwnerObjectiveInput["status"] }),
      ),
    ).toThrow(/status must be one of/);
  });

  it("rejects non-boolean consequenceApplied", () => {
    expect(() =>
      createOwnerObjective(
        validInput({
          consequenceApplied: "yes" as unknown as boolean,
        }),
      ),
    ).toThrow(/consequenceApplied must be a boolean/);
  });
});

describe("isOwnerObjectiveType", () => {
  it("accepts all catalog types", () => {
    for (const type of OWNER_OBJECTIVE_TYPES) {
      expect(isOwnerObjectiveType(type)).toBe(true);
    }
  });

  it("rejects unknown types", () => {
    expect(isOwnerObjectiveType("win_lottery")).toBe(false);
  });
});

describe("isOwnerObjectiveStatus", () => {
  it("accepts all catalog statuses", () => {
    for (const status of OWNER_OBJECTIVE_STATUSES) {
      expect(isOwnerObjectiveStatus(status)).toBe(true);
    }
  });
});
