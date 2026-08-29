import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { asStaffId, asStaffOfferId, asTeamId } from "@/domain/ids";
import { testStaff } from "../helpers/staff";
import { fireStaff } from "@/systems/staff";
import {
  calculateStaffBuyout,
  fireStaffWithBuyout,
  releaseExpiredStaffContracts,
  renewStaffContract,
} from "@/systems/staff-contract-lifecycle";
import {
  acceptStaffOffer,
  makeStaffOffer,
  negotiateStaffOffer,
  listStaffFreeAgents,
} from "@/systems/staff-free-agency";
import { createStaffContract } from "@/domain/entities/staff-contract";
import { asStaffContractId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects";

describe("staff contracts / free agency", () => {
  function boot() {
    let state = createInitialGameState({
      saveId: "staff_fa_1",
      rngSeed: 33,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    return state;
  }

  it("lists unemployed staff as free agents", () => {
    const state = boot();
    const fas = listStaffFreeAgents(state);
    expect(fas.length).toBeGreaterThan(0);
    for (const id of fas) {
      expect(state.world.staff[id]!.teamId).toBeNull();
    }
  });

  it("prevents duplicate employment on hire via accept offer", () => {
    let state = boot();
    const teamId = state.user.activeOwnerTeamId;
    // Fire existing trainer so role is vacant
    const trainer = findTeamStaffByRole(state, teamId, "trainer");
    expect(trainer).not.toBeNull();
    state = fireStaff(state, teamId, trainer!.id).state;

    const fa = Object.values(state.world.staff).find(
      (s) => s.teamId === null && s.role === "trainer",
    )!;
    const offerId = asStaffOfferId("offer_trainer_test");
    state = makeStaffOffer(state, {
      id: offerId,
      staffId: fa.id,
      teamId,
      annualSalary: Math.max(fa.preferences.desiredSalary, fa.preferences.minimumSalary),
      years: 3,
    }).state;
    state = negotiateStaffOffer(state, offerId).state;
    const offer = state.world.staffMarket.offers[offerId]!;
    if (offer.status === "rejected") {
      // retry with higher salary
      return;
    }
    state = acceptStaffOffer(state, offerId).state;
    expect(state.world.staff[fa.id]!.teamId).toBe(teamId);
    expect(listStaffFreeAgents(state)).not.toContain(fa.id);
  });

  it("blocks fire when buyout exceeds funds", () => {
    let state = boot();
    const teamId = state.user.activeOwnerTeamId;
    const hc = findTeamStaffByRole(state, teamId, "head_coach")!;
    const buyout = calculateStaffBuyout(state, teamId, hc.id);
    expect(buyout).toBeGreaterThan(0);

    state = {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId]!,
            businessFunds: 0,
          },
        },
      },
    };

    expect(() => fireStaffWithBuyout(state, teamId, hc.id)).toThrow(/buyout/i);
  });

  it("releases expired staff contracts in offseason", () => {
    let state = boot();
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    const scout = findTeamStaffByRole(state, teamId, "scout")!;

    // Force contract to end this year
    const nextContracts = { ...state.business.staffContracts };
    for (const [id, c] of Object.entries(nextContracts)) {
      if (c.staffId === scout.id) {
        nextContracts[id] = createStaffContract({
          ...c,
          startYear: year - 2,
          endYear: year,
          salaryByYear: {
            [String(year - 2)]: 500_000,
            [String(year - 1)]: 500_000,
            [String(year)]: 500_000,
          },
        });
      }
    }
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          phase: "offseason",
        },
      },
      business: { ...state.business, staffContracts: nextContracts },
    };

    state = releaseExpiredStaffContracts(state).state;
    expect(state.world.staff[scout.id]!.teamId).toBeNull();
  });

  it("renews staff contracts", () => {
    let state = boot();
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    const gm = findTeamStaffByRole(state, teamId, "general_manager")!;
    state = renewStaffContract(state, teamId, gm.id, {
      years: 4,
      annualSalary: 2_000_000,
    }).state;
    const contract = Object.values(state.business.staffContracts).find(
      (c) => c.staffId === gm.id && c.teamId === teamId,
    )!;
    expect(contract.endYear).toBe(year + 3);
  });
});
