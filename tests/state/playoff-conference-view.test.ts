import { describe, expect, it } from "vitest";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import {
  createEmptyTeamStanding,
  type TeamStanding,
} from "@/domain/entities/standings";
import type { Team } from "@/domain/entities/team";
import {
  asConferenceId,
  asTeamId,
  type ConferenceId,
  type TeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  conferenceSeedByTeam,
  isConferenceBracket,
  seriesConferenceId,
} from "@/state/playoff-conference-view";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import { derivePlayoffResults } from "@/systems/franchise-history";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { getTeamPlayoffSeed } from "@/systems/owner-objective-definitions";
import {
  generateBracket,
  generateConferenceBracket,
} from "@/systems/playoff-bracket";
import {
  qualifyAndSeed,
  qualifyAndSeedByConference,
} from "@/systems/playoff-qualification";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

const CONFERENCES = ["east", "west", "north", "south"].map((name) =>
  asConferenceId(`conf_${name}`),
);

type Synthetic = {
  state: GameState;
  conferenceIds: ConferenceId[];
  standings: TeamStanding[];
};

/**
 * Synthetic league: `perConference` teams in each of `conferenceCount`
 * conferences. Records interleave conferences (east_1 best, west_1 next...),
 * so overall seeds differ from conference seeds. No playoffs are started.
 */
function syntheticLeague(
  conferenceCount: number,
  perConference: number,
  playoffTeams: number,
  saveId: string,
): Synthetic {
  const base = bootstrapWorld(
    createTestGameState({ saveId }),
    createSeededRng(saveId),
  ).state;
  const template: Team = Object.values(base.world.teams)[0]!;
  const conferenceIds = CONFERENCES.slice(0, conferenceCount);
  const total = conferenceCount * perConference;
  const teams: Record<string, Team> = {};
  const standings: TeamStanding[] = [];
  for (let index = 0; index < perConference; index += 1) {
    conferenceIds.forEach((conferenceId, confIndex) => {
      const id = asTeamId(`${conferenceId}_${index + 1}`);
      teams[id] = {
        ...template,
        id,
        city: conferenceId,
        name: `T${index + 1}`,
        abbreviation: `T${index + 1}`,
        conferenceId,
      };
      const wins = total - (index * conferenceCount + confIndex);
      standings.push({
        ...createEmptyTeamStanding(id),
        wins,
        losses: total - wins,
        winPercentage: wins / total,
      });
    });
  }
  const firstTeam = asTeamId(`${conferenceIds[0]}_1`);
  const state: GameState = {
    ...base,
    world: {
      ...base.world,
      teams,
      conferences: Object.fromEntries(
        conferenceIds.map((id) => [
          id,
          {
            id,
            leagueId: base.world.league.id,
            name: id.replace("conf_", "").toUpperCase(),
            divisionIds: [],
          },
        ]),
      ),
      league: { ...base.world.league, conferenceIds },
    },
    settings: {
      ...base.settings,
      playoffs: {
        ...base.settings.playoffs,
        playoffTeams,
        playInEnabled: false,
      },
    },
    user: {
      ...base.user,
      ownedTeamIds: [firstTeam],
      activeOwnerTeamId: firstTeam,
    },
    competition: {
      ...base.competition,
      standings: {
        byTeamId: Object.fromEntries(standings.map((s) => [s.teamId, s])),
      },
    },
  };
  return { state, conferenceIds, standings };
}

function withPlayoffs(
  state: GameState,
  tournament: PlayoffTournament,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      playoffs: { ...tournament, status: "in_progress" },
    },
  };
}

function conferenceBracketState(
  conferenceCount: number,
  perConference: number,
  spots: number,
  saveId: string,
): GameState {
  const league = syntheticLeague(
    conferenceCount,
    perConference,
    spots * conferenceCount,
    saveId,
  );
  const { seeds, groups } = qualifyAndSeedByConference(
    league.standings,
    new Map(
      Object.values(league.state.world.teams).map((t) => [
        t.id,
        t.conferenceId,
      ]),
    ),
    league.conferenceIds,
    spots,
  );
  return withPlayoffs(league.state, generateConferenceBracket(groups, seeds));
}

