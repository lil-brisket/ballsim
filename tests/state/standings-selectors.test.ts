import { describe, expect, it } from "vitest";
import {
  createEmptyTeamStanding,
  type TeamStanding,
} from "@/domain/entities/standings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  toPlayoffRaceView,
  toStandingsPageView,
} from "@/state/standings-selectors";
import { compareStandings } from "@/systems/standings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

const OVERALL = { view: "overall" as const, stats: "standard" as const };
const CONFERENCE = { view: "conference" as const, stats: "standard" as const };
const DIVISION = { view: "division" as const, stats: "standard" as const };
const OVERALL_ADVANCED = { view: "overall" as const, stats: "advanced" as const };
const CONFERENCE_ADVANCED = {
  view: "conference" as const,
  stats: "advanced" as const,
};
const DIVISION_ADVANCED = {
  view: "division" as const,
  stats: "advanced" as const,
};

function boot(saveId: string): GameState {
  const rng = createSeededRng("standings-hub");
  return bootstrapWorld(createTestGameState({ saveId }), rng).state;
}

function standingRecord(
  teamId: string,
  wins: number,
  losses: number,
  extras: Partial<TeamStanding> = {},
): TeamStanding {
  const games = wins + losses;
  const pointsFor = extras.pointsFor ?? wins * 110 + losses * 90;
  const pointsAgainst = extras.pointsAgainst ?? wins * 95 + losses * 105;
  return {
    ...createEmptyTeamStanding(teamId as TeamId),
    ...extras,
    teamId: teamId as TeamId,
    wins,
    losses,
    winPercentage: games === 0 ? 0 : wins / games,
    pointsFor,
    pointsAgainst,
    pointDifferential: extras.pointDifferential ?? pointsFor - pointsAgainst,
  };
}

function assignLadder(state: GameState): GameState {
  const teamIds = Object.keys(state.world.teams).sort();
  const byTeamId = { ...state.competition.standings.byTeamId };
  teamIds.forEach((teamId, index) => {
    const wins = teamIds.length - 1 - index;
    byTeamId[teamId] = standingRecord(teamId, wins, index);
  });
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: { byTeamId },
    },
  };
}

function setPlayoffTeams(state: GameState, playoffTeams: number): GameState {
  return {
    ...state,
    settings: {
      ...state.settings,
      playoffs: { ...state.settings.playoffs, playoffTeams },
    },
  };
}

