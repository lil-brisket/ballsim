import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import {
  competitiveBandFromWins,
  resolveCompetitiveExpectation,
} from "@/systems/ownership-expectations-config";
import { getDefaultOwnerMandateProfile } from "@/systems/owner-philosophy-config";
import type { TeamId } from "@/domain/ids";

function withWins(wins: number, losses = 20) {
  const state = createTestGameState();
  const teamId = state.user.activeOwnerTeamId;
  const existing = state.competition.standings.byTeamId[teamId]!;
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        ...state.competition.standings,
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: {
            ...existing,
            wins,
            losses,
            winPercentage: wins / Math.max(1, wins + losses),
          },
        },
      },
    },
  };
}

describe("ownership expectations", () => {
  it("maps win bands into competitive trajectory bands", () => {
    expect(competitiveBandFromWins(24)).toBe("collapse");
    expect(competitiveBandFromWins(32)).toBe("rebuild");
    expect(competitiveBandFromWins(40)).toBe("developing");
    expect(competitiveBandFromWins(48)).toBe("playoff_chase");
    expect(competitiveBandFromWins(55)).toBe("contender");
  });

  it("lets a win_now owner accept rebuild at low wins and contend at high wins", () => {
    expect(resolveCompetitiveExpectation("win_now", "collapse")).toBe("rebuild");
    expect(resolveCompetitiveExpectation("win_now", "developing")).toBe("develop");
    expect(resolveCompetitiveExpectation("win_now", "contender")).toBe("contend");
  });

  it("keeps build_for_the_future more development-oriented at the same win band", () => {
    expect(
      resolveCompetitiveExpectation("build_for_the_future", "playoff_chase"),
    ).toBe("develop");
    expect(resolveCompetitiveExpectation("win_now", "playoff_chase")).toBe(
      "compete",
    );
  });

  it("builds a living mandate that changes with franchise wins", () => {
    const low = buildOwnershipExpectations(
      withWins(26, 40) as ReturnType<typeof createTestGameState>,
    );
    const high = buildOwnershipExpectations(
      withWins(54, 18) as ReturnType<typeof createTestGameState>,
    );

    expect(low.competitiveExpectation).toBe("rebuild");
    expect(high.competitiveExpectation).toBe("contend");
    expect(low.mandateSummary).not.toEqual(high.mandateSummary);
    expect(high.priorityBullets.length).toBeGreaterThan(0);
  });

  it("uses the fixed default mandate profile for living expectations", () => {
    const state = createTestGameState();
    const expectations = buildOwnershipExpectations(state);
    expect(expectations.philosophy).toBe(
      getDefaultOwnerMandateProfile().philosophy,
    );
    expect(expectations.philosophy).toBe("balanced");
    expect(expectations.tolerance.payrollGrowth).toBe(0.45);
  });

  it("default mandate grows market priorities when awareness is low", () => {
    let state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId as TeamId;
    const ops = state.business.franchiseOps[teamId]!;
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...ops,
            marketing: { ...ops.marketing, awareness: 28 },
          },
        },
      },
    };
    const expectations = buildOwnershipExpectations(state);
    expect(expectations.marketExpectation).toBe("grow");
    expect(
      expectations.priorityBullets.some(
        (b) =>
          b.toLowerCase().includes("marketing") ||
          b.toLowerCase().includes("facilities"),
      ),
    ).toBe(true);
  });
});
