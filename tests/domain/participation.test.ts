import { describe, expect, it } from "vitest";
import {
  controlledTeamCountForSetup,
  MAX_LOCAL_PARTICIPANTS,
  PARTICIPANT_NAME_MAX_LENGTH,
  parseParticipationSetup,
  participationStateErrors,
  type LocalParticipant,
  type LocalSharedParticipation,
  type ParticipationState,
} from "@/domain/participation";

describe("parseParticipationSetup", () => {
  it("defaults to single player when no input is provided", () => {
    expect(parseParticipationSetup(undefined, 5)).toEqual({
      ok: true,
      value: { mode: "single" },
    });
  });

  it("accepts a valid local shared setup and trims names", () => {
    const result = parseParticipationSetup(
      {
        mode: "local_shared",
        participants: [
          { displayName: "  Alex ", teamCount: 1 },
          { displayName: "Sam", teamCount: 2 },
        ],
      },
      5,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        mode: "local_shared",
        participants: [
          { displayName: "Alex", teamCount: 1 },
          { displayName: "Sam", teamCount: 2 },
        ],
      },
    });
    if (result.ok) {
      expect(controlledTeamCountForSetup(result.value)).toBe(3);
    }
  });

  it("rejects unknown modes", () => {
    expect(parseParticipationSetup({ mode: "lan_party" }, 5).ok).toBe(false);
  });

  it("rejects too few or too many participants", () => {
    const one = parseParticipationSetup(
      {
        mode: "local_shared",
        participants: [{ displayName: "A", teamCount: 1 }],
      },
      5,
    );
    expect(one.ok).toBe(false);
    const many = parseParticipationSetup(
      {
        mode: "local_shared",
        participants: Array.from(
          { length: MAX_LOCAL_PARTICIPANTS + 1 },
          (_, i) => ({
            displayName: `P${i}`,
            teamCount: 1,
          }),
        ),
      },
      10,
    );
    expect(many.ok).toBe(false);
  });

  it("rejects blank, overlong and duplicate names (case-insensitive)", () => {
    const cases = [
      [" ", "B"],
      ["x".repeat(PARTICIPANT_NAME_MAX_LENGTH + 1), "B"],
      ["Alex", "alex"],
    ];
    for (const [a, b] of cases) {
      const result = parseParticipationSetup(
        {
          mode: "local_shared",
          participants: [
            { displayName: a, teamCount: 1 },
            { displayName: b, teamCount: 1 },
          ],
        },
        5,
      );
      expect(result.ok).toBe(false);
    }
  });

  it("rejects zero, fractional and over-cap team counts", () => {
    for (const counts of [
      [0, 1],
      [1.5, 1],
      [3, 3],
    ]) {
      const result = parseParticipationSetup(
        {
          mode: "local_shared",
          participants: counts.map((teamCount, i) => ({
            displayName: `P${i}`,
            teamCount,
          })),
        },
        5,
      );
      expect(result.ok).toBe(false);
    }
  });
});