describe("toStandingsPageView", () => {
  it("projects overall, conference, and division for standard and advanced", () => {
    const state = assignLadder(boot("views"));
    const combos = [
      OVERALL,
      OVERALL_ADVANCED,
      CONFERENCE,
      CONFERENCE_ADVANCED,
      DIVISION,
      DIVISION_ADVANCED,
    ] as const;

    for (const options of combos) {
      const page = toStandingsPageView(state, options);
      expect(page.view).toBe(options.view);
      expect(page.stats).toBe(options.stats);
      expect(page.groups.length).toBeGreaterThan(0);
      expect(page.leagueRows.length).toBe(Object.keys(state.world.teams).length);
    }

    const overall = toStandingsPageView(state, OVERALL);
    expect(overall.groups).toHaveLength(1);
    expect(overall.groups[0]!.kind).toBe("overall");
    expect(overall.groups[0]!.cutoffRank).toBe(state.settings.playoffs.playoffTeams);
    expect(overall.groups[0]!.rows[0]!.leagueRank).toBe(1);
    expect(overall.groups[0]!.rows[0]!.gamesBackLeague).toBe(0);

    const conference = toStandingsPageView(state, CONFERENCE);
    expect(conference.groups.every((g) => g.kind === "conference")).toBe(true);
    expect(conference.groups.every((g) => g.cutoffRank === null)).toBe(true);
    for (const group of conference.groups) {
      expect(group.rows[0]!.conferenceRank).toBe(1);
      expect(group.rows[0]!.gamesBackConference).toBe(0);
    }

    const division = toStandingsPageView(state, DIVISION);
    expect(division.groups.every((g) => g.kind === "division")).toBe(true);
    expect(division.groups.every((g) => g.cutoffRank === null)).toBe(true);
    for (const group of division.groups) {
      const ids = new Set(group.rows.map((r) => r.divisionId));
      expect(ids.size).toBe(1);
      expect(group.rows[0]!.divisionRank).toBe(1);
      expect(group.rows[0]!.gamesBackDivision).toBe(0);
    }
  });

  it("orders ties with compareStandings", () => {
    const state = boot("ties");
    const teamIds = Object.keys(state.world.teams).sort();
    const a = teamIds[0]!;
    const b = teamIds[1]!;
    const byTeamId = { ...state.competition.standings.byTeamId };
    byTeamId[a] = standingRecord(a, 5, 5, {
      pointsFor: 1100,
      pointsAgainst: 1000,
    });
    byTeamId[b] = standingRecord(b, 5, 5, {
      pointsFor: 1000,
      pointsAgainst: 990,
    });
    const tied = {
      ...state,
      competition: { ...state.competition, standings: { byTeamId } },
    };
    const page = toStandingsPageView(tied, OVERALL);
    const standingA = byTeamId[a]!;
    const standingB = byTeamId[b]!;
    const expectedFirst =
      compareStandings(standingA, standingB) <= 0 ? a : b;
    expect(page.leagueRows[0]!.teamId).toBe(expectedFirst);
  });

  it("labels playoff from league rank and never play_in or eliminated in-season", () => {
    const state = setPlayoffTeams(assignLadder(boot("labels")), 4);
    const page = toStandingsPageView(state, OVERALL);
    for (const row of page.leagueRows) {
      expect(row.playoffLabel).not.toBe("play_in");
      expect(row.playoffLabel).not.toBe("eliminated");
      if (row.leagueRank <= 4) {
        expect(row.playoffLabel).toBe("playoff");
      } else if (row.leagueRank <= 8) {
        expect(row.playoffLabel).toBe("bubble");
      } else {
        expect(row.playoffLabel).toBe("na");
      }
    }
  });

  it("suppresses overall cutoff when playoffTeams covers the league", () => {
    const state = setPlayoffTeams(assignLadder(boot("allin")), 12);
    const page = toStandingsPageView(state, OVERALL);
    expect(page.groups[0]!.cutoffRank).toBeNull();
    const race = toPlayoffRaceView(state);
    expect(race.applicable).toBe(false);
  });

  it("suppresses cutoff when playoffTeams is below 1", () => {
    const state = setPlayoffTeams(assignLadder(boot("none")), 0);
    const page = toStandingsPageView(state, OVERALL);
    expect(page.groups[0]!.cutoffRank).toBeNull();
    expect(toPlayoffRaceView(state).applicable).toBe(false);
  });

  it("derives PPG Opp PPG and NET and stays null at zero games", () => {
    const state = boot("rates");
    const teamId = Object.keys(state.world.teams)[0]!;
    const byTeamId = { ...state.competition.standings.byTeamId };
    byTeamId[teamId] = standingRecord(teamId, 2, 0, {
      pointsFor: 220,
      pointsAgainst: 180,
    });
    const withGames = {
      ...state,
      competition: { ...state.competition, standings: { byTeamId } },
    };
    const played = toStandingsPageView(withGames, OVERALL_ADVANCED)
      .leagueRows.find((r) => r.teamId === teamId)!;
    expect(played.ppg).toBe(110);
    expect(played.oppPpg).toBe(90);
    expect(played.net).toBe(20);
    expect(Number.isFinite(played.ppg)).toBe(true);
    expect(Number.isFinite(played.oppPpg)).toBe(true);
    expect(Number.isFinite(played.net)).toBe(true);

    const zero = toStandingsPageView(state, OVERALL_ADVANCED).leagueRows[0]!;
    expect(zero.gamesPlayed).toBe(0);
    expect(zero.ppg).toBeNull();
    expect(zero.oppPpg).toBeNull();
    expect(zero.net).toBeNull();
  });

  it("still builds division ranks when divisionsEnabled is false", () => {
    const state = {
      ...assignLadder(boot("nodiv")),
      settings: {
        ...boot("nodiv").settings,
        league: {
          ...boot("nodiv").settings.league,
          divisionsEnabled: false,
        },
      },
    };
    const page = toStandingsPageView(state, DIVISION);
    expect(page.divisionsEnabled).toBe(false);
    expect(page.groups.every((g) => g.kind === "division")).toBe(true);
    expect(page.leagueRows.every((r) => r.divisionRank >= 1)).toBe(true);
  });
});

