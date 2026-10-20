import { describe, expect, it } from "vitest";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import {
  createEmptyTeamStanding,
  type TeamStanding,
} from "@/domain/entities/standings";
import {
  asConferenceId,
  asTeamId,
  type ConferenceId,
  type TeamId,
} from "@/domain/ids";
import { generateConferenceBracket } from "@/systems/playoff-bracket";
import { resolvePlayoffFormatFor } from "@/systems/playoff-format";
import { qualifyAndSeedByConference } from "@/systems/playoff-qualification";

const EAST = asConferenceId("conf_east");
const WEST = asConferenceId("conf_west");
const NORTH = asConferenceId("conf_north");
const SOUTH = asConferenceId("conf_south");

/**
 * `teamsPerConference` teams per conference; team `${c}_${i}` has a record
 * that interleaves conferences so overall seeds differ from conference seeds.
 */
function league(conferenceIds: ConferenceId[], teamsPerConference: number) {
  const teamConferenceById = new Map<TeamId, ConferenceId>();
  const standings: TeamStanding[] = [];
  const total = conferenceIds.length * teamsPerConference;
  for (let index = 0; index < teamsPerConference; index += 1) {
    conferenceIds.forEach((conferenceId, confIndex) => {
      const teamId = asTeamId(`${conferenceId}_${index + 1}`);
      teamConferenceById.set(teamId, conferenceId);
      const wins = total - (index * conferenceIds.length + confIndex);
      standings.push({
        ...createEmptyTeamStanding(teamId),
        wins,
        losses: total - wins,
        winPercentage: wins / total,
      });
    });
  }
  return { teamConferenceById, standings };
}

function build(
  conferenceIds: ConferenceId[],
  teamsPerConference: number,
  spots: number,
) {
  const { teamConferenceById, standings } = league(
    conferenceIds,
    teamsPerConference,
  );
  const { seeds, groups } = qualifyAndSeedByConference(
    standings,
    teamConferenceById,
    conferenceIds,
    spots,
  );
  return {
    teamConferenceById,
    seeds,
    groups,
    tournament: generateConferenceBracket(groups, seeds),
  };
}

/** Teams that can reach a series (its participants and all feeder teams). */
function reachableTeams(
  tournament: PlayoffTournament,
  seriesId: string,
): Set<TeamId> {
  const series = tournament.series.find((entry) => entry.id === seriesId)!;
  const teams = new Set<TeamId>();
  if (series.higherSeedTeamId) teams.add(series.higherSeedTeamId);
  if (series.lowerSeedTeamId) teams.add(series.lowerSeedTeamId);
  if (series.byeParticipant) teams.add(series.byeParticipant.teamId);
  for (const feeder of series.feederSeriesIds ?? []) {
    for (const team of reachableTeams(tournament, feeder)) teams.add(team);
  }
  return teams;
}

function conferencesOf(
  teams: Set<TeamId>,
  teamConferenceById: Map<TeamId, ConferenceId>,
): Set<ConferenceId> {
  return new Set([...teams].map((team) => teamConferenceById.get(team)!));
}

function finalOf(tournament: PlayoffTournament) {
  const maxRound = Math.max(...tournament.series.map((s) => s.round));
  return tournament.series.find((s) => s.round === maxRound && s.slot === 0)!;
}

