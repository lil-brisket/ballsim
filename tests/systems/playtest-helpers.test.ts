import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { generateDraftProspects } from "@/systems/draft/draft-prospects";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft/draft-order";
import { salaryForPlayer } from "@/systems/salary-scale";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { toDashboardSnapshot } from "@/state/selectors";
import { resolveHistoryHubTab } from "@/state/history-hub-selectors";

describe("playtest talent and board helpers", () => {
  it("scales late-round draft quality below lottery quality on average", () => {
    const bootstrapped = bootstrapWorld(
      createTestGameState({ saveId: "draft_bands", rngSeed: 99 }),
      createSeededRng(99),
    ).state;
    const year = bootstrapped.competition.season.year;
    const draftYear = draftYearForSeason(year);
    const prospects = generateDraftProspects(
      bootstrapped,
      createSeededRng(99),
      draftClassIdFor(draftYear),
      draftYear,
    );
    const ranked = Object.values(prospects).sort(
      (a, b) => a.ranking - b.ranking,
    );
    const early = ranked.filter((p) => p.ranking <= 14);
    const late = ranked.filter((p) => p.ranking >= 46 && p.ranking <= 60);
    if (early.length === 0 || late.length === 0) {
      expect(ranked.length).toBeGreaterThan(0);
      return;
    }
    const mean = (
      items: typeof ranked,
      pick: (p: (typeof ranked)[number]) => number,
    ) => items.reduce((sum, item) => sum + pick(item), 0) / items.length;
    expect(mean(late, (p) => p.player.potential.overall)).toBeLessThan(
      mean(early, (p) => p.player.potential.overall),
    );
  });

  it("shows unranked standings at 0-0", () => {
    const state = createTestGameState({ saveId: "rank_zero" });
    const snapshot = toDashboardSnapshot(state);
    expect(snapshot.controlledStanding.wins).toBe(0);
    expect(snapshot.controlledStanding.losses).toBe(0);
    expect(snapshot.standingsRank).toBeNull();
  });

  it("defaults awards hub to history when current season has no winners", () => {
    const state = createTestGameState({ saveId: "awards_empty" });
    expect(resolveHistoryHubTab(state, "awards", {})).toBe("awards");
  });

  it("prices a 90+ FA far above the old $8M cap", () => {
    const state = createTestGameState({ saveId: "salary_star" });
    const cap = getLeagueSalaryCap(state);
    const salary = salaryForPlayer({
      overall: 91,
      age: 27,
      years: 6,
      cap,
      kind: "fa",
    });
    expect(salary).toBeGreaterThan(8_000_000);
    const rookie = salaryForPlayer({
      overall: 91,
      age: 21,
      years: 0,
      cap,
      kind: "rookie",
    });
    expect(rookie).toBeLessThan(salary);
  });
});
