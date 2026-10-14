import "server-only";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { toDashboardSnapshot } from "@/state/selectors";
import { hireStaff } from "@/systems/staff";
import { asStaffId, asStaffOfferId, asSponsorshipId } from "@/domain/ids";
import {
  fireStaffWithBuyout,
  renewStaffContract,
} from "@/systems/staff-contract-lifecycle";
import {
  makeStaffOffer,
  negotiateStaffOffer,
  acceptStaffOffer,
} from "@/systems/staff-free-agency";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import { startFacilityUpgrade } from "@/systems/facilities";
import { recordOwnershipEvidence } from "@/systems/ownership-confidence-engine";
import {
  scoreFacilityUpgrade,
  scoreMarketingBudgetChange,
} from "@/systems/ownership-alignment-signals";
import { setTicketPrice } from "@/systems/ticket-pricing";
import { setMarketingBudget } from "@/systems/marketing";
import { signSponsorship } from "@/systems/sponsorships";
import {
  isRelocationAccessible,
  isOffseasonPeriod,
} from "@/state/owner-season-context";
import { assessRelocation } from "@/state/relocation-assessment";
import type { RelocationTarget } from "@/domain/entities/relocation";
import { advanceRelocationStage, cancelRelocation } from "@/systems/relocation";
import { assessExpansion } from "@/state/expansion-assessment";
import {
  pickExpansionDivisionId,
  proposeExpansion,
  approveExpansion,
  runExpansionDraft,
  completeExpansion,
} from "@/systems/expansion";
import { EXPANSION_FEE_DEFAULT } from "@/systems/expansion-config";
import type {
  CreateGameResult,
  OwnerCommandResult,
} from "@/application/game-service/types";
import {
  getStore,
  toSaveSummary,
  runOwnerFranchiseCommand,
} from "@/application/game-service/internal";

export async function loadOwnerStaffDetail(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<
  (CreateGameResult & { staff: import("@/domain/entities/staff").Staff }) | null
> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const staff = loaded.state.world.staff[staffId];
  if (!staff) {
    return null;
  }
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    staff,
  };
}

export async function hireOwnerStaff(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      hireStaff(state, state.user.activeOwnerTeamId, asStaffId(staffId)),
    store,
  );
}

export async function fireOwnerStaff(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      fireStaffWithBuyout(
        state,
        state.user.activeOwnerTeamId,
        asStaffId(staffId),
      ),
    store,
  );
}

export async function renewOwnerStaffContract(
  saveId: string,
  staffId: string,
  years: number,
  annualSalary: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      renewStaffContract(
        state,
        state.user.activeOwnerTeamId,
        asStaffId(staffId),
        {
          years,
          annualSalary,
        },
      ),
    store,
  );
}

export async function makeOwnerStaffOffer(
  saveId: string,
  staffId: string,
  annualSalary: number,
  years: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) =>
      makeStaffOffer(state, {
        staffId: asStaffId(staffId),
        teamId: state.user.activeOwnerTeamId,
        annualSalary,
        years,
      }),
    store,
  );
}

export async function negotiateOwnerStaffOffer(
  saveId: string,
  offerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => negotiateStaffOffer(state, asStaffOfferId(offerId)),
    store,
  );
}

export async function acceptOwnerStaffOffer(
  saveId: string,
  offerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => acceptStaffOffer(state, asStaffOfferId(offerId)),
    store,
  );
}

export async function upgradeOwnerFacility(
  saveId: string,
  category: FacilityCategory,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => {
      const result = startFacilityUpgrade(
        state,
        state.user.activeOwnerTeamId,
        category,
      );
      return {
        state: recordOwnershipEvidence(
          result.state,
          scoreFacilityUpgrade(state, category),
        ),
        events: result.events,
      };
    },
    store,
  );
}

export async function setOwnerTicketPrice(
  saveId: string,
  ticketPrice: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => setTicketPrice(state, state.user.activeOwnerTeamId, ticketPrice),
    store,
  );
}

