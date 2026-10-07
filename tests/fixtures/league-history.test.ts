import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { YEARLY_AWARD_IDS } from "@/systems/awards/award-definitions";

type FixtureSeason = {
  seasonYear: number;
  standings: unknown[];
  playoffs: {
    status: string;
    fieldSize: number;
    championTeamId?: string;
  };
  awards: Array<{ awardId: string; period: string | null }>;
};

type LeagueHistoryFixture = {
  meta: {
    seed: number;
    seasons: number;
    fidelity: string;
    skipOwnerGameplay: boolean;
    teamCount: number;
    gamesPerTeam: number;
    playoffTeams: number;
  };
  teams: unknown[];
  seasons: FixtureSeason[];
};

const fixture = JSON.parse(
  readFileSync("tests/fixtures/league-history.json", "utf8"),
) as LeagueHistoryFixture;

describe("league-history fixture", () => {
  it("contains 10 Standard seasons of standings, completed brackets, and yearly awards", () => {
    expect(fixture.meta.seed).toBe(42);
    expect(fixture.meta.seasons).toBe(10);
    expect(fixture.meta.fidelity).toBe("box_score");
    expect(fixture.meta.skipOwnerGameplay).toBe(true);
    expect(fixture.meta.teamCount).toBe(30);
    expect(fixture.meta.gamesPerTeam).toBe(82);
    expect(fixture.meta.playoffTeams).toBe(16);
    expect(fixture.teams).toHaveLength(30);
    expect(fixture.seasons).toHaveLength(10);

    for (const season of fixture.seasons) {
      expect(season.standings).toHaveLength(30);
      expect(season.playoffs.status).toBe("complete");
      expect(season.playoffs.fieldSize).toBe(16);
      expect(season.playoffs.championTeamId).toBeTruthy();

      const yearlyIds = new Set(
        season.awards
          .filter((award) => award.period === null)
          .map((award) => award.awardId),
      );
      for (const awardId of YEARLY_AWARD_IDS) {
        if (awardId === "most_improved") {
          continue;
        }
        expect(yearlyIds.has(awardId)).toBe(true);
      }
    }
  });
});
