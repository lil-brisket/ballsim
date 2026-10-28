import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { buildLeagueTimeline } from "@/state/media-timeline/build-league-timeline";
import type { GameState } from "@/state/game-state";
import type {
  AwardRaceAttachment,
  TimelinePost,
} from "@/state/media-timeline/types";
import { createPlayer } from "../../factories/player";
import {
  finalGame,
  otherTeams,
  seasonDay,
  statRow,
  timelineState,
  withGames,
} from "./fixtures";

// Oct 1, 2026 is a Thursday: day 3 (Oct 4) is the first Sunday.
const MONDAY_AFTER_OCT_25 = "2026-10-26";

type Line = { points: number; assists: number; rebounds: number };

function setup() {
  const base = timelineState();
  const [first, second] = otherTeams(base);
  const teamA: string = first!;
  const teamB: string = second!;
  const players = Object.fromEntries(
    [
      ["race_a", teamA],
      ["race_b", teamB],
    ].map(([id, teamId]) => [
      id,
      {
        ...createPlayer({ id: asPlayerId(id!) }),
        firstName: id === "race_a" ? "Ada" : "Bo",
        lastName: "Racer",
        teamId: asTeamId(teamId!),
      },
    ]),
  );
  const state: GameState = {
    ...base,
    // A full-length season: race minimums are the unscaled 10 games.
    settings: {
      ...base.settings,
      regularSeason: { ...base.settings.regularSeason, gamesPerTeam: 82 },
    },
    world: {
      ...base.world,
      players: { ...base.world.players, ...players },
    },
  };
  return { state, teamA, teamB };
}

function withSeasonLength(state: GameState, gamesPerTeam: number): GameState {
  return {
    ...state,
    settings: {
      ...state.settings,
      regularSeason: { ...state.settings.regularSeason, gamesPerTeam },
    },
  };
}

/** One game a day on days [from, to]; `lines(day)` gives each player's line. */
function season(
  base: GameState,
  teamA: string,
  teamB: string,
  from: number,
  to: number,
  lines: (day: number) => { a: Line; b: Line },
  competitionType: "regular_season" | "playoffs" = "regular_season",
): GameState {
  const games = [];
  for (let day = from; day <= to; day += 1) {
    const { a, b } = lines(day);
    games.push(
      finalGame(base, {
        id: `race_${competitionType}_${day}`,
        date: seasonDay(day),
        home: teamA,
        away: teamB,
        homeScore: a.points > b.points ? 110 : 100,
        awayScore: a.points > b.points ? 100 : 110,
        competitionType,
        stats: [
          statRow("race_a", teamA, { ...a, minutes: 34 }),
          statRow("race_b", teamB, { ...b, minutes: 34 }),
        ],
      }),
    );
  }
  return withGames(base, games);
}

const STAR: Line = { points: 32, assists: 8, rebounds: 9 };
const ROLE: Line = { points: 8, assists: 1, rebounds: 3 };

function withDate(state: GameState, currentDate: string): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate },
    },
  };
}

function racePosts(state: GameState, awardId = "mvp"): TimelinePost[] {
  return buildLeagueTimeline(state, { limit: 10_000 }).posts.filter((post) =>
    post.id.startsWith(`award-race:${state.competition.season.id}:${awardId}:`),
  );
}

function attachment(post: TimelinePost): AwardRaceAttachment {
  return post.attachment as AwardRaceAttachment;
}