describe("resolvePlayoffFormatFor", () => {
  function input(
    conferenceSizes: number[],
    playoffTeams: number,
    playInEnabled = false,
  ) {
    const ids = [EAST, WEST, NORTH, SOUTH].slice(0, conferenceSizes.length);
    const teamConferenceById = new Map<TeamId, ConferenceId>();
    conferenceSizes.forEach((size, confIndex) => {
      for (let index = 0; index < size; index += 1) {
        teamConferenceById.set(
          asTeamId(`t_${confIndex}_${index}`),
          ids[confIndex]!,
        );
      }
    });
    return {
      playoffTeams,
      playInEnabled,
      conferenceOrder: ids,
      teamConferenceById,
    };
  }

  it.each([
    [[15, 15], 16, 8],
    [[15, 15], 12, 6],
    [[15, 15], 8, 4],
    [[5, 5], 6, 3],
    [[4, 4], 4, 2],
    [[8, 8, 8, 8], 16, 4],
    [[3, 3, 3, 3], 12, 3],
    [[2, 2, 2, 2], 4, 1],
  ])("conference format for sizes %j and field %i", (sizes, field, spots) => {
    expect(resolvePlayoffFormatFor(input(sizes, field))).toEqual(
      expect.objectContaining({
        kind: "conference",
        spotsPerConference: spots,
      }),
    );
  });

  it.each([
    ["one conference", [16], 8],
    ["field does not split evenly", [4, 4, 4, 4], 6],
    ["conference too small", [9, 3], 8],
    ["unsupported per-conference size", [10, 10], 10],
  ])("league-wide when %s", (_label, sizes, field) => {
    expect(resolvePlayoffFormatFor(input(sizes, field)).kind).toBe("league");
  });

  it("league-wide when play-in is enabled", () => {
    expect(resolvePlayoffFormatFor(input([15, 15], 16, true)).kind).toBe(
      "league",
    );
  });

  it("orders conferences by league order and skips empty ones", () => {
    const format = resolvePlayoffFormatFor({
      ...input([8, 8], 8),
      conferenceOrder: [WEST, NORTH, EAST],
    });
    expect(format).toEqual(
      expect.objectContaining({ conferenceIds: [WEST, EAST] }),
    );
  });
});

