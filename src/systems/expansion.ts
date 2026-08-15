import type { ExpansionCandidateMarket } from "@/domain/entities/expansion";
import { createIdleExpansionState } from "@/domain/entities/expansion";
import { createDefaultFranchiseOps } from "@/domain/entities/franchise-ops";
import { createEmptyFranchiseHistory } from "@/domain/entities/franchise-history";
import { createIdleRelocation } from "@/domain/entities/relocation";
import {
  createTeam,
  NEUTRAL_TEAM_PLAY_STYLE,
} from "@/domain/entities/team";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import {
  asArenaId,
  asConferenceId,
  asDivisionId,
  asTeamId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";
import { generateLeagueStaffForTeam } from "@/systems/staff-generation";

function emitExpansionStage(
  state: GameState,
  stage: string,
  extra: Record<string, unknown> = {},
): DomainEvent {
  return createDomainEvent({
    type: "ExpansionStageChanged",
    occurredOn: state.world.calendar.currentDate,
    payload: { stage, ...extra },
  });
}

export function proposeExpansion(
  state: GameState,
  candidates: ExpansionCandidateMarket[],
  fee?: number,
): SystemResult {
  if (state.business.expansion.stage !== "none") {
    throw new Error("proposeExpansion: expansion already in progress.");
  }
  if (candidates.length === 0) {
    throw new Error("proposeExpansion: at least one candidate required.");
  }
  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        expansion: {
          stage: "proposed",
          candidates,
          selectedCandidateIndex: -1,
          fee: fee ?? state.business.expansion.fee,
          newTeamId: null,
        },
      },
    },
    [emitExpansionStage(state, "proposed")],
  );
}

export function approveExpansion(
  state: GameState,
  candidateIndex: number,
): SystemResult {
  const expansion = state.business.expansion;
  if (expansion.stage !== "proposed") {
    throw new Error("approveExpansion: expansion is not proposed.");
  }
  if (candidateIndex < 0 || candidateIndex >= expansion.candidates.length) {
    throw new Error("approveExpansion: invalid candidate index.");
  }
  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        expansion: {
          ...expansion,
          stage: "approved",
          selectedCandidateIndex: candidateIndex,
        },
      },
    },
    [emitExpansionStage(state, "approved", { candidateIndex })],
  );
}

function lowestOvrUnprotectedPlayer(
  state: GameState,
  excludingTeamId: TeamId,
): { playerId: PlayerId; teamId: TeamId; ovr: number } | null {
  let best: { playerId: PlayerId; teamId: TeamId; ovr: number } | null = null;

  for (const team of Object.values(state.world.teams)) {
    if (team.id === excludingTeamId) {
      continue;
    }
    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (!player) {
        continue;
      }
      const ovr = calculatePlayerOverall(player.position, player.attributes);
      if (!best || ovr < best.ovr) {
        best = { playerId, teamId: team.id, ovr };
      }
    }
  }
  return best;
}

export function runExpansionDraft(state: GameState, rng: Rng): SystemResult {
  const expansion = state.business.expansion;
  if (expansion.stage !== "approved" || !expansion.newTeamId) {
    throw new Error("runExpansionDraft: expansion team must exist first.");
  }

  const newTeamId = asTeamId(expansion.newTeamId);
  const pick = lowestOvrUnprotectedPlayer(state, newTeamId);
  if (!pick) {
    return systemResult(
      {
        ...state,
        business: {
          ...state.business,
          expansion: { ...expansion, stage: "draft" },
        },
      },
      [emitExpansionStage(state, "draft")],
    );
  }

  const fromTeam = state.world.teams[pick.teamId]!;
  const toTeam = state.world.teams[newTeamId]!;
  const player = state.world.players[pick.playerId]!;

  let current: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [pick.playerId]: { ...player, teamId: newTeamId },
      },
      teams: {
        ...state.world.teams,
        [pick.teamId]: {
          ...fromTeam,
          roster: fromTeam.roster.filter((id) => id !== pick.playerId),
        },
        [newTeamId]: {
          ...toTeam,
          roster: [...toTeam.roster, pick.playerId],
        },
      },
    },
    business: {
      ...state.business,
      expansion: { ...expansion, stage: "draft" },
    },
  };

  return systemResult(current, [
    emitExpansionStage(state, "draft", {
      playerId: pick.playerId,
      fromTeamId: pick.teamId,
      newTeamId: expansion.newTeamId,
    }),
  ]);
}

export function completeExpansion(state: GameState, rng: Rng): SystemResult {
  const expansion = state.business.expansion;
  if (expansion.stage === "none" || expansion.stage === "complete") {
    throw new Error("completeExpansion: invalid expansion stage.");
  }

  let current = state;
  const events: DomainEvent[] = [];

  if (expansion.stage === "approved" && expansion.selectedCandidateIndex >= 0) {
  const candidate = expansion.candidates[expansion.selectedCandidateIndex]!;
    const teamId = asTeamId(`team_exp_${candidate.abbreviation.toLowerCase()}`);
    const team = createTeam({
      id: teamId,
      city: candidate.city,
      name: candidate.name,
      abbreviation: candidate.abbreviation,
      conferenceId: asConferenceId(candidate.conferenceId),
      divisionId: asDivisionId(candidate.divisionId),
      roster: [],
      staff: [],
      finances: {},
      arenaId: asArenaId(`arena_${teamId}`),
      reputation: 45,
      playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE },
      coachingPhilosophy: { ...DEFAULT_COACHING_PHILOSOPHY },
    });

    const year = current.competition.season.year;
    current = {
      ...current,
      world: {
        ...current.world,
        teams: { ...current.world.teams, [teamId]: team },
      },
      business: {
        ...current.business,
        finances: {
          ...current.business.finances,
          [teamId]: {
            teamId,
            cash: expansion.fee,
            payroll: 0,
            booksByYear: {
              [String(year)]: createEmptyTeamFinanceBooks(),
            },
          },
        },
        franchiseOps: {
          ...current.business.franchiseOps,
          [teamId]: createDefaultFranchiseOps({
            marketSize: candidate.marketSize,
            aiProfile: "market_growth",
          }),
        },
        relocationByTeamId: {
          ...current.business.relocationByTeamId,
          [teamId]: createIdleRelocation(teamId),
        },
        franchiseHistory: {
          ...current.business.franchiseHistory,
          [teamId]: createEmptyFranchiseHistory(teamId),
        },
        expansion: {
          ...expansion,
          newTeamId: teamId,
        },
      },
    };

    const staffResult = generateLeagueStaffForTeam(current, rng, teamId);
    current = staffResult.state;
    events.push(...staffResult.events);
  }

  if (current.business.expansion.stage === "approved") {
    const draftResult = runExpansionDraft(current, rng);
    current = draftResult.state;
    events.push(...draftResult.events);
  }

  current = {
    ...current,
    business: {
      ...current.business,
      expansion: {
        ...current.business.expansion,
        stage: "complete",
      },
    },
  };
  events.push(emitExpansionStage(current, "complete"));

  return systemResult(current, events);
}

export function resetExpansionState(state: GameState): SystemResult {
  return systemResult({
    ...state,
    business: {
      ...state.business,
      expansion: createIdleExpansionState(),
    },
  });
}
