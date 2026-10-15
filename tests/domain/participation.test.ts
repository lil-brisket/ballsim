import { describe, expect, it } from "vitest";
import {
  controlledTeamCountForSetup,
  MAX_LOCAL_PARTICIPANTS,
  PARTICIPANT_NAME_MAX_LENGTH,
  parseParticipationSetup,
  participationStateErrors,
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

  it("rejects unknown modes, including online", () => {
    expect(parseParticipationSetup({ mode: "online" }, 5).ok).toBe(false);
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
  function local(
    overrides: Partial<
      Extract<ParticipationState, { mode: "local_shared" }>
    > = {},
  ): ParticipationState {
    return {
      mode: "local_shared",
      participants: [
        { id: "p1", displayName: "Alex", teamIds: ["t1"], isHost: true },
        { id: "p2", displayName: "Sam", teamIds: ["t2", "t3"], isHost: false },
      ],
      activeParticipantId: "p1",
      readyParticipantIds: [],
      ...overrides,
    };
  }

  it("accepts single mode and a consistent local shared state", () => {
    expect(participationStateErrors({ mode: "single" }, owned, "t1")).toEqual(
      [],
    );
    expect(participationStateErrors(local(), owned, "t1")).toEqual([]);
  });

  it("requires every owned team to be assigned exactly once", () => {
    const unassigned = local({
      participants: [
        { id: "p1", displayName: "Alex", teamIds: ["t1"], isHost: true },
        { id: "p2", displayName: "Sam", teamIds: ["t2"], isHost: false },
      ],
    });
    expect(participationStateErrors(unassigned, owned, "t1").join(" ")).toMatch(
      /"t3" is not assigned/,
    );
    const doubled = local({
      participants: [
        { id: "p1", displayName: "Alex", teamIds: ["t1", "t2"], isHost: true },
        { id: "p2", displayName: "Sam", teamIds: ["t2", "t3"], isHost: false },
      ],
    });
    expect(participationStateErrors(doubled, owned, "t1").join(" ")).toMatch(
      /more than one participant/,
    );
  });

  it("rejects AI teams in an assignment", () => {
    const withAi = local({
      participants: [
        { id: "p1", displayName: "Alex", teamIds: ["t1", "ai"], isHost: true },
        { id: "p2", displayName: "Sam", teamIds: ["t2", "t3"], isHost: false },
      ],
    });
    expect(participationStateErrors(withAi, owned, "t1").join(" ")).toMatch(
      /"ai" not in user\.ownedTeamIds/,
    );
  });

  it("requires exactly one host", () => {
    const noHost = local({
      participants: [
        { id: "p1", displayName: "Alex", teamIds: ["t1"], isHost: false },
        { id: "p2", displayName: "Sam", teamIds: ["t2", "t3"], isHost: false },
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
