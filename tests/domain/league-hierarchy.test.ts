import { describe, expect, it } from "vitest";
import { createConference } from "@/domain/entities/conference";
import { createDivision } from "@/domain/entities/division";
import { createLeague } from "@/domain/entities/league";
import { createTeam } from "@/domain/entities/team";
import {
  asArenaId,
  asConferenceId,
  asDivisionId,
  asLeagueId,
  asTeamId,
} from "@/domain/ids";

function createLinkedTeam(input: {
  id: string;
  conferenceId: string;
  divisionId: string;
  name: string;
}) {
  return createTeam({
    id: asTeamId(input.id),
    name: input.name,
    city: "Harbor",
    abbreviation: "HAR",
    conferenceId: asConferenceId(input.conferenceId),
    divisionId: asDivisionId(input.divisionId),
    roster: [],
    staff: [],
    finances: {},
    arenaId: asArenaId(`arena_${input.id}`),
    reputation: 50,
  });
}

describe("league hierarchy relationships", () => {
  it("represents League → Conference → Division → Team through IDs", () => {
    const leagueId = asLeagueId("league_a");
    const conferenceId = asConferenceId("conf_1");
    const divisionId = asDivisionId("div_1");
    const teamId = asTeamId("team_a");

    const league = createLeague({
      id: leagueId,
      name: "League A",
      abbreviation: "LGA",
      conferenceIds: [conferenceId],
    });
    const conference = createConference({
      id: conferenceId,
      leagueId,
      name: "Conference 1",
      divisionIds: [divisionId],
    });
    const division = createDivision({
      id: divisionId,
      conferenceId,
      name: "Division 1",
      teamIds: [teamId],
    });
    const team = createLinkedTeam({
      id: "team_a",
      conferenceId: "conf_1",
      divisionId: "div_1",
      name: "Team A",
    });

    expect(league.conferenceIds).toContain(conference.id);
    expect(conference.leagueId).toBe(league.id);
    expect(conference.divisionIds).toContain(division.id);
    expect(division.conferenceId).toBe(conference.id);
    expect(division.teamIds).toContain(team.id);
    expect(team.divisionId).toBe(division.id);
    expect(team.conferenceId).toBe(conference.id);
  });

  it("represents two different league configurations without changing domain code", () => {
    const leagueA = createLeague({
      id: asLeagueId("league_a"),
      name: "League A",
      abbreviation: "LGA",
      conferenceIds: [asConferenceId("conf_1"), asConferenceId("conf_2")],
    });
    const conference1 = createConference({
      id: asConferenceId("conf_1"),
      leagueId: leagueA.id,
      name: "Conference 1",
      divisionIds: [asDivisionId("div_1"), asDivisionId("div_2")],
    });
    const conference2 = createConference({
      id: asConferenceId("conf_2"),
      leagueId: leagueA.id,
      name: "Conference 2",
      divisionIds: [asDivisionId("div_3")],
    });
    const division1 = createDivision({
      id: asDivisionId("div_1"),
      conferenceId: conference1.id,
      name: "Division 1",
      teamIds: [asTeamId("team_a"), asTeamId("team_b")],
    });
    const division2 = createDivision({
      id: asDivisionId("div_2"),
      conferenceId: conference1.id,
      name: "Division 2",
      teamIds: [asTeamId("team_c")],
    });
    const division3 = createDivision({
      id: asDivisionId("div_3"),
      conferenceId: conference2.id,
      name: "Division 3",
      teamIds: [asTeamId("team_d"), asTeamId("team_e"), asTeamId("team_f")],
    });

    const leagueB = createLeague({
      id: asLeagueId("league_b"),
      name: "League B",
      abbreviation: "LGB",
      conferenceIds: [asConferenceId("conf_b1")],
    });
    const conferenceB1 = createConference({
      id: asConferenceId("conf_b1"),
      leagueId: leagueB.id,
      name: "Conference 1",
      divisionIds: [asDivisionId("div_b1")],
    });
    const thirtyTeamIds = Array.from({ length: 30 }, (_, index) =>
      asTeamId(`team_b_${index + 1}`),
    );
    const divisionB1 = createDivision({
      id: asDivisionId("div_b1"),
      conferenceId: conferenceB1.id,
      name: "Division 1",
      teamIds: thirtyTeamIds,
    });

    expect(leagueA.conferenceIds).toHaveLength(2);
    expect(conference1.divisionIds).toHaveLength(2);
    expect(conference2.divisionIds).toHaveLength(1);
    expect(division1.teamIds).toHaveLength(2);
    expect(division2.teamIds).toHaveLength(1);
    expect(division3.teamIds).toHaveLength(3);

    expect(leagueB.conferenceIds).toEqual([conferenceB1.id]);
    expect(conferenceB1.leagueId).toBe(leagueB.id);
    expect(conferenceB1.divisionIds).toEqual([divisionB1.id]);
    expect(divisionB1.conferenceId).toBe(conferenceB1.id);
    expect(divisionB1.teamIds).toHaveLength(30);

    expect(leagueA.id).not.toBe(leagueB.id);
  });

  it("does not require referenced entities to exist at factory time", () => {
    const conference = createConference({
      id: asConferenceId("conf_orphan"),
      leagueId: asLeagueId("league_missing"),
      name: "Unlinked Conference",
      divisionIds: [],
    });
    const division = createDivision({
      id: asDivisionId("div_orphan"),
      conferenceId: asConferenceId("conf_missing"),
      name: "Unlinked Division",
      teamIds: [asTeamId("team_missing")],
    });

    expect(conference.leagueId).toBe("league_missing");
    expect(conference.divisionIds).toEqual([]);
    expect(division.conferenceId).toBe("conf_missing");
    expect(division.teamIds).toEqual(["team_missing"]);
  });
});
