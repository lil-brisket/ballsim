import { describe, expect, it } from "vitest";
import {
  createConference,
  type ConferenceInput,
} from "@/domain/entities/conference";
import {
  asConferenceId,
  asDivisionId,
  asLeagueId,
  type DivisionId,
} from "@/domain/ids";

function validInput(overrides: Partial<ConferenceInput> = {}): ConferenceInput {
  return {
    id: asConferenceId("conf_1"),
    leagueId: asLeagueId("league_1"),
    name: "Eastern Conference",
    divisionIds: [],
    ...overrides,
  };
}

describe("createConference", () => {
  it("creates a valid conference from ConferenceInput", () => {
    const conference = createConference(validInput());
    expect(conference.id).toBe("conf_1");
    expect(conference.leagueId).toBe("league_1");
    expect(conference.name).toBe("Eastern Conference");
    expect(conference.divisionIds).toEqual([]);
  });

  it("preserves supplied values", () => {
    const conference = createConference(
      validInput({
        leagueId: asLeagueId("league_west"),
        name: "Western Conference",
        divisionIds: [asDivisionId("div_a"), asDivisionId("div_b")],
      }),
    );
    expect(conference.leagueId).toBe("league_west");
    expect(conference.name).toBe("Western Conference");
    expect(conference.divisionIds).toEqual(["div_a", "div_b"]);
  });

  it("returns a distinct object from input", () => {
    const input = validInput({
      divisionIds: [asDivisionId("div_a")],
    });
    const conference = createConference(input);
    expect(conference).not.toBe(input);
    expect(conference.divisionIds).not.toBe(input.divisionIds);
  });

  it("accepts an empty division collection", () => {
    expect(
      createConference(validInput({ divisionIds: [] })).divisionIds,
    ).toEqual([]);
  });

  it("accepts different numbers of divisions", () => {
    expect(
      createConference(
        validInput({ divisionIds: [asDivisionId("div_a")] }),
      ).divisionIds,
    ).toHaveLength(1);
    expect(
      createConference(
        validInput({
          divisionIds: [
            asDivisionId("div_a"),
            asDivisionId("div_b"),
            asDivisionId("div_c"),
          ],
        }),
      ).divisionIds,
    ).toHaveLength(3);
  });

  it("copies divisionIds array", () => {
    const divisionIds = [asDivisionId("div_a")];
    const input = validInput({ divisionIds });
    const conference = createConference(input);
    divisionIds.push(asDivisionId("div_b"));
    expect(conference.divisionIds).toEqual(["div_a"]);
  });

  it("does not mutate the input object", () => {
    const input = validInput({
      divisionIds: [asDivisionId("div_a")],
    });
    const snapshot = structuredClone(input);
    createConference(input);
    expect(input).toEqual(snapshot);
  });

  it("does not mutate conference when original divisionIds change after creation", () => {
    const input = validInput({
      divisionIds: [asDivisionId("div_a")],
    });
    const conference = createConference(input);
    input.divisionIds.push(asDivisionId("div_b"));
    expect(conference.divisionIds).toEqual(["div_a"]);
  });

  it("rejects empty id", () => {
    expect(() =>
      createConference(validInput({ id: asConferenceId("") })),
    ).toThrow(/id/);
  });

  it("rejects empty leagueId", () => {
    expect(() =>
      createConference(validInput({ leagueId: asLeagueId("") })),
    ).toThrow(/leagueId/);
  });

  it("rejects empty name", () => {
    expect(() => createConference(validInput({ name: "" }))).toThrow(/name/);
  });

  it("rejects whitespace-only name", () => {
    expect(() => createConference(validInput({ name: "   " }))).toThrow(/name/);
  });

  it("rejects empty division id in divisionIds", () => {
    expect(() =>
      createConference(validInput({ divisionIds: [asDivisionId("")] })),
    ).toThrow(/divisionIds/);
  });

  it("rejects duplicate division ids", () => {
    expect(() =>
      createConference(
        validInput({
          divisionIds: [asDivisionId("div_a"), asDivisionId("div_a")],
        }),
      ),
    ).toThrow(/duplicate/);
  });

  it("rejects non-array divisionIds", () => {
    expect(() =>
      createConference({
        ...validInput(),
        divisionIds: "not-an-array" as unknown as DivisionId[],
      }),
    ).toThrow(/divisionIds must be an array/);
  });
});
