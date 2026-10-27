import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import type {
  AwardCandidateResult,
  AwardDefinitionId,
  AwardResult,
} from "@/domain/entities/awards";
import type { GameState } from "@/state/game-state";
import { toAwardsNightView } from "@/state/awards-night-selectors";
import { toDashboardMomentsView } from "@/state/dashboard-moments";
import { getPlayerIdentity } from "@/state/player-identity";
import { createTestGameState } from "../factories/game-state";

const base = bootstrapWorld(
  createTestGameState({ saveId: "awards_night" }),
  createSeededRng("awards-night"),
).state;
const userTeamId = base.user.activeOwnerTeamId as string;
const otherTeamId = Object.keys(base.world.teams).find(
  (id) => id !== userTeamId,
) as string;
const userPlayers = base.world.teams[userTeamId]!.roster.map(String);
const otherPlayers = base.world.teams[otherTeamId]!.roster.map(String);
const coachId = Object.keys(base.world.coaches)[0] as string;

type Row = [subjectId: string, teamId: string, rank: number, score: number];
type Phase = GameState["competition"]["season"]["phase"];

function result(
  awardId: AwardDefinitionId,
  rows: Row[],
  options: { year?: number; yearly?: boolean; noSnapshot?: boolean } = {},
): AwardResult {
  const year = options.year ?? 2027;
  const yearly = options.yearly ?? true;
  const winner = rows[0]!;
  const coach = awardId === "coach_of_year";
  return {
    id: `award:l:${year}:${yearly ? "yearly" : "2027-01"}:${awardId}`,
    awardId,
    cadence: yearly ? "yearly" : "monthly",
    leagueId: "l",
    seasonId: "s",
    seasonYear: year,
    period: yearly ? null : "2027-01",
    winner: {
      subjectType: coach ? "coach" : "player",
      subjectId: winner[0],
      teamId: winner[1],
    },
    candidates: rows.map(([subjectId, teamId, rank, score]) => ({
      subjectId,
      teamId,
      rank,
      score,
    })) as AwardCandidateResult[],
    context: {
      winnerScore: winner[3],
      breakdown: {},
      metricVersion: 1,
      statSnapshot: options.noSnapshot
        ? undefined
        : {
            games: 70,
            minutes: 2000,
            perGame: {
              points: 24.14,
              rebounds: 7.2,
              assists: 5,
              steals: 1.8,
              blocks: 2.34,
              turnovers: 2,
              minutes: 33,
            },
            teamRecord: { wins: 52, losses: 30, winPct: 0.634 },
          },
    },
  } as unknown as AwardResult;
}

function withAwards(
  results: AwardResult[],
  overrides: { year?: number; phase?: Phase } = {},
): GameState {
  return {
    ...base,
    business: {
      ...base.business,
      awards: { results: Object.fromEntries(results.map((r) => [r.id, r])) },
    },
    competition: {
      ...base.competition,
      season: {
        ...base.competition.season,
        year: overrides.year ?? 2027,
        phase: overrides.phase ?? "postseason",
      },
    },
  };
}

const simple = (id: AwardDefinitionId, year = 2027) =>
  result(
    id,
    id === "coach_of_year"
      ? [
          [coachId, otherTeamId, 1, 9],
          ["c2", otherTeamId, 2, 8],
        ]
      : [
          [otherPlayers[0]!, otherTeamId, 1, 9],
          [otherPlayers[1]!, otherTeamId, 2, 8],
        ],
    { year },
  );

const ALL: AwardDefinitionId[] = [
  "mvp",
  "dpoy",
  "roy",
  "sixth_man",
  "most_improved",
  "coach_of_year",
];

