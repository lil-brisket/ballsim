import { describe, expect, it } from "vitest";
import {
  createTeam,
  NEUTRAL_TEAM_PLAY_STYLE,
  TEAM_PLAY_STYLE_KEYS,
  type TeamInput,
  type TeamPlayStyle,
} from "@/domain/entities/team";
import {
  asArenaId,
  asConferenceId,
  asDivisionId,
  asPlayerId,
  asStaffId,
  asTeamId,
} from "@/domain/ids";

function validInput(overrides: Partial<TeamInput> = {}): TeamInput {
  return {
    id: asTeamId("team_1"),
    name: "Titans",
    city: "Harbor",
    abbreviation: "HAR",
    conferenceId: asConferenceId("conf_1"),
    divisionId: asDivisionId("div_1"),
    roster: [],
    staff: [],
    finances: {},
    arenaId: asArenaId("arena_1"),
    reputation: 50,
    playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE },
    ...overrides,
  };
}

describe("createTeam", () => {
  it("creates a valid team from TeamInput", () => {
    const team = createTeam(validInput());
    expect(team.id).toBe("team_1");
    expect(team.name).toBe("Titans");
    expect(team.city).toBe("Harbor");
    expect(team.abbreviation).toBe("HAR");
    expect(team.conferenceId).toBe("conf_1");
    expect(team.divisionId).toBe("div_1");
    expect(team.roster).toEqual([]);
    expect(team.staff).toEqual([]);
    expect(team.finances).toEqual({});
    expect(team.arenaId).toBe("arena_1");
    expect(team.reputation).toBe(50);
    expect(team.playStyle).toEqual(NEUTRAL_TEAM_PLAY_STYLE);
  });

  it("preserves supplied values", () => {
    const playStyle: TeamPlayStyle = {
      pace: 70,
      threePointFrequency: 80,
      insideFrequency: 40,
      passing: 65,
      defensiveAggression: 55,
      offensiveFocus: 60,
    };
    const team = createTeam(
      validInput({
        roster: [asPlayerId("player_a"), asPlayerId("player_b")],
        staff: [asStaffId("staff_a")],
        reputation: 75,
        playStyle,
      }),
    );
    expect(team.roster).toEqual(["player_a", "player_b"]);
    expect(team.staff).toEqual(["staff_a"]);
    expect(team.reputation).toBe(75);
    expect(team.playStyle).toEqual(playStyle);
  });

  it("stores all six play-style tendencies", () => {
    const playStyle: TeamPlayStyle = {
      pace: 10,
      threePointFrequency: 20,
      insideFrequency: 30,
      passing: 40,
      defensiveAggression: 60,
      offensiveFocus: 70,
    };
    const team = createTeam(validInput({ playStyle }));
    for (const key of TEAM_PLAY_STYLE_KEYS) {
      expect(team.playStyle[key]).toBe(playStyle[key]);
    }
  });

  it("defaults to neutral play-style tendencies", () => {
    const team = createTeam(validInput());
    for (const key of TEAM_PLAY_STYLE_KEYS) {
      expect(team.playStyle[key]).toBe(50);
    }
  });

  it("returns a distinct object from input", () => {
    const input = validInput({
      roster: [asPlayerId("player_a")],
      staff: [asStaffId("staff_a")],
    });
    const team = createTeam(input);
    expect(team).not.toBe(input);
    expect(team.roster).not.toBe(input.roster);
    expect(team.staff).not.toBe(input.staff);
    expect(team.finances).not.toBe(input.finances);
    expect(team.playStyle).not.toBe(input.playStyle);
  });

  it("rejects empty id", () => {
    expect(() => createTeam(validInput({ id: asTeamId("") }))).toThrow(/id/);
  });

  it("rejects empty name", () => {
    expect(() => createTeam(validInput({ name: "" }))).toThrow(/name/);
  });

  it("rejects whitespace-only name", () => {
    expect(() => createTeam(validInput({ name: "   " }))).toThrow(/name/);
  });

  it("rejects empty city", () => {
    expect(() => createTeam(validInput({ city: "" }))).toThrow(/city/);
  });

  it("rejects whitespace-only city", () => {
    expect(() => createTeam(validInput({ city: "   " }))).toThrow(/city/);
  });

  it("preserves valid abbreviation", () => {
    expect(createTeam(validInput({ abbreviation: "SUM" })).abbreviation).toBe(
      "SUM",
    );
  });

  it("rejects empty abbreviation", () => {
    expect(() => createTeam(validInput({ abbreviation: "" }))).toThrow(
      /abbreviation/,
    );
  });

  it("rejects whitespace-only abbreviation", () => {
    expect(() => createTeam(validInput({ abbreviation: "   " }))).toThrow(
      /abbreviation/,
    );
  });

  it("preserves valid conference and division ids", () => {
    const team = createTeam(
      validInput({
        conferenceId: asConferenceId("conf_east"),
        divisionId: asDivisionId("div_north"),
      }),
    );
    expect(team.conferenceId).toBe("conf_east");
    expect(team.divisionId).toBe("div_north");
  });

  it("rejects empty conference id", () => {
    expect(() =>
      createTeam(validInput({ conferenceId: asConferenceId("") })),
    ).toThrow(/conferenceId/);
  });

  it("rejects empty division id", () => {
    expect(() =>
      createTeam(validInput({ divisionId: asDivisionId("") })),
    ).toThrow(/divisionId/);
  });

  it("accepts empty roster", () => {
    expect(createTeam(validInput({ roster: [] })).roster).toEqual([]);
  });

  it("preserves valid roster ids", () => {
    const roster = [asPlayerId("player_a"), asPlayerId("player_b")];
    expect(createTeam(validInput({ roster })).roster).toEqual(roster);
  });

  it("copies roster array", () => {
    const roster = [asPlayerId("player_a")];
    const input = validInput({ roster });
    const team = createTeam(input);
    roster.push(asPlayerId("player_b"));
    expect(team.roster).toEqual(["player_a"]);
  });

  it("rejects empty player id in roster", () => {
    expect(() =>
      createTeam(validInput({ roster: [asPlayerId("")] })),
    ).toThrow(/roster/);
  });

  it("rejects duplicate player ids in roster", () => {
    expect(() =>
      createTeam(
        validInput({
          roster: [asPlayerId("player_a"), asPlayerId("player_a")],
        }),
      ),
    ).toThrow(/duplicate/);
  });

  it("rejects non-array roster", () => {
    expect(() =>
      createTeam(validInput({ roster: "invalid" as unknown as TeamInput["roster"] })),
    ).toThrow(/roster must be an array/);
  });

  it("accepts empty staff array", () => {
    expect(createTeam(validInput({ staff: [] })).staff).toEqual([]);
  });

  it("preserves valid staff ids", () => {
    const staff = [asStaffId("staff_a"), asStaffId("staff_b")];
    expect(createTeam(validInput({ staff })).staff).toEqual(staff);
  });

  it("copies staff array", () => {
    const staff = [asStaffId("staff_a")];
    const input = validInput({ staff });
    const team = createTeam(input);
    staff.push(asStaffId("staff_b"));
    expect(team.staff).toEqual(["staff_a"]);
  });

  it("rejects empty staff id", () => {
    expect(() =>
      createTeam(validInput({ staff: [asStaffId("")] })),
    ).toThrow(/staff/);
  });

  it("rejects duplicate staff ids", () => {
    expect(() =>
      createTeam(
        validInput({
          staff: [asStaffId("staff_a"), asStaffId("staff_a")],
        }),
      ),
    ).toThrow(/duplicate/);
  });

  it("rejects non-array staff", () => {
    expect(() =>
      createTeam(validInput({ staff: "invalid" as unknown as TeamInput["staff"] })),
    ).toThrow(/staff must be an array/);
  });

  it("accepts empty finances object", () => {
    expect(createTeam(validInput({ finances: {} })).finances).toEqual({});
  });

  it("copies finances object", () => {
    const finances = {};
    const input = validInput({ finances });
    const team = createTeam(input);
    expect(team.finances).toEqual({});
    expect(team.finances).not.toBe(finances);
  });

  it("rejects null finances", () => {
    expect(() =>
      createTeam(
        validInput({ finances: null as unknown as TeamInput["finances"] }),
      ),
    ).toThrow(/finances must be an object/);
  });

  it("rejects array finances", () => {
    expect(() =>
      createTeam(
        validInput({ finances: [] as unknown as TeamInput["finances"] }),
      ),
    ).toThrow(/finances must be an object/);
  });

  it("preserves valid arena id", () => {
    expect(createTeam(validInput({ arenaId: asArenaId("arena_home") })).arenaId).toBe(
      "arena_home",
    );
  });

  it("rejects empty arena id", () => {
    expect(() => createTeam(validInput({ arenaId: asArenaId("") }))).toThrow(
      /arenaId/,
    );
  });

  it("accepts boundary reputation 1 and 99", () => {
    expect(createTeam(validInput({ reputation: 1 })).reputation).toBe(1);
    expect(createTeam(validInput({ reputation: 99 })).reputation).toBe(99);
  });

  it("rejects reputation 0", () => {
    expect(() => createTeam(validInput({ reputation: 0 }))).toThrow(/reputation/);
  });

  it("rejects reputation 100", () => {
    expect(() => createTeam(validInput({ reputation: 100 }))).toThrow(
      /reputation/,
    );
  });

  it("rejects non-integer reputation", () => {
    expect(() => createTeam(validInput({ reputation: 50.5 }))).toThrow(
      /reputation/,
    );
  });

  it("does not clamp invalid reputation", () => {
    expect(() => createTeam(validInput({ reputation: 0 }))).toThrow();
    expect(() => createTeam(validInput({ reputation: 100 }))).toThrow();
  });

  it("accepts boundary play-style tendencies 1 and 99", () => {
    for (const key of TEAM_PLAY_STYLE_KEYS) {
      const atMin = createTeam(
        validInput({
          playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE, [key]: 1 },
        }),
      );
      expect(atMin.playStyle[key]).toBe(1);

      const atMax = createTeam(
        validInput({
          playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE, [key]: 99 },
        }),
      );
      expect(atMax.playStyle[key]).toBe(99);
    }
  });

  it("rejects play-style tendency below minimum", () => {
    expect(() =>
      createTeam(
        validInput({
          playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE, pace: 0 },
        }),
      ),
    ).toThrow(/playStyle\.pace/);
  });

  it("rejects play-style tendency above maximum", () => {
    expect(() =>
      createTeam(
        validInput({
          playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE, pace: 100 },
        }),
      ),
    ).toThrow(/playStyle\.pace/);
  });

  it("rejects non-integer play-style tendency", () => {
    expect(() =>
      createTeam(
        validInput({
          playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE, pace: 50.5 },
        }),
      ),
    ).toThrow(/playStyle\.pace/);
  });

  it("rejects null playStyle", () => {
    expect(() =>
      createTeam(
        validInput({
          playStyle: null as unknown as TeamInput["playStyle"],
        }),
      ),
    ).toThrow(/playStyle must be a non-null, non-array object/);
  });

  it("rejects array playStyle", () => {
    expect(() =>
      createTeam(
        validInput({
          playStyle: [] as unknown as TeamInput["playStyle"],
        }),
      ),
    ).toThrow(/playStyle must be a non-null, non-array object/);
  });

  it("rejects non-object playStyle", () => {
    expect(() =>
      createTeam(
        validInput({
          playStyle: "invalid" as unknown as TeamInput["playStyle"],
        }),
      ),
    ).toThrow(/playStyle must be a non-null, non-array object/);
  });

  it("rejects playStyle with missing keys", () => {
    const { pace: _pace, ...incomplete } = NEUTRAL_TEAM_PLAY_STYLE;
    expect(() =>
      createTeam(
        validInput({
          playStyle: incomplete as unknown as TeamInput["playStyle"],
        }),
      ),
    ).toThrow(/playStyle\.pace/);
  });

  it("rejects playStyle with unknown keys", () => {
    expect(() =>
      createTeam(
        validInput({
          playStyle: {
            ...NEUTRAL_TEAM_PLAY_STYLE,
            extra: 50,
          } as unknown as TeamInput["playStyle"],
        }),
      ),
    ).toThrow(/unknown key/);
  });

  it("does not mutate the input object", () => {
    const input = validInput({
      roster: [asPlayerId("player_a")],
      staff: [asStaffId("staff_a")],
      finances: {},
    });
    const snapshot = structuredClone(input);
    createTeam(input);
    expect(input).toEqual(snapshot);
  });

  it("does not mutate team when original arrays, finances, or playStyle change after creation", () => {
    const input = validInput({
      roster: [asPlayerId("player_a")],
      staff: [asStaffId("staff_a")],
      finances: {},
      playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE, pace: 70 },
    });
    const team = createTeam(input);
    input.roster.push(asPlayerId("player_b"));
    input.staff.push(asStaffId("staff_b"));
    input.playStyle.pace = 10;
    expect(team.roster).toEqual(["player_a"]);
    expect(team.staff).toEqual(["staff_a"]);
    expect(team.playStyle.pace).toBe(70);
  });
});