export async function setOwnerMarketingBudget(
  saveId: string,
  budget: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => {
      const teamId = state.user.activeOwnerTeamId;
      const previous =
        state.business.franchiseOps[teamId]?.marketing.budget ?? 0;
      const result = setMarketingBudget(state, teamId, budget);
      return {
        state: recordOwnershipEvidence(
          result.state,
          scoreMarketingBudgetChange(state, previous, budget),
        ),
        events: result.events,
      };
    },
    store,
  );
}

export async function signOwnerSponsorship(
  saveId: string,
  input: {
    sponsorName: string;
    annualValue: number;
    years: number;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => {
      const year = state.competition.season.year;
      const teamId = state.user.activeOwnerTeamId;
      return signSponsorship(state, teamId, {
        id: asSponsorshipId(`sponsor_${teamId}_${year}_${input.sponsorName}`),
        sponsorName: input.sponsorName,
        annualValue: input.annualValue,
        startYear: year,
        endYear: year + Math.max(1, input.years) - 1,
        reputationFloor: 30,
        playoffBonus: Math.round(input.annualValue * 0.1),
      });
    },
    store,
  );
}

export async function advanceOwnerRelocation(
  saveId: string,
  targetJson?: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => {
      const teamId = state.user.activeOwnerTeamId;
      const process = state.business.relocationByTeamId[teamId];
      const starting = process === undefined || process.stage === "none";
      if (starting) {
        if (!isRelocationAccessible(state, teamId)) {
          if (!isOffseasonPeriod(state)) {
            throw new Error(
              "Relocation can only be started during the offseason.",
            );
          }
          const assessment = assessRelocation(state, teamId);
          throw new Error(
            assessment.status === "blocked_tenure"
              ? "Relocation is blocked by franchise tenure or cooldown."
              : "Relocation is not a relevant strategic option for this franchise right now.",
          );
        }
      }
      const target = targetJson
        ? (JSON.parse(targetJson) as RelocationTarget)
        : undefined;
      return advanceRelocationStage(state, teamId, target);
    },
    store,
  );
}

export async function cancelOwnerRelocation(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => cancelRelocation(state, state.user.activeOwnerTeamId),
    store,
  );
}

export async function proposeOwnerExpansion(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => {
      const phase = state.competition.season.phase;
      if (phase !== "offseason" && phase !== "postseason") {
        throw new Error(
          "Expansion can only be proposed during Season Review or the offseason.",
        );
      }
      const assessment = assessExpansion(state);
      if (!assessment.canPropose || assessment.status === "in_progress") {
        if (assessment.status === "in_progress") {
          throw new Error("Expansion is already in progress.");
        }
        throw new Error(
          assessment.summaryReasons[0] ??
            "Expansion is not available given league readiness, markets, or capacity.",
        );
      }
      const divisionId = pickExpansionDivisionId(state);
      const division = state.world.divisions[divisionId]!;
      const destinations = assessment.marketOpportunity.destinations.slice(
        0,
        4,
      );
      if (destinations.length === 0) {
        throw new Error(
          "proposeOwnerExpansion: no expansion markets available.",
        );
      }
      return proposeExpansion(
        state,
        destinations.map((destination) => ({
          city: destination.city,
          name: destination.name,
          abbreviation: destination.abbreviation,
          marketSize: destination.marketSize,
          conferenceId: division.conferenceId,
          divisionId: division.id,
        })),
        EXPANSION_FEE_DEFAULT,
      );
    },
    store,
  );
}

export async function approveOwnerExpansion(
  saveId: string,
  candidateIndex: number,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state) => approveExpansion(state, candidateIndex),
    store,
  );
}

export async function runOwnerExpansionDraft(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state, rng) => runExpansionDraft(state, rng),
    store,
  );
}

export async function completeOwnerExpansion(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runOwnerFranchiseCommand(
    saveId,
    (state, rng) => {
      const phase = state.competition.season.phase;
      if (phase !== "offseason" && phase !== "postseason") {
        throw new Error(
          "Expansion can only be completed during Season Review or the offseason.",
        );
      }
      return completeExpansion(state, rng);
    },
    store,
  );
}
