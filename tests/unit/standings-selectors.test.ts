import { describe, expect, it } from "vitest";
import {
  playoffCutoffPerConference,
  recentResultsByTeamId,
  toStandingsPageView,
} from "@/state/standings-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import { createTestGame } from "../factories/game";
import { asGameId } from "@/domain/ids";

const CONFERENCE_STANDARD = {
  view: "conference" as const,
  stats: "standard" as const,
};

describe("standings-selectors", () => {
  it("derives cutoff from fieldSize / conferences, not hardcoded rank 8", () => {
    let state = createTestGameState({ saveId: "standings_cutoff" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const cutoff = playoffCutoffPerConference(state);
    expect(cutoff).toBeGreaterThanOrEqual(1);

    const page = toStandingsPageView(state, CONFERENCE_STANDARD);
    expect(page.cutoffPerConference).toBe(cutoff);
    expect(page.groups.length).toBeGreaterThan(0);
    for (const group of page.groups) {
      expect(group.cutoffRank).toBeNull();
      expect(group.kind).toBe("conference");
      expect(group.rows[0]?.gamesBackConference).toBe(0);
    }
  });

  it("orders conference rows by conference rank", () => {
    let state = createTestGameState({ saveId: "standings_order" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const page = toStandingsPageView(state, CONFERENCE_STANDARD);
    for (const group of page.groups) {
      for (let i = 1; i < group.rows.length; i++) {
        expect(group.rows[i]!.conferenceRank).toBeGreaterThan(
          group.rows[i - 1]!.conferenceRank,
        );
      }
    }
  });

  it("never invents eliminated label without math elimination", () => {
    let state = createTestGameState({ saveId: "standings_elim" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const page = toStandingsPageView(state, CONFERENCE_STANDARD);
    for (const row of page.leagueRows) {
      expect(row.playoffLabel).not.toBe("eliminated");
      expect(row.playoffLabel).not.toBe("play_in");
    }
  });

  it("derives last-10 results per team, oldest first, final regular season only", () => {
    let state = createTestGameState({ saveId: "standings_recent" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const games: typeof state.competition.games = {};
    for (let i = 0; i < 12; i++) {
      const game = createTestGame({
        id: asGameId(`g_${String(i).padStart(2, "0")}`),
      });
      games[game.id] = {
        ...game,
        status: "final",
        competitionType: "regular_season",
        date: `2026-11-${String(i + 1).padStart(2, "0")}`,
        score: i === 11 ? { home: 90, away: 100 } : { home: 100, away: 90 },
      };
    }
    games["g_playoff"] = {
      ...createTestGame({ id: asGameId("g_playoff") }),
      status: "final",
      competitionType: "playoffs",
      date: "2026-12-01",
      score: { home: 1, away: 2 },
    };
    state = {
      ...state,
      competition: { ...state.competition, games },
    };
    const recent = recentResultsByTeamId(state);
    const home = recent.get("team_home");
    expect(home).toHaveLength(10);
    expect(home?.at(-1)).toBe("L");
    expect(home?.slice(0, 9).every((r) => r === "W")).toBe(true);
    expect(recent.get("team_away")?.at(-1)).toBe("W");
  });
});
