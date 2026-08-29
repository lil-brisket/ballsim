import type {
  FantasyDraft,
  FantasyDraftType,
} from "@/domain/entities/fantasy-draft";
import type { Rng } from "@/domain/rng";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type FantasyPickInfo = {
  pickNumber: number;
  round: number;
  pickInRound: number;
  teamId: TeamId;
};

/**
 * Derive which team owns a given overall pick number.
 * Snake: odd rounds forward, even rounds reverse. Linear: always forward.
 */
export function getPickOwnerForNumber(
  draftOrder: readonly TeamId[],
  draftType: FantasyDraftType,
  pickNumber: number,
): FantasyPickInfo {
  const teamCount = draftOrder.length;
  if (teamCount < 1) {
    throw new Error("Draft order is empty.");
  }
  if (!Number.isInteger(pickNumber) || pickNumber < 1) {
    throw new Error("pickNumber must be an integer >= 1.");
  }
  const round = Math.ceil(pickNumber / teamCount);
  const pickInRound = ((pickNumber - 1) % teamCount) + 1;
  const teamIndex =
    draftType === "snake" && round % 2 === 0
      ? teamCount - pickInRound
      : pickInRound - 1;
  const teamId = draftOrder[teamIndex];
  if (teamId === undefined) {
    throw new Error(`No team at draft order index ${teamIndex}.`);
  }
  return { pickNumber, round, pickInRound, teamId };
}

export function getCurrentPick(state: GameState): FantasyPickInfo | undefined {
  const draft = state.world.fantasyDraft;
  if (
    draft === null ||
    draft.currentPickNumber === null ||
    draft.draftOrder.length === 0
  ) {
    return undefined;
  }
  if (
    draft.status !== "active" &&
    draft.status !== "paused"
  ) {
    return undefined;
  }
  return getPickOwnerForNumber(
    draft.draftOrder,
    draft.draftType,
    draft.currentPickNumber,
  );
}

export function getNextPick(state: GameState): FantasyPickInfo | undefined {
  const draft = state.world.fantasyDraft;
  if (draft === null || draft.currentPickNumber === null) {
    return undefined;
  }
  const next = draft.currentPickNumber + 1;
  if (next > draft.totalPicks) {
    return undefined;
  }
  return getPickOwnerForNumber(draft.draftOrder, draft.draftType, next);
}

export function teamIdsSorted(state: GameState): TeamId[] {
  return Object.keys(state.world.teams)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => state.world.teams[id]!.id);
}

/**
 * Fisher-Yates shuffle of all franchises. Setup only; creates a starting order.
 */
export function randomizeDraftOrder(state: GameState, rng: Rng): GameState {
  const draft = requireSetupDraft(state);
  const order = [...teamIdsSorted(state)];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return withFantasyDraft(state, {
    ...draft,
    orderMode: "random",
    draftOrder: order,
  });
}

/**
 * Deterministic alphabetical default order for manual mode.
 */
export function setDefaultDraftOrder(state: GameState): GameState {
  const draft = requireSetupDraft(state);
  return withFantasyDraft(state, {
    ...draft,
    orderMode: "manual",
    draftOrder: teamIdsSorted(state),
  });
}

export function setDraftOrder(
  state: GameState,
  draftOrder: readonly TeamId[],
): GameState {
  const draft = requireSetupDraft(state);
  assertValidOrder(state, draftOrder);
  return withFantasyDraft(state, {
    ...draft,
    draftOrder: [...draftOrder],
  });
}

/** Move a team up (−1) or down (+1) in the draft order. */
export function moveTeamInOrder(
  state: GameState,
  teamId: TeamId,
  direction: -1 | 1,
): GameState {
  const draft = requireSetupDraft(state);
  const order = [...draft.draftOrder];
  const index = order.indexOf(teamId);
  if (index < 0) {
    throw new Error(`Team "${teamId}" is not in the draft order.`);
  }
  const target = index + direction;
  if (target < 0 || target >= order.length) {
    return state;
  }
  const tmp = order[index]!;
  order[index] = order[target]!;
  order[target] = tmp;
  return withFantasyDraft(state, { ...draft, draftOrder: order });
}

/**
 * Locks the draft order and starts the draft (setup → active).
 */
export function confirmFantasyDraftOrder(
  state: GameState,
  nowIso: string,
): GameState {
  const draft = requireSetupDraft(state);
  if (draft.draftOrder.length !== Object.keys(state.world.teams).length) {
    throw new Error(
      "Draft order must include every franchise before confirmation.",
    );
  }
  assertValidOrder(state, draft.draftOrder);
  const next: FantasyDraft = {
    ...draft,
    orderConfirmed: true,
    status: "active",
    currentPickNumber: 1,
    pausedAt: null,
    timer: {
      ...draft.timer,
      pickStartedAt: draft.timer.enabled ? nowIso : null,
    },
  };
  return withFantasyDraft(state, next);
}

function requireSetupDraft(state: GameState): FantasyDraft {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  if (draft.orderConfirmed || draft.status !== "setup") {
    throw new Error("Draft order is already locked.");
  }
  return draft;
}

function assertValidOrder(
  state: GameState,
  draftOrder: readonly TeamId[],
): void {
  const teamIds = new Set(Object.keys(state.world.teams));
  if (draftOrder.length !== teamIds.size) {
    throw new Error(
      `Draft order length ${draftOrder.length} does not match team count ${teamIds.size}.`,
    );
  }
  const seen = new Set<string>();
  for (const teamId of draftOrder) {
    if (!teamIds.has(teamId)) {
      throw new Error(`Draft order contains unknown team "${teamId}".`);
    }
    if (seen.has(teamId)) {
      throw new Error(`Draft order duplicates team "${teamId}".`);
    }
    seen.add(teamId);
  }
}

export function withFantasyDraft(
  state: GameState,
  fantasyDraft: FantasyDraft,
): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      fantasyDraft,
    },
  };
}
