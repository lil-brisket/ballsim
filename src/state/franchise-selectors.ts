import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
  type FranchiseOps,
} from "@/domain/entities/franchise-ops";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import type { RelocationProcess } from "@/domain/entities/relocation";
import type { ExpansionState } from "@/domain/entities/expansion";
import type { Sponsorship } from "@/domain/entities/sponsorship";
import type { Staff } from "@/domain/entities/staff";
import {
  getStaffContractSalaryForYear,
  isStaffContractActive,
} from "@/domain/entities/staff-contract";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import { arenaCapacity } from "@/systems/facilities";
import { facilityUpgradeCost } from "@/systems/facilities-config";

export type StaffMemberView = {
  staffId: string;
  firstName: string;
  lastName: string;
  role: string;
  quality: number;
  experience: number;
  strengths: string[];
  weaknesses: string[];
  employed: boolean;
  annualSalary: number | null;
  contractEndYear: number | null;
};

export type FacilityRowView = {
  category: FacilityCategory;
  level: number;
  upgradeWeeksRemaining: number;
  upgradeCost: number | null;
};

export type FranchiseBusinessView = {
  ticketPrice: number;
  fanSentiment: number;
  mediaAttention: number;
  marketSize: number;
  awareness: number;
  marketingBudget: number;
  reputation: number;
  franchiseValue: number;
  arenaCapacity: number;
  aiProfile: string;
};

export type SponsorshipView = {
  id: string;
  sponsorName: string;
  annualValue: number;
  startYear: number;
  endYear: number;
  status: string;
  reputationFloor: number;
  playoffBonus: number;
};

export type FranchiseHistoryView = {
  seasons: FranchiseSeasonRecord[];
};

export function toStaffView(state: GameState): {
  roster: StaffMemberView[];
  available: StaffMemberView[];
} {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const roster: StaffMemberView[] = [];
  const available: StaffMemberView[] = [];

  for (const staff of Object.values(state.world.staff)) {
    const view = toStaffMemberView(state, staff, year);
    if (staff.teamId === teamId) {
      roster.push(view);
    } else if (staff.teamId === null) {
      available.push(view);
    }
  }

  roster.sort((a, b) => a.role.localeCompare(b.role));
  available.sort((a, b) => a.role.localeCompare(b.role) || b.quality - a.quality);
  return { roster, available };
}

function toStaffMemberView(
  state: GameState,
  staff: Staff,
  year: number,
): StaffMemberView {
  const contract = Object.values(state.business.staffContracts).find(
    (c) =>
      c.staffId === staff.id &&
      (staff.teamId === null || c.teamId === staff.teamId) &&
      isStaffContractActive(c, year),
  );
  return {
    staffId: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    quality: staff.quality,
    experience: staff.experience,
    strengths: [...staff.strengths],
    weaknesses: [...staff.weaknesses],
    employed: staff.teamId !== null,
    annualSalary: contract
      ? (getStaffContractSalaryForYear(contract, year) ?? null)
      : null,
    contractEndYear: contract?.endYear ?? null,
  };
}

export function toFacilitiesView(state: GameState): FacilityRowView[] {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return [];
  }
  return FACILITY_CATEGORIES.map((category) => {
    const facility = ops.facilities[category];
    const upgradeCost =
      facility.level < 5 && facility.upgradeWeeksRemaining === 0
        ? facilityUpgradeCost(category, facility.level)
        : null;
    return {
      category,
      level: facility.level,
      upgradeWeeksRemaining: facility.upgradeWeeksRemaining,
      upgradeCost,
    };
  });
}

export function toFranchiseBusinessView(state: GameState): FranchiseBusinessView {
  const teamId = state.user.controlledTeamId;
  const ops = requireOps(state, teamId);
  const team = state.world.teams[teamId]!;
  return {
    ticketPrice: ops.ticketPrice,
    fanSentiment: ops.fanSentiment,
    mediaAttention: ops.mediaAttention,
    marketSize: ops.marketSize,
    awareness: ops.marketing.awareness,
    marketingBudget: ops.marketing.budget,
    reputation: team.reputation,
    franchiseValue: calculateFranchiseValue(state, teamId),
    arenaCapacity: arenaCapacity(state, teamId),
    aiProfile: ops.aiProfile,
  };
}

export function toSponsorshipsView(state: GameState): SponsorshipView[] {
  const teamId = state.user.controlledTeamId;
  return Object.values(state.business.sponsorships)
    .filter((s) => s.teamId === teamId)
    .map((s: Sponsorship) => ({
      id: s.id,
      sponsorName: s.sponsorName,
      annualValue: s.annualValue,
      startYear: s.startYear,
      endYear: s.endYear,
      status: s.status,
      reputationFloor: s.reputationFloor,
      playoffBonus: s.playoffBonus,
    }))
    .sort((a, b) => b.endYear - a.endYear);
}

export function toLeagueEconomyView(state: GameState): LeagueEconomy {
  return { ...state.business.leagueEconomy };
}

export function toRelocationView(state: GameState): RelocationProcess {
  const teamId = state.user.controlledTeamId;
  return (
    state.business.relocationByTeamId[teamId] ?? {
      teamId,
      stage: "none",
      target: null,
      cooldownSeasonsRemaining: 0,
      fee: 0,
    }
  );
}

export function toExpansionView(state: GameState): ExpansionState {
  return { ...state.business.expansion, candidates: [...state.business.expansion.candidates] };
}

export function toFranchiseHistoryView(state: GameState): FranchiseHistoryView {
  const teamId = state.user.controlledTeamId;
  const history = state.business.franchiseHistory[teamId];
  return { seasons: history ? [...history.seasons] : [] };
}

function requireOps(state: GameState, teamId: string): FranchiseOps {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`franchiseOps missing for "${teamId}".`);
  }
  return ops;
}