describe("toPlayoffRaceView", () => {
  it("uses league rank and playoffTeams, matching overall standings", () => {
    const state = assignLadder(boot("race"));
    const overall = toStandingsPageView(state, OVERALL);
    const race = toPlayoffRaceView(state);
    expect(race.applicable).toBe(true);
    expect(race.cutoffRank).toBe(8);
    const shown = [...race.above, ...race.below].map((r) => r.teamId);
    const overallIds = overall.leagueRows.map((r) => r.teamId);
    for (const id of shown) {
      expect(overallIds).toContain(id);
    }
    const aboveRanks = race.above.map((r) => r.leagueRank);
    expect(aboveRanks).toEqual([...aboveRanks].sort((a, b) => a - b));
    expect(race.above.at(-1)?.leagueRank).toBe(8);
    expect(race.below[0]?.leagueRank).toBe(9);
  });

  it("moves the cutoff when playoffTeams changes", () => {
    const state = setPlayoffTeams(assignLadder(boot("race2")), 4);
    const race = toPlayoffRaceView(state);
    expect(race.cutoffRank).toBe(4);
    expect(race.above.at(-1)?.leagueRank).toBe(4);
    expect(race.below[0]?.leagueRank).toBe(5);
  });

  it("uses min(4, available) and shows every team in a small field", () => {
    const state = setPlayoffTeams(assignLadder(boot("small")), 4);
    const race = toPlayoffRaceView(state);
    expect(race.above.length).toBeLessThanOrEqual(4);
    expect(race.below.length).toBeLessThanOrEqual(4);
  });

  it("is not applicable in playoffs", () => {
    const base = assignLadder(boot("po"));
    const state: GameState = {
      ...base,
      competition: {
        ...base.competition,
        season: { ...base.competition.season, phase: "playoffs" },
        playoffs: { ...base.competition.playoffs, status: "in_progress" },
      },
    };
    expect(toPlayoffRaceView(state).applicable).toBe(false);
  });

  it("does not inject extras with no owned teams and does not duplicate cutoff user", () => {
    const ladder = assignLadder(boot("owned"));
    const cutoffTeam = toStandingsPageView(ladder, OVERALL).leagueRows.find(
      (r) => r.leagueRank === 8,
    )!;
    const atCutoff: GameState = {
      ...ladder,
      user: { ...ladder.user, ownedTeamIds: [cutoffTeam.teamId as TeamId] },
    };
    const raceAtCutoff = toPlayoffRaceView(atCutoff);
    const matches = [...raceAtCutoff.above, ...raceAtCutoff.below].filter(
      (r) => r.teamId === cutoffTeam.teamId,
    );
    expect(matches).toHaveLength(1);

    const spectator: GameState = {
      ...ladder,
      user: { ...ladder.user, ownedTeamIds: [] },
    };
    const spec = toPlayoffRaceView(spectator);
    expect(spec.above.every((r) => !r.isUserTeam)).toBe(true);

    const leader = toStandingsPageView(ladder, OVERALL).leagueRows[0]!;
    const last = toStandingsPageView(ladder, OVERALL).leagueRows.at(-1)!;
    const multi: GameState = {
      ...ladder,
      user: {
        ...ladder.user,
        ownedTeamIds: [leader.teamId as TeamId, last.teamId as TeamId],
      },
    };
    const multiRace = toPlayoffRaceView(multi);
    const ids = [...multiRace.above, ...multiRace.below].map((r) => r.teamId);
    expect(ids).toContain(leader.teamId);
    expect(ids).toContain(last.teamId);
  });
});
