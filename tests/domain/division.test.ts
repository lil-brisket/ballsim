import { describe, expect, it } from "vitest";
import {
  createDivision,
  type DivisionInput,
} from "@/domain/entities/division";
import {
  asConferenceId,
  asDivisionId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";

function validInput(overrides: Partial<DivisionInput> = {}): DivisionInput {
  return {
    id: asDivisionId("div_1"),
    conferenceId: asConferenceId("conf_1"),
    name: "North",
    teamIds: [],
    ...overrides,
  };
}

describe("createDivision", () => {
  it("creates a valid division from DivisionInput", () => {
    const division = createDivision(validInput());
    expect(division.id).toBe("div_1");
    expect(division.conferenceId).toBe("conf_1");
    expect(division.name).toBe("North");
    expect(division.teamIds).toEqual([]);
  });

  it("preserves supplied values", () => {
    const division = createDivision(
      validInput({
        conferenceId: asConferenceId("conf_west"),
        name: "South",
        teamIds: [asTeamId("team_a"), asTeamId("team_b")],
      }),
    );
    expect(division.conferenceId).toBe("conf_west");
    expect(division.name).toBe("South");
    expect(division.teamIds).toEqual(["team_a", "team_b"]);
  });

  it("returns a distinct object from input", () => {
    const input = validInput({
      teamIds: [asTeamId("team_a")],
    });
    const division = createDivision(input);
    expect(division).not.toBe(input);
    expect(division.teamIds).not.toBe(input.teamIds);
  });

  it("accepts an empty team collection", () => {
    expect(createDivision(validInput({ teamIds: [] })).teamIds).toEqual([]);
  });

  it("accepts different numbers of teams", () => {
    expect(
      createDivision(validInput({ teamIds: [asTeamId("team_a")] })).teamIds,
    ).toHaveLength(1);
    expect(
      createDivision(
        validInput({
          teamIds: [
            asTeamId("team_a"),
            asTeamId("team_b"),
            asTeamId("team_c"),
          ],
        }),
      ).teamIds,
    ).toHaveLength(3);
  });

  it("copies teamIds array", () => {
    const teamIds = [asTeamId("team_a")];
    const input = validInput({ teamIds });
    const division = createDivision(input);
    teamIds.push(asTeamId("team_b"));
    expect(division.teamIds).toEqual(["team_a"]);
  });

  it("does not mutate the input object", () => {
    const input = validInput({
      teamIds: [asTeamId("team_a")],
    });
    const snapshot = structuredClone(input);
    createDivision(input);
    expect(input).toEqual(snapshot);
  });

  it("does not mutate division when original teamIds change after creation", () => {
    const input = validInput({
      teamIds: [asTeamId("team_a")],
    });
    const division = createDivision(input);
    input.teamIds.push(asTeamId("team_b"));
    expect(division.teamIds).toEqual(["team_a"]);
  });

  it("rejects empty id", () => {
    expect(() => createDivision(validInput({ id: asDivisionId("") }))).toThrow(
      /id/,
    );
  });

  it("rejects empty conferenceId", () => {
    expect(() =>
      createDivision(validInput({ conferenceId: asConferenceId("") })),
    ).toThrow(/conferenceId/);
  });

  it("rejects empty name", () => {
    expect(() => createDivision(validInput({ name: "" }))).toThrow(/name/);
  });

  it("rejects whitespace-only name", () => {
    expect(() => createDivision(validInput({ name: "   " }))).toThrow(/name/);
  });

  it("rejects empty team id in teamIds", () => {
    expect(() =>
      createDivision(validInput({ teamIds: [asTeamId("")] })),
    ).toThrow(/teamIds/);
  });

  it("rejects duplicate team ids", () => {
    expect(() =>
      createDivision(
        validInput({
          teamIds: [asTeamId("team_a"), asTeamId("team_a")],
        }),
      ),
    ).toThrow(/duplicate/);
  });

  it("rejects non-array teamIds", () => {
    expect(() =>
      createDivision({
        ...validInput(),
        teamIds: "not-an-array" as unknown as TeamId[],
      }),
    ).toThrow(/teamIds must be an array/);
  });
});