function leagueWideState(
  conferenceCount: number,
  perConference: number,
  field: number,
  saveId: string,
): GameState {
  const league = syntheticLeague(conferenceCount, perConference, field, saveId);
  return withPlayoffs(
    league.state,
    generateBracket(qualifyAndSeed(league.standings, field)),
  );
}

function labelsByRound(state: GameState): string[] {
  return toPlayoffHubView(state).rounds.map((round) => round.label);
}

describe("conferenceSeedByTeam", () => {
  it("numbers qualifiers 1..k within each conference", () => {
    const state = conferenceBracketState(2, 10, 8, "seed-conf");
    const seeds = conferenceSeedByTeam(state);
    expect(seeds.size).toBe(16);
    // east_1 is overall #1, west_1 overall #2, east_2 overall #3 ...
    expect(seeds.get(asTeamId("conf_east_1"))).toBe(1);
    expect(seeds.get(asTeamId("conf_west_1"))).toBe(1);
    expect(seeds.get(asTeamId("conf_east_3"))).toBe(3);
    expect(seeds.get(asTeamId("conf_west_8"))).toBe(8);
    for (const conferenceId of CONFERENCES.slice(0, 2)) {
      const ranks = [...seeds.entries()]
        .filter(([teamId]) => teamId.startsWith(conferenceId))
        .map(([, seed]) => seed)
        .sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it("returns the overall seed for league-wide brackets", () => {
    const state = leagueWideState(2, 10, 16, "seed-league");
    const seeds = conferenceSeedByTeam(state);
    for (const entry of state.competition.playoffs.qualifiedTeams) {
      expect(seeds.get(entry.teamId)).toBe(entry.seed);
    }
  });
});

describe("isConferenceBracket / seriesConferenceId", () => {
  it.each([
    [2, 10, 8],
    [2, 6, 3],
    [2, 4, 2],
    [2, 8, 6],
    [4, 6, 4],
    [4, 4, 3],
  ])("is true for %i conferences with %i teams and k=%i", (c, n, k) => {
    const state = conferenceBracketState(c, n, k, `is-conf-${c}-${n}-${k}`);
    expect(isConferenceBracket(state.competition.playoffs, state)).toBe(true);
  });

  it("is false for an old league-wide 16-team bracket that mixes conferences", () => {
    const state = leagueWideState(2, 10, 16, "old-16");
    expect(isConferenceBracket(state.competition.playoffs, state)).toBe(false);
  });

  it("is false for a single-conference or empty tournament", () => {
    const single = leagueWideState(1, 12, 8, "single");
    expect(isConferenceBracket(single.competition.playoffs, single)).toBe(
      false,
    );
    const empty = syntheticLeague(2, 10, 16, "empty").state;
    expect(isConferenceBracket(empty.competition.playoffs, empty)).toBe(false);
  });

  it("assigns series to one conference until the cross-conference rounds", () => {
    const state = conferenceBracketState(2, 10, 8, "series-conf");
    const tournament = state.competition.playoffs;
    const final = tournament.series.find((s) => s.round === 3)!;
    expect(seriesConferenceId(final, tournament, state)).toBeNull();
    for (const series of tournament.series.filter((s) => s.round < 3)) {
      expect(seriesConferenceId(series, tournament, state)).not.toBeNull();
    }
  });
});

describe("playoff hub conference view", () => {
  it("labels a 2 x 8 bracket and splits it by conference", () => {
    const state = conferenceBracketState(2, 10, 8, "hub-8");
    const hub = toPlayoffHubView(state);
    expect(hub.isConferenceBracket).toBe(true);
    expect(labelsByRound(state)).toEqual([
      "First Round",
      "Conference Semifinals",
      "Conference Finals",
      "Finals",
    ]);
    expect(hub.conferenceSections.map((s) => s.conferenceName)).toEqual([
      "EAST",
      "WEST",
    ]);
    for (const section of hub.conferenceSections) {
      expect(section.rounds.map((r) => r.label)).toEqual([
        "First Round",
        "Conference Semifinals",
        "Conference Finals",
      ]);
      const first = section.rounds[0]!.series;
      expect(first).toHaveLength(4);
      expect(first.every((s) => s.conferenceId === section.conferenceId)).toBe(
        true,
      );
      // Conference seeds: 1 v 8 first.
      expect(first[0]!.higherSeed).toBe(1);
      expect(first[0]!.lowerSeed).toBe(8);
    }
    expect(hub.crossConferenceRounds.map((r) => r.label)).toEqual(["Finals"]);
    const finals = hub.crossConferenceRounds[0]!.series[0]!;
    expect(finals.conferenceId).toBeNull();
    expect(finals.conferenceName).toBeNull();
    // Overall seeds stay available.
    const eastOpener = hub.conferenceSections[0]!.rounds[0]!.series[0]!;
    expect(eastOpener.higherOverallSeed).toBe(1);
    const westOpener = hub.conferenceSections[1]!.rounds[0]!.series[0]!;
    expect(westOpener.higherSeed).toBe(1);
    expect(westOpener.higherOverallSeed).toBe(2);
  });

  it("labels k=3 as First Round then Conference Finals", () => {
    const state = conferenceBracketState(2, 6, 3, "hub-3");
    expect(labelsByRound(state)).toEqual([
      "First Round",
      "Conference Finals",
      "Finals",
    ]);
  });

  it("labels k=2 as just the Conference Finals before the Finals", () => {
    const state = conferenceBracketState(2, 4, 2, "hub-2");
    expect(labelsByRound(state)).toEqual(["Conference Finals", "Finals"]);
  });

  it("labels k=6 with a conference semifinal round", () => {
    const state = conferenceBracketState(2, 8, 6, "hub-6");
    expect(labelsByRound(state)).toEqual([
      "First Round",
      "Conference Semifinals",
      "Conference Finals",
      "Finals",
    ]);
  });

  it("adds Semifinals and Finals sections with four conferences", () => {
    const state = conferenceBracketState(4, 6, 4, "hub-4conf");
    const hub = toPlayoffHubView(state);
    expect(hub.conferenceSections).toHaveLength(4);
    expect(labelsByRound(state)).toEqual([
      "First Round",
      "Conference Finals",
      "Semifinals",
      "Finals",
    ]);
    expect(hub.crossConferenceRounds.map((r) => r.label)).toEqual([
      "Semifinals",
      "Finals",
    ]);
  });

  it("keeps league-wide labels and seeds for an old bracket", () => {
    const state = leagueWideState(2, 10, 16, "hub-old");
    const hub = toPlayoffHubView(state);
    expect(hub.isConferenceBracket).toBe(false);
    expect(hub.conferenceSections).toEqual([]);
    expect(hub.rounds.map((r) => r.label)).toEqual([
      "round of 16",
      "quarterfinal",
      "semifinal",
      "final",
    ]);
    const opener = hub.rounds[0]!.series[0]!;
    expect(opener.higherSeed).toBe(1);
    expect(opener.lowerSeed).toBe(16);
    expect(opener.conferenceId).toBeNull();
  });

  it("falls back to numbered rounds for a 6-team league-wide bracket", () => {
    const state = leagueWideState(1, 12, 6, "hub-6-league");
    const labels = labelsByRound(state);
    expect(labels).toEqual(["Round 1", "Round 2", "Round 3"]);
  });
});

describe("getTeamPlayoffSeed", () => {
  it("returns the overall seed, not the conference seed, in a conference bracket", () => {
    const state = conferenceBracketState(2, 10, 8, "owner-seed");
    const teamId = asTeamId("conf_west_2");
    const overall = state.competition.playoffs.qualifiedTeams.find(
      (entry) => entry.teamId === teamId,
    )!.seed;
    expect(conferenceSeedByTeam(state).get(teamId)).toBe(2);
    expect(overall).not.toBe(2);
    expect(getTeamPlayoffSeed(state, teamId)).toBe(overall);
    expect(getTeamPlayoffSeed(state, asTeamId("conf_east_9"))).toBeNull();
  });

  it("returns the overall seed in a league-wide bracket", () => {
    const state = leagueWideState(2, 10, 16, "owner-seed-league");
    expect(getTeamPlayoffSeed(state, asTeamId("conf_west_2"))).toBe(4);
  });
});

describe("resolvePlayoffRace in conference mode", () => {
  function regularSeason(state: GameState, playoffTeams: number): GameState {
    return {
      ...state,
      settings: {
        ...state.settings,
        playoffs: { ...state.settings.playoffs, playoffTeams },
      },
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
      },
    };
  }

  function ownedBy(state: GameState, teamId: TeamId): GameState {
    return {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamId],
        activeOwnerTeamId: teamId,
      },
    };
  }

  /** East is far stronger than West, so conference and league ranks differ. */
  function lopsided(saveId: string): GameState {
    const base = regularSeason(syntheticLeague(2, 10, 8, saveId).state, 8);
    const byTeamId = { ...base.competition.standings.byTeamId };
    for (const id of Object.keys(byTeamId)) {
      const standing = byTeamId[id]!;
      const index = Number(id.split("_").at(-1));
      const wins = id.startsWith("conf_west") ? 60 - 3 * index : 100 - index;
      byTeamId[id] = {
        ...standing,
        wins,
        losses: 100 - wins,
        winPercentage: wins / 100,
      };
    }
    return {
      ...base,
      competition: {
        ...base.competition,
        // No games left, so the race resolves to clinched / eliminated.
        schedule: { ...base.competition.schedule, gameIds: [] },
        standings: { byTeamId },
      },
    };
  }

  it("ranks within the conference against the top-k spots", () => {
    // 2 conferences, 8-team field -> k=4. west_1 is far outside the league
    // top 8 but is conference #1.
    const base = lopsided("race-conf");
    expect(
      getCalendarContext(ownedBy(base, asTeamId("conf_west_1"))).playoffRace,
    ).toBe("clinched");
    expect(
      getCalendarContext(ownedBy(base, asTeamId("conf_west_4"))).playoffRace,
    ).toBe("clinched");
    expect(
      getCalendarContext(ownedBy(base, asTeamId("conf_west_10"))).playoffRace,
    ).toBe("eliminated");
  });

  it("ranks the whole league against playoffTeams in league mode", () => {
    const base = lopsided("race-league");
    const league: GameState = {
      ...base,
      settings: {
        ...base.settings,
        playoffs: { ...base.settings.playoffs, playInEnabled: true },
      },
    };
    // west_1 is overall #11 with a big gap to the league cut.
    expect(
      getCalendarContext(ownedBy(league, asTeamId("conf_west_1"))).playoffRace,
    ).toBe("eliminated");
    expect(
      getCalendarContext(ownedBy(league, asTeamId("conf_east_8"))).playoffRace,
    ).toBe("clinched");
  });
});

