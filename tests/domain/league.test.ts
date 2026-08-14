import { describe, expect, it } from "vitest";
import {
  createLeague,
  type LeagueInput,
} from "@/domain/entities/league";
import {
  asConferenceId,
  asLeagueId,
  type ConferenceId,
} from "@/domain/ids";

function validInput(overrides: Partial<LeagueInput> = {}): LeagueInput {
  return {
    id: asLeagueId("league_1"),
    name: "Continental Basketball League",
    abbreviation: "CBL",
    conferenceIds: [],
    ...overrides,
  };
}

describe("createLeague", () => {
  it("creates a valid league from LeagueInput", () => {
    const league = createLeague(validInput());
    expect(league.id).toBe("league_1");
    expect(league.name).toBe("Continental Basketball League");
    expect(league.abbreviation).toBe("CBL");
    expect(league.conferenceIds).toEqual([]);
  });

  it("preserves supplied values", () => {
    const league = createLeague(
      validInput({
        name: "Pacific League",
        abbreviation: "PAC",
        conferenceIds: [asConferenceId("conf_a"), asConferenceId("conf_b")],
      }),
    );
    expect(league.id).toBe("league_1");
    expect(league.name).toBe("Pacific League");
    expect(league.abbreviation).toBe("PAC");
    expect(league.conferenceIds).toEqual(["conf_a", "conf_b"]);
  });

  it("returns a distinct object from input", () => {
    const input = validInput({
      conferenceIds: [asConferenceId("conf_a")],
    });
    const league = createLeague(input);
    expect(league).not.toBe(input);
    expect(league.conferenceIds).not.toBe(input.conferenceIds);
  });

  it("accepts an empty conference collection", () => {
    expect(createLeague(validInput({ conferenceIds: [] })).conferenceIds).toEqual(
      [],
    );
  });

  it("accepts different numbers of conferences", () => {
    expect(
      createLeague(
        validInput({ conferenceIds: [asConferenceId("conf_a")] }),
      ).conferenceIds,
    ).toHaveLength(1);
    expect(
      createLeague(
        validInput({
          conferenceIds: [
            asConferenceId("conf_a"),
            asConferenceId("conf_b"),
            asConferenceId("conf_c"),
          ],
        }),
      ).conferenceIds,
    ).toHaveLength(3);
  });

  it("copies conferenceIds array", () => {
    const conferenceIds = [asConferenceId("conf_a")];
    const input = validInput({ conferenceIds });
    const league = createLeague(input);
    conferenceIds.push(asConferenceId("conf_b"));
    expect(league.conferenceIds).toEqual(["conf_a"]);
  });

  it("does not mutate the input object", () => {
    const input = validInput({
      conferenceIds: [asConferenceId("conf_a")],
    });
    const snapshot = structuredClone(input);
    createLeague(input);
    expect(input).toEqual(snapshot);
  });

  it("does not mutate league when original conferenceIds change after creation", () => {
    const input = validInput({
      conferenceIds: [asConferenceId("conf_a")],
    });
    const league = createLeague(input);
    input.conferenceIds.push(asConferenceId("conf_b"));
    expect(league.conferenceIds).toEqual(["conf_a"]);
  });

  it("rejects empty id", () => {
    expect(() => createLeague(validInput({ id: asLeagueId("") }))).toThrow(
      /id/,
    );
  });

  it("rejects empty name", () => {
    expect(() => createLeague(validInput({ name: "" }))).toThrow(/name/);
  });

  it("rejects whitespace-only name", () => {
    expect(() => createLeague(validInput({ name: "   " }))).toThrow(/name/);
  });

  it("rejects empty abbreviation", () => {
    expect(() => createLeague(validInput({ abbreviation: "" }))).toThrow(
      /abbreviation/,
    );
  });

  it("rejects whitespace-only abbreviation", () => {
    expect(() => createLeague(validInput({ abbreviation: "   " }))).toThrow(
      /abbreviation/,
    );
  });

  it("rejects empty conference id in conferenceIds", () => {
    expect(() =>
      createLeague(validInput({ conferenceIds: [asConferenceId("")] })),
    ).toThrow(/conferenceIds/);
  });

  it("rejects duplicate conference ids", () => {
    expect(() =>
      createLeague(
        validInput({
          conferenceIds: [
            asConferenceId("conf_a"),
            asConferenceId("conf_a"),
          ],
        }),
      ),
    ).toThrow(/duplicate/);
  });

  it("rejects non-array conferenceIds", () => {
    expect(() =>
      createLeague({
        ...validInput(),
        conferenceIds: "not-an-array" as unknown as ConferenceId[],
      }),
    ).toThrow(/conferenceIds must be an array/);
  });
});