describe("detectAwardRaces", () => {
  it("posts on the Monday after a completed week, never before it ends", () => {
    const { state, teamA, teamB } = setup();
    const played = season(state, teamA, teamB, 1, 24, () => ({
      a: STAR,
      b: ROLE,
    }));

    const monday = racePosts(withDate(played, MONDAY_AFTER_OCT_25));
    const latest = monday.find(
      (p) => attachment(p).throughDate === "2026-10-25",
    );
    expect(latest?.occurredOn).toBe("2026-10-26");
    expect(latest?.kind).toBe("award");
    expect(latest?.id).toBe(
      `award-race:${state.competition.season.id}:mvp:2026-10-25`,
    );
    expect(latest?.tags).toEqual(["Most Valuable Player", "Award Race"]);
    expect(latest?.teamIds.sort()).toEqual([teamA, teamB].sort());
    expect(attachment(latest!).contenders.map((c) => c.rank)).toEqual([1, 2]);
    expect(attachment(latest!).contenders[0]?.player?.lastName).toBe("Racer");
    expect(attachment(latest!).contenders[0]?.player?.firstName).toBe("Ada");

    // On Sunday itself the week is not over yet.
    const sunday = racePosts(withDate(played, "2026-10-25"));
    expect(sunday.some((p) => attachment(p).throughDate === "2026-10-25")).toBe(
      false,
    );
    expect(sunday.some((p) => attachment(p).throughDate === "2026-10-18")).toBe(
      true,
    );
  });

  it("posts nothing before anyone has enough games", () => {
    const { state, teamA, teamB } = setup();
    // Eight games by Oct 12: below the ten a race needs.
    const played = season(state, teamA, teamB, 1, 8, () => ({
      a: STAR,
      b: ROLE,
    }));
    expect(racePosts(withDate(played, "2026-10-12"))).toEqual([]);
  });

  it("opens the race sooner in a short season (minimums scale)", () => {
    const { state, teamA, teamB } = setup();
    // A 22-game season needs 3 games (10 scaled), so eight games qualify.
    const played = season(
      withSeasonLength(state, 22),
      teamA,
      teamB,
      1,
      8,
      () => ({ a: STAR, b: ROLE }),
    );
    expect(racePosts(withDate(played, "2026-10-12")).length).toBeGreaterThan(0);
  });

  it("keeps only the latest awardRaceWeeks weeks", () => {
    const { state, teamA, teamB } = setup();
    const played = season(state, teamA, teamB, 1, 60, () => ({
      a: STAR,
      b: ROLE,
    }));
    const posts = racePosts(played);
    expect(posts.map((p) => attachment(p).throughDate).sort()).toEqual([
      "2026-11-08",
      "2026-11-15",
      "2026-11-22",
      "2026-11-29",
    ]);
  });

  it("sets previousLeaderName only when the leader changed", () => {
    const { state, teamA, teamB } = setup();
    // A dominates through Nov 1, then B takes over by a wide margin.
    const flipped = season(state, teamA, teamB, 1, 60, (day) =>
      day <= 31
        ? { a: STAR, b: ROLE }
        : {
            a: { points: 4, assists: 0, rebounds: 1 },
            b: { points: 55, assists: 14, rebounds: 16 },
          },
    );
    const posts = racePosts(flipped).sort((x, y) =>
      attachment(x).throughDate.localeCompare(attachment(y).throughDate),
    );
    const leaders = posts.map(
      (p) => attachment(p).contenders[0]?.player?.firstName,
    );
    const names = posts.map((p) => attachment(p).previousLeaderName);
    expect(leaders[0]).toBe("Ada");
    expect(names[0]).toBeNull();
    const flipIndex = leaders.findIndex((l) => l === "Bo");
    expect(flipIndex).toBeGreaterThan(0);
    expect(names[flipIndex]).toBe("Ada Racer");
    for (let i = 0; i < names.length; i += 1) {
      if (i !== flipIndex) expect(names[i]).toBeNull();
    }
  });

  it("posts nothing for playoff games or weeks after the regular season", () => {
    const { state, teamA, teamB } = setup();
    const playoffsOnly = season(
      state,
      teamA,
      teamB,
      1,
      40,
      () => ({ a: STAR, b: ROLE }),
      "playoffs",
    );
    expect(racePosts(playoffsOnly)).toEqual([]);

    // Regular season ends Oct 21 (day 20); later Sundays get no race.
    const ended = season(state, teamA, teamB, 1, 20, () => ({
      a: STAR,
      b: ROLE,
    }));
    const afterSeason = withDate(
      {
        ...ended,
        competition: {
          ...ended.competition,
          season: { ...ended.competition.season, phase: "playoffs" },
        },
      },
      "2026-11-20",
    );
    const dates = racePosts(afterSeason).map((p) => attachment(p).throughDate);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((d) => d <= "2026-10-21")).toBe(true);
  });
});