describe("derivePlayoffResults in a conference bracket", () => {
  it("records a conference finals loss and a Finals loss by depth", () => {
    // k=3: round 0 first round, round 1 conference finals, round 2 Finals.
    const base = conferenceBracketState(2, 6, 3, "history-conf");
    const east = asTeamId("conf_east_1");
    const eastRival = asTeamId("conf_east_2");
    const west = asTeamId("conf_west_1");
    const series = base.competition.playoffs.series.map((entry) => {
      const conferenceId = seriesConferenceId(
        entry,
        base.competition.playoffs,
        base,
      );
      if (entry.round === 1 && conferenceId === CONFERENCES[0]) {
        return {
          ...entry,
          higherSeedTeamId: east,
          lowerSeedTeamId: eastRival,
          status: "complete" as const,
          winnerTeamId: east,
        };
      }
      if (entry.round === 2) {
        return {
          ...entry,
          higherSeedTeamId: east,
          lowerSeedTeamId: west,
          status: "complete" as const,
          winnerTeamId: east,
        };
      }
      return entry;
    });
    const state = {
      ...base,
      competition: {
        ...base.competition,
        playoffs: {
          ...base.competition.playoffs,
          status: "complete" as const,
          series,
          championTeamId: east,
        },
      },
    };
    const results = derivePlayoffResults(state);
    expect(results[east]).toBe("champion");
    expect(results[eastRival]).toBe("conference_finals");
    expect(results[west]).toBe("finals");
  });
});
