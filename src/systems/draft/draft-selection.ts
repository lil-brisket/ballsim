import { createContract } from "@/domain/entities/contract";
import type { DraftClass } from "@/domain/entities/draft";
import { createDraftSelection } from "@/domain/entities/draft";
import { createDraftPickResult } from "@/domain/entities/draft-pick-result";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import { createDomainEvent, type DomainEvent } from "@/domain/events/domain-event";
import { asContractId, type DraftClassId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { attributeBasedAnnualSalary } from "@/systems/attribute-salary";
import { DRAFT_ROOKIE_CONTRACT_YEARS } from "@/systems/draft-config";
import {
  validateDraftSelection,
  type MakeDraftSelectionInput,
} from "@/systems/draft/draft-validation";
import type { DraftValidationResult } from "@/systems/draft/draft-types";
import { findTeamProspectEstimate } from "@/systems/draft/draft-scouting";
import { createRatingRange } from "@/domain/entities/scouting-types";
import { reconcileRosterManagement } from "@/systems/roster-management";
import { getTeamPayroll } from "@/systems/salary-cap";

export type DraftSelectionResult = {
  success: boolean;
  validation: DraftValidationResult;
  state: GameState;
  events: DomainEvent[];
};

/**
 * Validates then applies a draft selection. Consumes no RNG.
 * Inserts the exact prospect snapshot into world.players under prospect.playerId.
 * Authoritative selecting team is slot.ownerTeamId (not the claimed teamId).
 */
export function makeDraftSelection(
  state: GameState,
  input: MakeDraftSelectionInput,
): DraftSelectionResult {
  const validation = validateDraftSelection(state, input);
  if (!validation.valid) {
    return {
      success: false,
      validation,
      state,
      events: [],
    };
  }

  const draft = state.world.drafts[input.draftClassId] as DraftClass;
  const slotIndex = draft.order.findIndex(
    (entry) => entry.draftPickId === input.draftPickId,
  );
  const slot = draft.order[slotIndex]!;
  const prospect = draft.prospects[input.prospectPlayerId]!;
  const ownerTeamId = slot.ownerTeamId;
  const playerId = prospect.playerId;
  const contractId = asContractId(`contract_${playerId}`);
  const seasonYear = state.competition.season.year;
  const endYear = seasonYear + DRAFT_ROOKIE_CONTRACT_YEARS - 1;
  const salaryPerYear = attributeBasedAnnualSalary(prospect.player.attributes);
  const salaryByYear: Record<string, number> = {};
  for (let year = seasonYear; year <= endYear; year += 1) {
    salaryByYear[String(year)] = salaryPerYear;
  }

  const player: Player = {
    ...prospect.player,
    id: playerId,
    teamId: ownerTeamId,
    contractId,
  };

  const contract = createContract({
    id: contractId,
    playerId,
    teamId: ownerTeamId,
    startYear: seasonYear,
    endYear,
    salaryByYear,
  });

  const ownerTeam = state.world.teams[ownerTeamId] as Team;
  const updatedTeam: Team = {
    ...ownerTeam,
    roster: [...ownerTeam.roster, playerId],
  };

  const updatedProspect = {
    ...prospect,
    status: "selected" as const,
  };
  const updatedOrder = draft.order.map((entry, index) =>
    index === slotIndex
      ? {
          ...entry,
          status: "used" as const,
          selectedPlayerId: playerId,
        }
      : entry,
  );
  const selection = createDraftSelection({
    draftClassId: draft.id,
    seasonYear: draft.seasonYear,
    round: slot.round,
    overallPick: slot.overallPick,
    draftPickId: slot.draftPickId,
    teamId: ownerTeamId,
    playerId,
  });

  const estimate = findTeamProspectEstimate(
    draft.teamDraftState[ownerTeamId],
    playerId,
  );
  const pickResult = createDraftPickResult({
    draftClassId: draft.id,
    draftPickId: slot.draftPickId,
    seasonYear: draft.seasonYear,
    round: slot.round,
    overallPick: slot.overallPick,
    teamId: ownerTeamId,
    playerId,
    playerSnapshot: { ...prospect.player },
    scoutingAtSelection: estimate
      ? {
          scoutGrade: estimate.scoutGrade,
          estimatedOverall: { ...estimate.estimatedOverall },
          estimatedPotential: { ...estimate.estimatedPotential },
          confidence: estimate.confidence,
        }
      : {
          scoutGrade: "C",
          estimatedOverall: createRatingRange(50, 70),
          estimatedPotential: createRatingRange(55, 75),
          confidence: "low",
        },
  });

  const updatedDraft: DraftClass = {
    ...draft,
    prospects: {
      ...draft.prospects,
      [playerId]: updatedProspect,
    },
    order: updatedOrder,
    selections: [...draft.selections, selection],
    pickResults: [...(draft.pickResults ?? []), pickResult],
  };

  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: player,
      },
      teams: {
        ...state.world.teams,
        [ownerTeamId]: updatedTeam,
      },
      drafts: {
        ...state.world.drafts,
        [draft.id]: updatedDraft,
      },
      draftPicks: {
        ...state.world.draftPicks,
        [input.draftPickId]: {
          ...state.world.draftPicks[input.draftPickId]!,
          status: "used",
        },
      },
    },
    business: {
      ...state.business,
      contracts: {
        ...state.business.contracts,
        [contractId]: contract,
      },
      finances: { ...state.business.finances },
    },
  };

  const existingFinance = next.business.finances[ownerTeamId];
  if (existingFinance) {
    next = {
      ...next,
      business: {
        ...next.business,
        finances: {
          ...next.business.finances,
          [ownerTeamId]: {
            ...existingFinance,
            payroll: getTeamPayroll(ownerTeamId, seasonYear, next),
          },
        },
      },
    };
  }

  const occurredOn = state.world.calendar.currentDate;
  const events: DomainEvent[] = [
    createDomainEvent({
      type: "DraftPickMade",
      occurredOn,
      payload: {
        draftClassId: draft.id,
        draftPickId: slot.draftPickId,
        overallPick: slot.overallPick,
        round: slot.round,
        teamId: ownerTeamId,
        playerId,
      },
    }),
    createDomainEvent({
      type: "ContractSigned",
      occurredOn,
      payload: {
        contractId,
        playerId,
        teamId: ownerTeamId,
      },
    }),
  ];

  next = reconcileRosterManagement(next, ownerTeamId);
  next = appendSeasonEventLog(next, events);

  return {
    success: true,
    validation,
    state: next,
    events,
  };
}

export type { MakeDraftSelectionInput };
export type { DraftClassId };
