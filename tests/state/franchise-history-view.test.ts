import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import { asSeasonId } from "@/domain/ids";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import { toFranchiseHistoryView } from "@/state/franchise-selectors";
import { withOwnedFranchise } from "@/state/owner-context";

describe("toFranchiseHistoryView", () => {
  it("builds milestones and highlights without UI-side math", () => {
    let state = createTestGameState({ saveId: "fh_view" });
    const teamId = state.user.activeOwnerTeamId;
    const facilityLevels = {} as Record<(typeof FACILITY_CATEGORIES)[number], number>;
    for (const category of FACILITY_CATEGORIES) {
      facilityLevels[category as FacilityCategory] = 1;
    }
    state = withOwnedFranchise(
      {
        ...state,
        competition: {
          ...state.competition,
          season: {
            ...state.competition.season,
            year: 2028,
          },
        },
        business: {
          ...state.business,
          franchiseHistory: {
            ...state.business.franchiseHistory,
            [teamId]: {
              teamId,
              seasons: [
                {
                  seasonId: asSeasonId("season_2026"),
                  seasonYear: 2026,
                  wins: 50,
                  losses: 32,
                  playoffResult: "first_round",
                  championship: false,
                  revenue: 100,
                  expenses: 90,
                  netIncome: 10,
                  payroll: 80,
                  leagueRank: 5,
                  attendance: 800_000,
                businessFunds: 10,
                fanSentiment: 60,
                reputation: 60,
                facilityLevels,
                relocated: false,
                city: "A",
                name: "B",
                notableEventIds: [],
                franchiseValue: 500_000_000,
              },
              {
                seasonId: asSeasonId("season_2027"),
                seasonYear: 2027,
                wins: 55,
                losses: 27,
                playoffResult: "champion",
                championship: true,
                revenue: 120,
                expenses: 100,
                netIncome: 20,
                payroll: 90,
                leagueRank: 1,
                attendance: null,
                businessFunds: 20,
                fanSentiment: 70,
                reputation: 70,
                facilityLevels,
                relocated: false,
                city: "A",
                name: "B",
                notableEventIds: [],
                franchiseValue: 700_000_000,
              },
            ],
          },
        },
      },
    },
      teamId,
      (f) => ({ ...f, ownerStartSeasonYear: 2026 }),
    );

    const view = toFranchiseHistoryView(state);
    expect(view.ownerTenureYears).toBe(3);
    expect(view.milestones.championships).toBe(1);
    expect(view.milestones.playoffAppearances).toBe(2);
    expect(view.seasons[1]!.playoffLabel).toBe("Champion");
    expect(view.seasons[1]!.highlights).toEqual(
      expect.arrayContaining(["championship", "best_record"]),
    );
    expect(view.seasons[0]!.attendance).toBe(800_000);
    expect(view.seasons[1]!.attendance).toBeNull();
  });
});
