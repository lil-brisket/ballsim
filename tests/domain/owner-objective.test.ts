import { describe, expect, it } from "vitest";
import {
  createOwnerObjective,
  isOwnerObjectiveType,
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
    completed: false,
    ...overrides,
  };
}

describe("createOwnerObjective", () => {
  it("creates a valid objective from OwnerObjectiveInput", () => {
    const objective = createOwnerObjective(validInput());
    expect(objective.id).toBe("obj_1");
    expect(objective.type).toBe("make_playoffs");
    expect(objective.description).toBe("Make the playoffs");
    expect(objective.completed).toBe(false);
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
        completed: false,
      }),
    );
    expect(objective.target).toBe(45);
    expect(objective.progress).toBe(12);
    expect(objective.completed).toBe(false);
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

  it("rejects non-boolean completed", () => {
    expect(() =>
      createOwnerObjective(
        validInput({ completed: "yes" as unknown as boolean }),
      ),
    ).toThrow(/completed must be a boolean/);
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