describe("participationStateErrors", () => {
  const owned = ["t1", "t2", "t3"];
  function participant(
    id: string,
    displayName: string,
    teamIds: string[],
    isHost: boolean,
    plannedTeamCount = teamIds.length,
  ): LocalParticipant {
    return { id, displayName, teamIds, isHost, plannedTeamCount };
  }
  function local(
    overrides: Partial<LocalSharedParticipation> = {},
  ): ParticipationState {
    return {
      mode: "local_shared",
      participants: [
        participant("p1", "Alex", ["t1"], true),
        participant("p2", "Sam", ["t2", "t3"], false),
      ],
      activeParticipantId: "p1",
      readyParticipantIds: [],
      assignmentsConfirmed: true,
      ...overrides,
    };
  }

  it("accepts single mode and a consistent local shared state", () => {
    expect(participationStateErrors({ mode: "single" }, owned, "t1")).toEqual(
      [],
    );
    expect(participationStateErrors(local(), owned, "t1")).toEqual([]);
  });

  it("accepts onboarding state where only the host holds the anchor", () => {
    const onboarding = local({
      assignmentsConfirmed: false,
      participants: [
        participant("p1", "Alex", ["t1"], true, 1),
        participant("p2", "Sam", [], false, 2),
      ],
    });
    expect(participationStateErrors(onboarding, ["t1"], "t1")).toEqual([]);
  });

  it("requires confirmed participants to hold their planned team count", () => {
    const short = local({
      participants: [
        participant("p1", "Alex", ["t1"], true),
        participant("p2", "Sam", ["t2", "t3"], false, 3),
      ],
    });
    expect(participationStateErrors(short, owned, "t1").join(" ")).toMatch(
      /controls 2 teams but planned 3/,
    );
  });

  it("requires every owned team to be assigned exactly once", () => {
    const unassigned = local({
      assignmentsConfirmed: false,
      participants: [
        participant("p1", "Alex", ["t1"], true),
        participant("p2", "Sam", ["t2"], false, 2),
      ],
    });
    expect(participationStateErrors(unassigned, owned, "t1").join(" ")).toMatch(
      /"t3" is not assigned/,
    );
    const doubled = local({
      participants: [
        participant("p1", "Alex", ["t1", "t2"], true),
        participant("p2", "Sam", ["t2", "t3"], false),
      ],
    });
    expect(participationStateErrors(doubled, owned, "t1").join(" ")).toMatch(
      /more than one participant/,
    );
  });

  it("rejects AI teams in an assignment", () => {
    const withAi = local({
      participants: [
        participant("p1", "Alex", ["t1", "ai"], true),
        participant("p2", "Sam", ["t2", "t3"], false),
      ],
    });
    expect(participationStateErrors(withAi, owned, "t1").join(" ")).toMatch(
      /"ai" not in user.ownedTeamIds/,
    );
  });

  it("requires exactly one host", () => {
    const noHost = local({
      participants: [
        participant("p1", "Alex", ["t1"], false),
        participant("p2", "Sam", ["t2", "t3"], false),
      ],
    });
    expect(participationStateErrors(noHost, owned, "t1").join(" ")).toMatch(
      /exactly one host/,
    );
  });

  it("requires the active team to belong to the active participant", () => {
    expect(participationStateErrors(local(), owned, "t2").join(" ")).toMatch(
      /activeOwnerTeamId must belong to the active participant/,
    );
  });

  it("rejects unknown or duplicate ready participants", () => {
    expect(
      participationStateErrors(
        local({ readyParticipantIds: ["p9"] }),
        owned,
        "t1",
      ),
    ).not.toEqual([]);
    expect(
      participationStateErrors(
        local({ readyParticipantIds: ["p1", "p1"] }),
        owned,
        "t1",
      ),
    ).not.toEqual([]);
  });
});

describe("online participation", () => {
  function onlineParticipant(
    id: string,
    teamIds: string[],
    isHost: boolean,
    userId: string | undefined,
  ): LocalParticipant {
    return {
      id,
      displayName: id,
      teamIds,
      isHost,
      plannedTeamCount: teamIds.length,
      ...(userId === undefined ? {} : { userId }),
    };
  }
  function online(participants: LocalParticipant[]): ParticipationState {
    return {
      mode: "online",
      participants,
      activeParticipantId: participants[0]!.id,
      readyParticipantIds: [],
      assignmentsConfirmed: true,
    };
  }

  it("parses online setup and allows a host-only league", () => {
    expect(parseParticipationSetup({ mode: "online" }, 5)).toEqual({
      ok: true,
      value: { mode: "online" },
    });
    expect(
      participationStateErrors(
        online([onlineParticipant("p1", ["t1"], true, "u1")]),
        ["t1"],
        "t1",
      ),
    ).toEqual([]);
  });

  it("requires a distinct account per online participant", () => {
    const missing = online([
      onlineParticipant("p1", ["t1"], true, "u1"),
      onlineParticipant("p2", ["t2"], false, undefined),
    ]);
    expect(participationStateErrors(missing, ["t1", "t2"], "t1").join(" ")).toMatch(
      /userId is required/,
    );
    const shared = online([
      onlineParticipant("p1", ["t1"], true, "u1"),
      onlineParticipant("p2", ["t2"], false, "u1"),
    ]);
    expect(participationStateErrors(shared, ["t1", "t2"], "t1").join(" ")).toMatch(
      /already a participant/,
    );
  });

  it("rejects accounts on local participants and foreign active teams", () => {
    const localWithAccount: ParticipationState = {
      mode: "local_shared",
      participants: [
        onlineParticipant("p1", ["t1"], true, "u1"),
        onlineParticipant("p2", ["t2"], false, undefined),
      ],
      activeParticipantId: "p1",
      readyParticipantIds: [],
      assignmentsConfirmed: true,
    };
    expect(
      participationStateErrors(localWithAccount, ["t1", "t2"], "t1").join(" "),
    ).toMatch(/only allowed in online leagues/);

    const foreignActive = online([
      { ...onlineParticipant("p1", ["t1"], true, "u1"), activeTeamId: "t2" },
      onlineParticipant("p2", ["t2"], false, "u2"),
    ]);
    expect(
      participationStateErrors(foreignActive, ["t1", "t2"], "t1").join(" "),
    ).toMatch(/activeTeamId must be one of its teams/);
  });
});
