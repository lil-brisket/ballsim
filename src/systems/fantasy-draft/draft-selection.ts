import type { FantasyDraft } from "@/domain/entities/fantasy-draft";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import { createDomainEvent, type DomainEvent } from "@/domain/events/domain-event";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { createFantasyDraftContract } from "@/systems/fantasy-draft/fantasy-contracts";
import {
  getCurrentPick,
  withFantasyDraft,
} from "@/systems/fantasy-draft/draft-order";
import {
  validateFantasyDraftSelection,
  type FantasyDraftValidationResult,
  type MakeFantasyDraftSelectionInput,
} from "@/systems/fantasy-draft/draft-validation";
import { getTeamPayroll } from "@/systems/salary-cap";
import { completeFantasyDraft } from "@/systems/fantasy-draft/draft-lifecycle";

export type FantasyDraftSelectionResult = {
  success: boolean;
  validation: FantasyDraftValidationResult;
  state: GameState;
  events: DomainEvent[];
};

/**
 * Validates then applies a fantasy draft selection.
 * Does not call reconcileRosterManagement (deferred to completion).
 */
export function makeFantasyDraftSelection(
  state: GameState,
  input: MakeFantasyDraftSelectionInput,
): FantasyDraftSelectionResult {
  const validation = validateFantasyDraftSelection(state, input);
  if (!validation.valid) {
    return {
      success: false,
      validation,
      state,
      events: [],
    };
  }

  const draft = state.world.fantasyDraft as FantasyDraft;
  const pick = getCurrentPick(state)!;
  const player = state.world.players[input.playerId] as Player;
  const ownerTeamId = pick.teamId;
  const seasonYear = state.competition.season.year;

  // Re-check availability inside the mutation path (duplicate-pick safety).
  if (
    draft.selectedPlayerIds.includes(input.playerId) ||
    player.teamId !== null
  ) {
    return {
      success: false,
      validation: {
        valid: false,
        errors: [
          {
            code: "PLAYER_ALREADY_DRAFTED",
            message: `Player "${input.playerId}" has already been drafted.`,
          },
        ],
        warnings: [],
      },
      state,
      events: [],
    };
  }

  const contract = createFantasyDraftContract({
    player,
    teamId: ownerTeamId,
    seasonYear,
  });

  const updatedPlayer: Player = {
    ...player,
    teamId: ownerTeamId,
    contractId: contract.id,
  };

  const ownerTeam = state.world.teams[ownerTeamId] as Team;
  const updatedTeam: Team = {
    ...ownerTeam,
    roster: [...ownerTeam.roster, input.playerId],
  };

  const selection = {
    pickNumber: pick.pickNumber,
    round: pick.round,
    pickInRound: pick.pickInRound,
    teamId: ownerTeamId,
    playerId: input.playerId,
    contractId: contract.id,
    selectedAt: input.nowIso,
  };

  const nextPickNumber =
    pick.pickNumber >= draft.totalPicks ? null : pick.pickNumber + 1;

  let updatedDraft: FantasyDraft = {
    ...draft,
    selectedPlayerIds: [...draft.selectedPlayerIds, input.playerId],
    selections: [...draft.selections, selection],
    currentPickNumber: nextPickNumber,
    timer: {
      ...draft.timer,
      pickStartedAt:
        nextPickNumber !== null && draft.timer.enabled ? input.nowIso : null,
    },
  };

  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [input.playerId]: updatedPlayer,
      },
      teams: {
        ...state.world.teams,
        [ownerTeamId]: updatedTeam,
      },
      fantasyDraft: updatedDraft,
    },
    business: {
      ...state.business,
      contracts: {
        ...state.business.contracts,
        [contract.id]: contract,
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

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "FantasyDraftPickMade",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        pickNumber: pick.pickNumber,
        round: pick.round,
        teamId: ownerTeamId,
        playerId: input.playerId,
        contractId: contract.id,
      },
    }),
    createDomainEvent({
      type: "ContractSigned",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        contractId: contract.id,
        playerId: input.playerId,
        teamId: ownerTeamId,
      },
    }),
  ];

  next = appendSeasonEventLog(next, events);

  if (nextPickNumber === null) {
    const completed = completeFantasyDraft(next);
    return {
      success: true,
      validation,
      state: completed.state,
      events: [...events, ...completed.events],
    };
  }

  return {
    success: true,
    validation,
    state: next,
    events,
  };
}

export { withFantasyDraft };
