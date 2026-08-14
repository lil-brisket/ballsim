import { describe, expect, it } from "vitest";
import {
  createFoul,
  FOUL_TYPES,
  type FoulInput,
} from "@/domain/entities/foul";
import { asPlayerId } from "@/domain/ids";

function validInput(overrides: Partial<FoulInput> = {}): FoulInput {
  return {
    foulingPlayerId: asPlayerId("player_fouler"),
    fouledPlayerId: asPlayerId("player_fouled"),
    foulType: "shooting",
    ...overrides,
  };
}

describe("createFoul", () => {
  it("creates a valid foul from FoulInput", () => {
    const foul = createFoul(validInput());
    expect(foul.foulingPlayerId).toBe("player_fouler");
    expect(foul.fouledPlayerId).toBe("player_fouled");
    expect(foul.foulType).toBe("shooting");
  });

  it("returns a distinct object from input", () => {
    const input = validInput();
    const foul = createFoul(input);
    expect(foul).not.toBe(input);
  });

  it("does not mutate the input object", () => {
    const input = validInput();
    const originalInput = structuredClone(input);
    createFoul(input);
    expect(input).toEqual(originalInput);
  });

  it("accepts every foul type", () => {
    expect(FOUL_TYPES).toEqual(["shooting", "non-shooting"]);
    for (const foulType of FOUL_TYPES) {
      const foul = createFoul(validInput({ foulType }));
      expect(foul.foulType).toBe(foulType);
    }
  });

  it("rejects empty foulingPlayerId", () => {
    expect(() =>
      createFoul(validInput({ foulingPlayerId: asPlayerId("") })),
    ).toThrow(/foulingPlayerId/);
  });

  it("rejects whitespace-only foulingPlayerId", () => {
    expect(() =>
      createFoul(validInput({ foulingPlayerId: asPlayerId(" ") })),
    ).toThrow(/foulingPlayerId.*whitespace-only/);
  });

  it("rejects empty fouledPlayerId", () => {
    expect(() =>
      createFoul(validInput({ fouledPlayerId: asPlayerId("") })),
    ).toThrow(/fouledPlayerId/);
  });

  it("rejects whitespace-only fouledPlayerId", () => {
    expect(() =>
      createFoul(validInput({ fouledPlayerId: asPlayerId(" ") })),
    ).toThrow(/fouledPlayerId.*whitespace-only/);
  });

  it("rejects identical fouling and fouled players", () => {
    expect(() =>
      createFoul(
        validInput({
          foulingPlayerId: asPlayerId("player_same"),
          fouledPlayerId: asPlayerId("player_same"),
        }),
      ),
    ).toThrow(/foulingPlayerId and fouledPlayerId must be different/);
  });

  it("rejects an invalid foul type", () => {
    expect(() =>
      createFoul(
        validInput({ foulType: "technical" as FoulInput["foulType"] }),
      ),
    ).toThrow(/foulType/);
  });
});
