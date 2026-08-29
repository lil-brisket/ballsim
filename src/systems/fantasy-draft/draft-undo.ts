import type { FantasyDraft } from "@/domain/entities/fantasy-draft";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import { createDomainEvent, type DomainEvent } from "@/domain/events/domain-event";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { withFantasyDraft } from "@/systems/fantasy-draft/draft-order";
import { isFantasyDraftContractId } from "@/systems/fantasy-draft/fantasy-contracts";
import { getTeamPayroll } from "@/systems/salary-cap";

export type FantasyDraftUndoResult = {
  success: boolean;
  message?: string;
  state: GameState;
  events: DomainEvent[];
};

/**
 * Full reversal of the most recent fantasy draft pick.
 * Commissioner/debug only — reverses roster, contract, payroll, and pick state.
 * Emits FantasyDraftPickUndone (does not delete prior events).
 */
export function undoLastFantasyDraftPick(
  state: GameState,
  nowIso: string,
): FantasyDraftUndoResult {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return {
      success: false,
      message: "No fantasy draft exists.",
      state,
      events: [],
    };
  }
  if (draft.status === "complete") {
    return {
      success: false,
      message: "Cannot undo after fantasy draft completion.",
      state,
      events: [],
    };
  }
  if (draft.selections.length === 0) {
    return {
      success: false,
      message: "No picks to undo.",
      state,
      events: [],
    };
  }

  const last = draft.selections[draft.selections.length - 1]!;
  const player = state.world.players[last.playerId];
  if (player === undefined) {
    return {
      success: false,
      message: `Player "${last.playerId}" missing.`,
      state,
      events: [],
    };
  }

  if (
    last.contractId &&
    !isFantasyDraftContractId(String(last.contractId))
  ) {
    return {
      success: false,
      message: "Last pick contract is not a fantasy-draft contract.",
      state,
      events: [],
    };
  }

  const restoredPlayer: Player = {
    ...player,
    teamId: null,
    contractId: null,
  };

  const team = state.world.teams[last.teamId] as Team;
  const updatedTeam: Team = {
    ...team,
    roster: team.roster.filter((id) => id !== last.playerId),
  };

  const contracts = { ...state.business.contracts };
  delete contracts[last.contractId];

  const updatedDraft: FantasyDraft = {
    ...draft,
    status: draft.status === "paused" ? "paused" : "active",
    selections: draft.selections.slice(0, -1),
    selectedPlayerIds: draft.selectedPlayerIds.filter(
      (id) => id !== last.playerId,
    ),
    currentPickNumber: last.pickNumber,
    timer: {
      ...draft.timer,
      pickStartedAt: draft.timer.enabled ? nowIso : null,
    },
  };

  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [last.playerId]: restoredPlayer,
      },
      teams: {
        ...state.world.teams,
        [last.teamId]: updatedTeam,
      },
      fantasyDraft: updatedDraft,
    },
    business: {
      ...state.business,
      contracts,
      finances: { ...state.business.finances },
    },
  };

  const finance = next.business.finances[last.teamId];
  if (finance) {
    next = {
      ...next,
      business: {
        ...next.business,
        finances: {
          ...next.business.finances,
          [last.teamId]: {
            ...finance,
            payroll: getTeamPayroll(
              last.teamId,
              next.competition.season.year,
              next,
            ),
          },
        },
      },
    };
  }

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "FantasyDraftPickUndone",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        pickNumber: last.pickNumber,
        teamId: last.teamId,
        playerId: last.playerId,
        contractId: last.contractId,
      },
    }),
  ];

  next = appendSeasonEventLog(next, events);
  next = withFantasyDraft(next, updatedDraft);

  return { success: true, state: next, events };
}
