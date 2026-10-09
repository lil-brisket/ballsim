import { describe, expect, it } from "vitest";
import {
  parseTradeProposal,
  proposalSendsPlayer,
} from "@/domain/entities/trade-proposal";
import { asPlayerId, asTeamId } from "@/domain/ids";

describe("parseTradeProposal", () => {
  const valid = {
    sideA: {
      teamId: "team_a",
      playerIds: ["player_1"],
      draftPickIds: [],
    },
    sideB: {
      teamId: "team_b",
      playerIds: ["player_2"],
      draftPickIds: ["pick_1"],
    },
  };

  it("parses a JSON string and a plain object", () => {
    const fromJson = parseTradeProposal(JSON.stringify(valid));
    const fromObject = parseTradeProposal(valid);
    expect(fromJson).toEqual(valid);
    expect(fromObject).toEqual(valid);
  });

  it("returns null for malformed payloads", () => {
    expect(parseTradeProposal("")).toBeNull();
    expect(parseTradeProposal("{")).toBeNull();
    expect(parseTradeProposal({ sideA: valid.sideA })).toBeNull();
    expect(
      parseTradeProposal({
        ...valid,
        sideB: { teamId: "team_b", playerIds: "nope", draftPickIds: [] },
      }),
    ).toBeNull();
  });

  it("proposalSendsPlayer is true only for the sending side", () => {
    const proposal = parseTradeProposal(valid);
    expect(proposal).not.toBeNull();
    expect(
      proposalSendsPlayer(
        proposal!,
        asTeamId("team_a"),
        asPlayerId("player_1"),
      ),
    ).toBe(true);
    expect(
      proposalSendsPlayer(
        proposal!,
        asTeamId("team_a"),
        asPlayerId("player_2"),
      ),
    ).toBe(false);
    expect(
      proposalSendsPlayer(
        proposal!,
        asTeamId("team_c"),
        asPlayerId("player_1"),
      ),
    ).toBe(false);
  });
});