describe("qualifyAndSeedByConference", () => {
  it("takes the top teams per conference even when another conference is stronger", () => {
    const { teamConferenceById, standings } = league([EAST, WEST], 6);
    // Make the whole West better than the whole East.
    const tilted = standings.map((row) =>
      teamConferenceById.get(row.teamId as TeamId) === WEST
        ? { ...row, wins: row.wins + 100, winPercentage: row.winPercentage + 1 }
        : row,
    );
    const { seeds, groups } = qualifyAndSeedByConference(
      tilted,
      teamConferenceById,
      [EAST, WEST],
      3,
    );
    expect(groups).toEqual([
      ["conf_east_1", "conf_east_2", "conf_east_3"],
      ["conf_west_1", "conf_west_2", "conf_west_3"],
    ]);
    // Overall seeds follow record across conferences.
    expect(seeds.map((s) => s.teamId)).toEqual([
      "conf_west_1",
      "conf_west_2",
      "conf_west_3",
      "conf_east_1",
      "conf_east_2",
      "conf_east_3",
    ]);
    expect(seeds.map((s) => s.seed)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("generateConferenceBracket", () => {
  it("builds NBA-style 8-per-conference brackets with 1v8, 4v5, 2v7, 3v6", () => {
    const { tournament, teamConferenceById } = build([EAST, WEST], 15, 8);
    expect(tournament.fieldSize).toBe(16);
    expect(tournament.series).toHaveLength(15);
    expect(Math.max(...tournament.series.map((s) => s.round))).toBe(3);

    const opening = tournament.series
      .filter((s) => s.round === 0)
      .sort((a, b) => a.slot - b.slot)
      .map((s) => [s.higherSeedTeamId, s.lowerSeedTeamId]);
    expect(opening).toEqual([
      ["conf_east_1", "conf_east_8"],
      ["conf_east_4", "conf_east_5"],
      ["conf_east_2", "conf_east_7"],
      ["conf_east_3", "conf_east_6"],
      ["conf_west_1", "conf_west_8"],
      ["conf_west_4", "conf_west_5"],
      ["conf_west_2", "conf_west_7"],
      ["conf_west_3", "conf_west_6"],
    ]);

    for (const series of tournament.series) {
      const conferences = conferencesOf(
        reachableTeams(tournament, series.id),
        teamConferenceById,
      );
      expect(conferences.size).toBe(series.round === 3 ? 2 : 1);
    }
    expect(finalOf(tournament).id).toBe("playoff_r3_s0");
  });

  it("gives conference #1 a bye with three per conference", () => {
    const { tournament, teamConferenceById } = build([EAST, WEST], 5, 3);
    expect(tournament.series).toHaveLength(5);
    const opening = tournament.series.filter((s) => s.round === 0);
    expect(opening.map((s) => [s.higherSeedTeamId, s.lowerSeedTeamId])).toEqual(
      [
        ["conf_east_2", "conf_east_3"],
        ["conf_west_2", "conf_west_3"],
      ],
    );
    const conferenceFinals = tournament.series.filter((s) => s.round === 1);
    expect(conferenceFinals.map((s) => s.byeParticipant?.teamId)).toEqual([
      "conf_east_1",
      "conf_west_1",
    ]);
    const final = finalOf(tournament);
    expect(final.round).toBe(2);
    expect(
      conferencesOf(reachableTeams(tournament, final.id), teamConferenceById)
        .size,
    ).toBe(2);
  });

  it("gives conference #1 and #2 byes with six per conference", () => {
    const { tournament, teamConferenceById } = build([EAST, WEST], 15, 6);
    expect(tournament.series).toHaveLength(11);
    const opening = tournament.series.filter((s) => s.round === 0);
    expect(opening.map((s) => [s.higherSeedTeamId, s.lowerSeedTeamId])).toEqual(
      [
        ["conf_east_4", "conf_east_5"],
        ["conf_east_3", "conf_east_6"],
        ["conf_west_4", "conf_west_5"],
        ["conf_west_3", "conf_west_6"],
      ],
    );
    const semis = tournament.series.filter((s) => s.round === 1);
    expect(semis.map((s) => s.byeParticipant?.teamId)).toEqual([
      "conf_east_1",
      "conf_east_2",
      "conf_west_1",
      "conf_west_2",
    ]);
    for (const series of tournament.series) {
      const conferences = conferencesOf(
        reachableTeams(tournament, series.id),
        teamConferenceById,
      );
      expect(conferences.size).toBe(series.round === 3 ? 2 : 1);
    }
  });

  it("pairs four conference champions in semifinals before the Finals", () => {
    const conferenceIds = [EAST, WEST, NORTH, SOUTH];
    const { tournament, teamConferenceById } = build(conferenceIds, 4, 4);
    expect(tournament.series).toHaveLength(15);
    const semis = tournament.series.filter((s) => s.round === 2);
    expect(semis).toHaveLength(2);
    expect(
      semis.map((s) =>
        [
          ...conferencesOf(
            reachableTeams(tournament, s.id),
            teamConferenceById,
          ),
        ].sort(),
      ),
    ).toEqual([[EAST, WEST].sort(), [NORTH, SOUTH].sort()]);
    for (const series of tournament.series.filter((s) => s.round < 2)) {
      expect(
        conferencesOf(reachableTeams(tournament, series.id), teamConferenceById)
          .size,
      ).toBe(1);
    }
  });

  it("sends the four conference winners straight to the semifinals with one spot each", () => {
    const { tournament } = build([EAST, WEST, NORTH, SOUTH], 2, 1);
    expect(tournament.series).toHaveLength(3);
    const opening = tournament.series.filter((s) => s.round === 0);
    expect(opening.map((s) => [s.higherSeedTeamId, s.lowerSeedTeamId])).toEqual(
      [
        ["conf_east_1", "conf_west_1"],
        ["conf_north_1", "conf_south_1"],
      ],
    );
  });

  it("orders series by higher overall seed so the better record hosts", () => {
    const { tournament, seeds } = build([EAST, WEST], 8, 4);
    const seedOf = new Map(seeds.map((s) => [s.teamId, s.seed]));
    for (const series of tournament.series.filter((s) => s.round === 0)) {
      expect(seedOf.get(series.higherSeedTeamId!)).toBe(series.higherSeed);
      expect(series.higherSeed!).toBeLessThan(series.lowerSeed!);
    }
  });

  it("rejects uneven conference groups", () => {
    expect(() =>
      generateConferenceBracket(
        [[asTeamId("a"), asTeamId("b")], [asTeamId("c")]],
        [
          { teamId: asTeamId("a"), seed: 1 },
          { teamId: asTeamId("b"), seed: 2 },
          { teamId: asTeamId("c"), seed: 3 },
        ],
      ),
    ).toThrow(/same number of teams/);
  });
});
