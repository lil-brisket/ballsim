import { describe, expect, it } from "vitest";
import { asPlayerId } from "@/domain/ids";
import {
  getPlayerAwardCareerTotals,
  getPlayerAwards,
  toLeagueAwardsView,
} from "@/state/award-selectors";
import { runYearlyAwards } from "@/systems/awards/award-pipeline";
import {
  addPlayerToState,
  createAwardsTestState,
  generatePlayerGames,
  injectGames,
  primaryTeamIds,
} from "./helpers";

describe("award selectors", () => {
  it("lists player awards with career totals and includes winner in candidates", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "star", teamA);
    state = injectGames(
      state,
      generatePlayerGames({
        playerId: "star",
        teamId: teamA,
        opponentId: teamB,
        count: 55,
        datePrefix: "2026-01",
        perGame: { points: 28, minutes: 36, rebounds: 8, assists: 7 },
      }),
    );
    state = runYearlyAwards(state).state;
    const awards = getPlayerAwards(state, asPlayerId("star"));
    expect(awards.length).toBeGreaterThan(0);
    expect(awards[0]!.teamId).toBe(teamA);

    const totals = getPlayerAwardCareerTotals(state, asPlayerId("star"));
    expect(totals.some((t) => t.count >= 1)).toBe(true);

    const league = toLeagueAwardsView(state, "save_awards");
    expect(league.rows.length).toBeGreaterThan(0);
    const mvp = league.rows.find((r) => r.result.awardId === "mvp");
    expect(mvp?.result.candidates[0]?.rank).toBe(1);
    expect(mvp?.result.candidates[0]?.subjectId).toBe(mvp?.result.winner.subjectId);
  });
});
