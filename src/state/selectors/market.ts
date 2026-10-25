import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import {
  type TeamBrandingView,
  toBrandingView,
} from "@/state/team-branding-view";
import type { TeamFinancialStatement } from "@/domain/entities/finances";
import type { GameState } from "@/state/game-state";
import { listFreeAgents } from "@/systems/free-agency";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import {
  getContractSalaryForYear,
  getContractStatus,
} from "@/domain/entities/contract";
import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import { draftYearForSeason } from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  getLeagueStaffBudget,
  getTeamStaffPayroll,
  getTeamStaffBudgetSpace,
} from "@/systems/staff-budget";
import {
  getContractSigningYear,
  getTeamCapSpace,
  getTeamPayroll,
} from "@/systems/salary-cap";
import { getFinancialStatement } from "@/systems/team-finances";
import { getControlledTeam } from "@/state/selectors/teams-roster";
import { getPlayerIdentity } from "@/state/player-identity";

export type FreeAgentView = {
  playerId: string;
  /** Persisted portrait (world.playerPortraits); null → initials fallback. */
  portrait: PlayerPortraitAssignment | null;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
};

export type FreeAgencyOfferView = {
  offerId: string;
  playerId: string;
  playerName: string;
  status: string;
  salary: number | null;
  years: number;
  createdOn: string;
};

export type DraftBoardView = {
  draftClassId: string;
  status: string;
  userOnClock: boolean;
  onClockPickId: string | null;
  onClockOverall: number | null;
  order: Array<{
    draftPickId: string;
    overallPick: number;
    round: number;
    ownerTeamId: string;
    ownerAbbreviation: string;
    ownerBranding: TeamBrandingView | null;
    status: string;
    selectedPlayerId: string | null;
    isUserPick: boolean;
  }>;
  ownedPicks: Array<{
    draftPickId: string;
    overallPick: number;
    round: number;
    status: string;
  }>;
  selections: Array<{
    overallPick: number;
    teamAbbreviation: string;
    teamBranding: TeamBrandingView | null;
    playerName: string;
    playerId: string;
  }>;
  eligibleProspects: Array<{
    playerId: string;
    firstName: string;
    lastName: string;
    position: string;
    /** Scout grade letter — never true overall. */
    scoutGrade: string | null;
    estimatedOverallMin: number | null;
    estimatedOverallMax: number | null;
    confidence: string | null;
    knowledgeLevel: string;
    projectedRankMin: number | null;
    projectedRankMax: number | null;
  }>;
};

export type ContractRowView = {
  contractId: string;
  playerId: string;
  playerName: string;
  position: string;
  salary: number | null;
  startYear: number;
  endYear: number;
  yearsRemaining: number;
  status: string;
  hasPendingTeamOption: boolean;
  hasPendingPlayerOption: boolean;
};

export type FinancesView = {
  businessFunds: number;
  payrollSnapshot: number;
  statement: TeamFinancialStatement;
  salaryCap: number;
  salaryCapEnabled: boolean;
  playerPayroll: number;
  capSpace: number;
  staffBudget: number;
  staffPayroll: number;
  staffBudgetSpace: number;
};

export function toFreeAgentViews(state: GameState): FreeAgentView[] {
  const { playerIds } = listFreeAgents(state);
  const views: FreeAgentView[] = [];
  for (const playerId of playerIds) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    views.push({
      playerId: player.id,
      portrait: selectPlayerPortrait(state, player.id),
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
    });
  }
  views.sort((a, b) => b.overall - a.overall);
  return views;
}

export function toFreeAgencyOfferViews(
  state: GameState,
): FreeAgencyOfferView[] {
  const teamId = state.user.activeOwnerTeamId;
  const views: FreeAgencyOfferView[] = [];
  for (const offer of Object.values(state.business.freeAgency.offers)) {
    if (offer.teamId !== teamId) {
      continue;
    }
    const player = state.world.players[offer.playerId];
    const salary =
      getContractSalaryForYear(offer.terms, offer.terms.startYear) ?? null;
    views.push({
      offerId: offer.id,
      playerId: offer.playerId,
      playerName: player
        ? `${player.firstName} ${player.lastName}`
        : offer.playerId,
      status: offer.status,
      salary,
      years: offer.terms.endYear - offer.terms.startYear + 1,
      createdOn: offer.createdOn,
    });
  }
  views.sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  return views;
}

export function toOpenFreeAgencyOfferViews(
  state: GameState,
): FreeAgencyOfferView[] {
  const teamId = state.user.activeOwnerTeamId;
  const views: FreeAgencyOfferView[] = [];
  for (const offer of Object.values(state.business.freeAgency.offers)) {
    if (offer.teamId !== teamId || !isOpenOffer(offer.status)) {
      continue;
    }
    const player = state.world.players[offer.playerId];
    const salary =
      getContractSalaryForYear(offer.terms, offer.terms.startYear) ?? null;
    views.push({
      offerId: offer.id,
      playerId: offer.playerId,
      playerName: player
        ? `${player.firstName} ${player.lastName}`
        : offer.playerId,
      status: offer.status,
      salary,
      years: offer.terms.endYear - offer.terms.startYear + 1,
      createdOn: offer.createdOn,
    });
  }
  views.sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  return views;
}

