import { describe, expect, it } from "vitest";
import {
  createPossession,
  POSSESSION_ACTIONS,
  type PossessionInput,
} from "@/domain/entities/possession";
import { asPlayerId, asPossessionId } from "@/domain/ids";

function validInput(overrides: Partial<PossessionInput> = {}): PossessionInput {
  return {
    id: asPossessionId("possession_1"),
    offensivePlayerId: asPlayerId("player_offense"),
    defensivePlayerId: asPlayerId("player_defense"),
    action: "shot",
    outcome: "shot_made",
    ...overrides,
  };
}

describe("createPossession", () => {
  it("creates a valid possession from PossessionInput", () => {
    const possession = createPossession(validInput());
    expect(possession.id).toBe("possession_1");
    expect(possession.offensivePlayerId).toBe("player_offense");
    expect(possession.defensivePlayerId).toBe("player_defense");
    expect(possession.action).toBe("shot");
    expect(possession.outcome).toBe("shot_made");
  });

  it("preserves the provided possession ID", () => {
    const possession = createPossession(
      validInput({ id: asPossessionId("possession_custom") }),
    );
    expect(possession.id).toBe("possession_custom");
  });

  it("returns a distinct object from input", () => {
    const input = validInput();
    const possession = createPossession(input);
    expect(possession).not.toBe(input);
  });

  it("does not mutate the input object", () => {
    const input = validInput();
    const originalInput = structuredClone(input);
    createPossession(input);
    expect(input).toEqual(originalInput);
  });

  it("accepts every initial action with a compatible outcome", () => {
    const cases: Array<{
      action: PossessionInput["action"];
      outcome: PossessionInput["outcome"];
    }> = [
      { action: "shot", outcome: "shot_made" },
      { action: "shot", outcome: "shot_missed" },
      { action: "pass", outcome: "pass_completed" },
      { action: "turnover", outcome: "turnover" },
      { action: "foul", outcome: "offensive_foul" },
      { action: "foul", outcome: "defensive_foul" },
      { action: "foul", outcome: "shooting_foul" },
      { action: "foul", outcome: "non_shooting_foul" },
      { action: "free_throw", outcome: "free_throw_made" },
      { action: "free_throw", outcome: "free_throw_missed" },
    ];

    expect(POSSESSION_ACTIONS).toEqual([
      "shot",
      "pass",
      "turnover",
      "foul",
      "free_throw",
    ]);

    for (const { action, outcome } of cases) {
      const possession = createPossession(validInput({ action, outcome }));
      expect(possession.action).toBe(action);
      expect(possession.outcome).toBe(outcome);
    }
  });

  it("accepts null defensivePlayerId for any action including foul", () => {
    for (const action of POSSESSION_ACTIONS) {
      const outcome =
        action === "shot"
          ? "shot_made"
          : action === "pass"
            ? "pass_completed"
            : action === "turnover"
              ? "turnover"
              : action === "free_throw"
                ? "free_throw_made"
                : "defensive_foul";
      const possession = createPossession(
        validInput({
          action,
          outcome,
          defensivePlayerId: null,
        }),
      );
      expect(possession.defensivePlayerId).toBeNull();
    }
  });

  it("accepts a real defensive player ID", () => {
    const possession = createPossession(
      validInput({ defensivePlayerId: asPlayerId("player_2") }),
    );
    expect(possession.defensivePlayerId).toBe("player_2");
  });

  it("rejects empty id", () => {
    expect(() =>
      createPossession(validInput({ id: asPossessionId("") })),
    ).toThrow(/id/);
  });

  it("rejects whitespace-only id", () => {
    expect(() =>
      createPossession(validInput({ id: asPossessionId(" ") })),
    ).toThrow(/id.*whitespace-only/);
    expect(() =>
      createPossession(validInput({ id: asPossessionId("\t") })),
    ).toThrow(/id.*whitespace-only/);
  });

  it("rejects empty offensivePlayerId", () => {
    expect(() =>
      createPossession(
        validInput({ offensivePlayerId: asPlayerId("") }),
      ),
    ).toThrow(/offensivePlayerId/);
  });

  it("rejects whitespace-only offensivePlayerId", () => {
    expect(() =>
      createPossession(
        validInput({ offensivePlayerId: asPlayerId(" ") }),
      ),
    ).toThrow(/offensivePlayerId.*whitespace-only/);
  });

  it("rejects empty defensivePlayerId when provided", () => {
    expect(() =>
      createPossession(
        validInput({ defensivePlayerId: asPlayerId("") }),
      ),
    ).toThrow(/defensivePlayerId/);
  });

  it("rejects whitespace-only defensivePlayerId when provided", () => {
    expect(() =>
      createPossession(
        validInput({ defensivePlayerId: asPlayerId(" ") }),
      ),
    ).toThrow(/defensivePlayerId.*whitespace-only/);
  });

  it("rejects identical offensive and defensive players when defender is set", () => {
    expect(() =>
      createPossession(
        validInput({
          offensivePlayerId: asPlayerId("player_same"),
          defensivePlayerId: asPlayerId("player_same"),
        }),
      ),
    ).toThrow(/offensivePlayerId and defensivePlayerId must be different/);
  });

  it("rejects invalid action", () => {
    expect(() =>
      createPossession(
        validInput({ action: "drive" as PossessionInput["action"] }),
      ),
    ).toThrow(/action/);
  });

  it("rejects invalid outcome", () => {
    expect(() =>
      createPossession(
        validInput({
          outcome: "blocked" as PossessionInput["outcome"],
        }),
      ),
    ).toThrow(/outcome/);
  });

  it("rejects incompatible action and outcome pairs", () => {
    expect(() =>
      createPossession(
        validInput({ action: "shot", outcome: "pass_completed" }),
      ),
    ).toThrow(/not compatible/);
    expect(() =>
      createPossession(
        validInput({ action: "pass", outcome: "shot_made" }),
      ),
    ).toThrow(/not compatible/);
    expect(() =>
      createPossession(
        validInput({ action: "turnover", outcome: "offensive_foul" }),
      ),
    ).toThrow(/not compatible/);
    expect(() =>
      createPossession(
        validInput({ action: "foul", outcome: "turnover" }),
      ),
    ).toThrow(/not compatible/);
    expect(() =>
      createPossession(
        validInput({ action: "free_throw", outcome: "shot_made" }),
      ),
    ).toThrow(/not compatible/);
    expect(() =>
      createPossession(
        validInput({ action: "foul", outcome: "free_throw_made" }),
      ),
    ).toThrow(/not compatible/);
  });
});
