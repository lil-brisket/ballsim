import { createEmptyFantasyDraft } from "@/domain/entities/fantasy-draft";
import {
  PLAYER_POSITIONS,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import { emptyTeamRosterManagement } from "@/domain/entities/team-roster-management";
import type { Rng } from "@/domain/rng";
import { asPlayerId, type PlayerId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { applyRosterPackage } from "@/systems/custom-content/apply-roster";
import { generatePlayerWithRng } from "@/systems/player-generation";
import {
  computeFantasyPoolSize,
  computeFantasyTotalPicks,
  FANTASY_DRAFT_PICKS_PER_TEAM,
} from "@/systems/fantasy-draft/fantasy-draft-config";

/**
 * Imports a custom roster as a fantasy-draft pool: team names stay, players are
 * unassigned, and generated fillers pad the pool so every team can draft a
 * full {@link FANTASY_DRAFT_PICKS_PER_TEAM}-man roster. Undrafted players
 * remain free agents. Idempotent once a fantasy draft exists.
 */
export function generateFantasyPlayerPoolFromRosterPackage(
  state: GameState,
  rosterPackage: unknown,
  rng: Rng,
): SystemResult {
  if (state.world.fantasyDraft !== null) {
    return systemResult(state);
  }

  const imported =
    Object.keys(state.world.players).length === 0
      ? applyRosterPackage(state, rosterPackage, rng).state
      : state;
  const unassigned = unassignPlayersForFantasyPool(imported);
  return fillFantasyPool(unassigned, rng);
}

function unassignPlayersForFantasyPool(state: GameState): GameState {
  const contracts = { ...state.business.contracts };
  const players: Record<string, Player> = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    if (player.contractId !== null) {
      delete contracts[player.contractId];
    }
    players[playerId] = {
      ...player,
      teamId: null,
      contractId: null,
    };
  }

  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    teams[teamId] = {
      ...team,
      roster: [],
      rosterManagement: emptyTeamRosterManagement(),
    };
  }

  const finances = { ...state.business.finances };
  for (const teamId of Object.keys(finances)) {
    const existing = finances[teamId];
    if (existing) {
      finances[teamId] = { ...existing, payroll: 0 };
    }
  }

  return {
    ...state,
    world: {
      ...state.world,
      players,
      teams,
    },
    business: {
      ...state.business,
      contracts,
      finances,
    },
  };
}

function fillFantasyPool(state: GameState, rng: Rng): SystemResult {
  const teamCount = Object.keys(state.world.teams).length;
  if (teamCount < 1) {
    throw new Error("Cannot generate fantasy player pool: no teams.");
  }

  const players: Record<string, Player> = { ...state.world.players };
  const existingIds = Object.keys(players).sort();
  const targetSize = Math.max(
    existingIds.length,
    computeFantasyPoolSize(teamCount),
  );
  const totalPicks = computeFantasyTotalPicks(teamCount);
  if (targetSize <= totalPicks) {
    throw new Error(
      `Fantasy pool size (${targetSize}) must exceed total picks (${totalPicks}).`,
    );
  }

  const fillIds: PlayerId[] = [];
  for (let index = 0; existingIds.length + fillIds.length < targetSize; index += 1) {
    const playerId = asPlayerId(`fantasy_fill_${index}`);
    if (players[playerId] !== undefined) {
      continue;
    }
    const player = generatePlayerWithRng(rng, {
      id: playerId,
      teamId: null,
      contractId: null,
      position: nextFillPosition(Object.values(players)),
    });
    players[playerId] = player;
    fillIds.push(playerId);
  }

  const poolPlayerIds: PlayerId[] = [
    ...existingIds.map((id) => asPlayerId(id)),
    ...fillIds,
  ];
  const draftSettings = state.settings.draft;
  const fantasyDraft = createEmptyFantasyDraft({
    draftType: draftSettings.type ?? "snake",
    orderMode: draftSettings.orderMode ?? "random",
    picksPerTeam: FANTASY_DRAFT_PICKS_PER_TEAM,
    totalPicks,
    poolPlayerIds,
    timerSeconds: draftSettings.timerSeconds ?? null,
  });

  return systemResult({
    ...state,
    world: {
      ...state.world,
      players,
      fantasyDraft,
    },
  });
}

function nextFillPosition(players: readonly Player[]): PlayerPosition {
  const counts = new Map<PlayerPosition, number>();
  for (const position of PLAYER_POSITIONS) {
    counts.set(position, 0);
  }
  for (const player of players) {
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  let selected = PLAYER_POSITIONS[0]!;
  let lowest = counts.get(selected) ?? 0;
  for (const position of PLAYER_POSITIONS) {
    const count = counts.get(position) ?? 0;
    if (count < lowest) {
      selected = position;
      lowest = count;
    }
  }
  return selected;
}