export function toDraftBoardView(state: GameState): DraftBoardView | null {
  if (
    state.competition.season.phase !== "offseason" ||
    state.competition.season.offseasonStage !== "draft"
  ) {
    return null;
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined) {
    return null;
  }
  const userTeamId = state.user.activeOwnerTeamId;
  const teamState = draft.teamDraftState[userTeamId];
  const onClock = draft.order.find((slot) => slot.status === "available");
  const eligibleProspects = Object.values(draft.prospects)
    .filter((prospect) => prospect.status === "eligible")
    .map((prospect) => {
      const estimate = teamState?.scouting.find(
        (report) => report.prospectPlayerId === prospect.playerId,
      );
      return {
        playerId: prospect.playerId,
        firstName: prospect.player.firstName,
        lastName: prospect.player.lastName,
        position: estimate?.positionEstimate ?? prospect.player.position,
        scoutGrade: estimate?.scoutGrade ?? null,
        estimatedOverallMin: estimate?.estimatedOverall.min ?? null,
        estimatedOverallMax: estimate?.estimatedOverall.max ?? null,
        confidence: estimate?.confidence ?? null,
        knowledgeLevel: estimate?.knowledgeLevel ?? "unknown",
        projectedRankMin: estimate?.projectedRank.min ?? null,
        projectedRankMax: estimate?.projectedRank.max ?? null,
      };
    })
    .sort((a, b) => {
      const midA =
        a.estimatedOverallMin != null && a.estimatedOverallMax != null
          ? (a.estimatedOverallMin + a.estimatedOverallMax) / 2
          : -1;
      const midB =
        b.estimatedOverallMin != null && b.estimatedOverallMax != null
          ? (b.estimatedOverallMin + b.estimatedOverallMax) / 2
          : -1;
      if (midA !== midB) return midB - midA;
      return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
    });

  const order = draft.order.map((slot) => {
    const owner = state.world.teams[slot.ownerTeamId];
    return {
      draftPickId: slot.draftPickId,
      overallPick: slot.overallPick,
      round: slot.round,
      ownerTeamId: slot.ownerTeamId,
      ownerAbbreviation: owner?.abbreviation ?? "???",
      ownerBranding: toBrandingView(owner?.branding),
      status: slot.status,
      selectedPlayerId: slot.selectedPlayerId ?? null,
      isUserPick: slot.ownerTeamId === userTeamId,
    };
  });

  return {
    draftClassId: draft.id,
    status: draft.status,
    userOnClock: isUserOnDraftClock(state),
    onClockPickId: onClock?.draftPickId ?? null,
    onClockOverall: onClock?.overallPick ?? null,
    order,
    ownedPicks: order.filter((slot) => slot.isUserPick),
    selections: draft.selections.map((selection) => {
      const team = state.world.teams[selection.teamId];
      const player =
        state.world.players[selection.playerId] ??
        draft.prospects[selection.playerId]?.player;
      return {
        overallPick: selection.overallPick,
        teamAbbreviation: team?.abbreviation ?? "???",
        teamBranding: toBrandingView(team?.branding),
        playerName: player
          ? `${player.firstName} ${player.lastName}`
          : selection.playerId,
        playerId: selection.playerId,
      };
    }),
    eligibleProspects,
  };
}

export function toContractsView(state: GameState): ContractRowView[] {
  const teamId = state.user.activeOwnerTeamId;
  const year = state.competition.season.year;
  const rows: ContractRowView[] = [];
  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    const player = state.world.players[contract.playerId];
    rows.push({
      contractId: contract.id,
      playerId: contract.playerId,
      playerName:
        getPlayerIdentity(state, contract.playerId)?.displayName ??
        contract.playerId,
      position: player?.position ?? "—",
      salary: getContractSalaryForYear(contract, year) ?? null,
      startYear: contract.startYear,
      endYear: contract.endYear,
      yearsRemaining: Math.max(0, contract.endYear - year + 1),
      status: getContractStatus(contract, year),
      hasPendingTeamOption: contract.teamOption?.status === "pending",
      hasPendingPlayerOption: contract.playerOption?.status === "pending",
    });
  }
  rows.sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));
  return rows;
}

export function toFinancesView(state: GameState): FinancesView {
  const team = getControlledTeam(state);
  const year = state.competition.season.year;
  const finances = state.business.finances[team.id];
  const salaryCap = getLeagueSalaryCap(state);
  const staffBudget = getLeagueStaffBudget(state);
  // Player payroll and cap space are for the season contracts are signed
  // for: next season once the offseason starts, as free agency, extensions
  // and the tax line already show. The statement stays on the season played.
  const capYear = getContractSigningYear(state);
  const playerPayroll = getTeamPayroll(team.id, capYear, state);
  const staffPayroll = getTeamStaffPayroll(team.id, year, state);
  return {
    businessFunds: finances?.businessFunds ?? 0,
    payrollSnapshot: finances?.payroll ?? 0,
    statement: getFinancialStatement(state, team.id, year),
    salaryCap,
    salaryCapEnabled: state.settings.financialRules.salaryCapEnabled,
    playerPayroll,
    capSpace: getTeamCapSpace(team.id, capYear, state, salaryCap),
    staffBudget,
    staffPayroll,
    staffBudgetSpace: getTeamStaffBudgetSpace(
      team.id,
      year,
      state,
      staffBudget,
    ),
  };
}