describe("toAwardsNightView", () => {
  it("orders awards smallest to biggest with MVP last", () => {
    const view = toAwardsNightView(withAwards(ALL.map((id) => simple(id))))!;
    expect(view.awards.map((a) => a.awardId)).toEqual([
      "coach_of_year",
      "most_improved",
      "sixth_man",
      "roy",
      "dpoy",
      "mvp",
    ]);
    expect(view.awards[0]!.displayName).toBeTruthy();
  });

  it("skips awards that were not given", () => {
    const view = toAwardsNightView(
      withAwards([simple("mvp"), simple("coach_of_year")]),
    )!;
    expect(view.awards.map((a) => a.awardId)).toEqual(["coach_of_year", "mvp"]);
  });

  it("excludes monthly awards", () => {
    const monthly = result(
      "player_of_month",
      [[otherPlayers[0]!, otherTeamId, 1, 5]],
      { yearly: false },
    );
    const state = withAwards([monthly, simple("mvp")]);
    expect(toAwardsNightView(state)!.awards.map((a) => a.awardId)).toEqual([
      "mvp",
    ]);
    expect(toAwardsNightView(withAwards([monthly]))).toBeNull();
  });

  it("excludes midseason awards", () => {
    const mid = result("midseason_mvp", [
      [otherPlayers[0]!, otherTeamId, 1, 5],
    ]);
    expect(toAwardsNightView(withAwards([mid]))).toBeNull();
  });

  it("returns the top three finalists, with T-n labels for ties", () => {
    const mvp = result("mvp", [
      [otherPlayers[0]!, otherTeamId, 1, 9],
      [otherPlayers[2]!, otherTeamId, 2, 8],
      [otherPlayers[1]!, otherTeamId, 2, 8],
      [otherPlayers[3]!, otherTeamId, 4, 7],
      [otherPlayers[4]!, otherTeamId, 5, 6],
    ]);
    const award = toAwardsNightView(withAwards([mvp]))!.awards[0]!;
    expect(award.finalists).toHaveLength(3);
    expect(award.finalists.map((f) => f.rankLabel)).toEqual([
      "1",
      "T-2",
      "T-2",
    ]);
    expect(award.finalists.map((f) => f.subjectId)).toEqual([
      otherPlayers[0],
      ...[otherPlayers[1]!, otherPlayers[2]!].sort(),
    ]);
    expect(award.finalists[0]!.name).toBe(
      getPlayerIdentity(base, otherPlayers[0]!)?.displayName,
    );
    expect(award.finalists[0]!.teamAbbreviation).toBe(
      base.world.teams[otherTeamId]!.abbreviation,
    );
  });

  it("flags a tie-break only when the winner's score equals the next", () => {
    const tied = result("mvp", [
      [otherPlayers[0]!, otherTeamId, 1, 9],
      [otherPlayers[1]!, otherTeamId, 2, 9],
    ]);
    expect(
      toAwardsNightView(withAwards([tied]))!.awards[0]!.winner.tieBreak,
    ).toBe(true);
    expect(
      toAwardsNightView(withAwards([simple("mvp")]))!.awards[0]!.winner
        .tieBreak,
    ).toBe(false);
  });

  it("formats stat lines per award type", () => {
    const state = withAwards(ALL.map((id) => simple(id)));
    const byId = Object.fromEntries(
      toAwardsNightView(state)!.awards.map((a) => [
        a.awardId,
        a.winner.statLine,
      ]),
    );
    const offense = "70 GP · 24.1 PTS · 7.2 REB · 5.0 AST";
    expect(byId.mvp).toBe(offense);
    expect(byId.roy).toBe(offense);
    expect(byId.sixth_man).toBe(offense);
    expect(byId.most_improved).toBe(offense);
    expect(byId.dpoy).toBe("70 GP · 1.8 STL · 2.3 BLK · 7.2 REB");
    expect(byId.coach_of_year).toBe("52–30");
  });

  it("has an empty stat line without a snapshot", () => {
    const noSnap = result("mvp", [[otherPlayers[0]!, otherTeamId, 1, 9]], {
      noSnapshot: true,
    });
    expect(
      toAwardsNightView(withAwards([noSnap]))!.awards[0]!.winner.statLine,
    ).toBe("");
  });

  it("resolves coach names and gives coaches no portrait", () => {
    const award = toAwardsNightView(withAwards([simple("coach_of_year")]))!
      .awards[0]!;
    const coach = base.world.coaches[coachId]!;
    expect(award.winner.name).toBe(`${coach.firstName} ${coach.lastName}`);
    expect(award.subjectType).toBe("coach");
    expect(award.winner.portrait).toBeNull();
  });

  it("marks the user's team and counts user winners", () => {
    const userMvp = result("mvp", [
      [userPlayers[0]!, userTeamId, 1, 9],
      [otherPlayers[0]!, otherTeamId, 2, 8],
    ]);
    const view = toAwardsNightView(
      withAwards([userMvp, simple("dpoy"), simple("roy")]),
    )!;
    const mvp = view.awards.find((a) => a.awardId === "mvp")!;
    expect(mvp.userWon).toBe(true);
    expect(mvp.winner.isUserTeam).toBe(true);
    expect(mvp.finalists.map((f) => f.isUserTeam)).toEqual([true, false]);
    expect(view.awards.find((a) => a.awardId === "dpoy")!.userWon).toBe(false);
    expect(view.userWinners).toBe(1);
  });

  it("defaults to the latest season with awards, or takes a year", () => {
    const state = withAwards([simple("mvp", 2026), simple("dpoy", 2027)]);
    expect(toAwardsNightView(state)!.seasonYear).toBe(2027);
    expect(toAwardsNightView(state)!.awards.map((a) => a.awardId)).toEqual([
      "dpoy",
    ]);
    const old = toAwardsNightView(state, 2026)!;
    expect(old.seasonYear).toBe(2026);
    expect(old.awards.map((a) => a.awardId)).toEqual(["mvp"]);
    expect(toAwardsNightView(state, 2020)).toBeNull();
  });

  it("is null with no awards", () => {
    expect(toAwardsNightView(withAwards([]))).toBeNull();
  });

  it("is current only for this season's playoffs, postseason or offseason", () => {
    const awards = [simple("mvp")];
    const current = (phase: Phase, year = 2027) =>
      toAwardsNightView(withAwards(awards, { phase, year }), 2027)!.isCurrent;
    expect(current("playoffs")).toBe(true);
    expect(current("postseason")).toBe(true);
    expect(current("offseason")).toBe(true);
    expect(current("regular")).toBe(false);
    expect(current("postseason", 2028)).toBe(false);
  });

  it("feeds the dashboard moments only when current", () => {
    expect(
      toDashboardMomentsView(withAwards([simple("mvp")])).awards?.seasonYear,
    ).toBe(2027);
    expect(
      toDashboardMomentsView(withAwards([simple("mvp")], { phase: "regular" }))
        .awards,
    ).toBeNull();
  });

  it("is pure: equal output for equal input, input unchanged", () => {
    const state = withAwards(ALL.map((id) => simple(id)));
    const before = JSON.stringify(state.business.awards);
    const first = toAwardsNightView(state);
    const second = toAwardsNightView(state);
    expect(second).toEqual(first);
    expect(JSON.stringify(state.business.awards)).toBe(before);
  });
});
