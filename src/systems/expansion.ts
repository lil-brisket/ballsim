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
  type DivisionId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";
import {
  EXPANSION_FEE_DEFAULT,
  EXPANSION_STARTING_CASH,
} from "@/systems/expansion-config";
import { generateFranchiseIdentity } from "@/systems/franchise-identity-generation";
import { generateLeagueStaffForTeam } from "@/systems/staff-generation";
import { applyCashAndBooksImpact } from "@/systems/team-finances";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";
import { resolvePaletteIdFromBranding } from "@/domain/entities/team-branding";
import { paletteLogoKey } from "@/domain/team-identity";

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

/**
 * Deterministic division placement: fewest teams, then stable id order.
 * Geographic realignment is deferred — do not treat this as permanent architecture.
 */
export function pickExpansionDivisionId(state: GameState): DivisionId {
  const divisions = Object.values(state.world.divisions).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  if (divisions.length === 0) {
    throw new Error("pickExpansionDivisionId: no divisions available.");
  }
  let best = divisions[0]!;
  for (const division of divisions) {
    if (division.teamIds.length < best.teamIds.length) {
      best = division;
    }
  }
  return best.id;
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
          fee: fee ?? state.business.expansion.fee ?? EXPANSION_FEE_DEFAULT,
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
  void rng;
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

  const current: GameState = {
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

function distributeExpansionFee(
  state: GameState,
  fee: number,
  excludingTeamId: TeamId | null,
): SystemResult {
  const year = state.competition.season.year;
  const recipients = (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== excludingTeamId)
    .sort();
  if (recipients.length === 0 || fee <= 0) {
    return systemResult(state);
  }

  const each = Math.floor(fee / recipients.length);
  let leftover = fee - each * recipients.length;
  let current = state;
  const events: DomainEvent[] = [];

  for (const teamId of recipients) {
    let amount = each;
    if (leftover > 0) {
      amount += 1;
      leftover -= 1;
    }
    if (amount <= 0) {
      continue;
    }
    const impact = applyCashAndBooksImpact(current, teamId, amount, year, {
      revenueCategory: "other",
    });
    current = impact.state;
    events.push(...impact.events);
  }

  return systemResult(current, events);
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
    const divisionId = asDivisionId(
      candidate.divisionId || pickExpansionDivisionId(current),
    );
    const division = current.world.divisions[divisionId];
    if (!division) {
      throw new Error(`completeExpansion: division "${divisionId}" missing.`);
    }
    const conferenceId = asConferenceId(
      candidate.conferenceId || division.conferenceId,
    );

    const preexistingIds = Object.keys(current.world.teams) as TeamId[];
    const usedPaletteLogoKeys = new Set<string>();
    for (const existing of Object.values(current.world.teams)) {
      const paletteId = resolvePaletteIdFromBranding(existing.branding);
      if (paletteId) {
        usedPaletteLogoKeys.add(
          paletteLogoKey(paletteId, existing.branding.logoId),
        );
      }
    }

    const branding = deriveDefaultTeamBranding(
      teamId,
      candidate.city,
      candidate.name,
      usedPaletteLogoKeys,
    );

    const team = createTeam({
      id: teamId,
      city: candidate.city,
      name: candidate.name,
      abbreviation: candidate.abbreviation,
      conferenceId,
      divisionId,
      roster: [],
      staff: [],
      finances: {},
      arenaId: asArenaId(`arena_${teamId}`),
      reputation: 45,
      playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE },
      coachingPhilosophy: { ...DEFAULT_COACHING_PHILOSOPHY },
      branding,
    });

    const year = current.competition.season.year;
    const seasonYear = year;

    current = {
      ...current,
      world: {
        ...current.world,
        teams: { ...current.world.teams, [teamId]: team },
        divisions: {
          ...current.world.divisions,
          [divisionId]: {
            ...division,
            teamIds: [...division.teamIds, teamId],
          },
        },
      },
      business: {
        ...current.business,
        finances: {
          ...current.business.finances,
          [teamId]: {
            teamId,
            cash: EXPANSION_STARTING_CASH,
            payroll: 0,
            booksByYear: {
              [String(year)]: createEmptyTeamFinanceBooks(),
            },
            attendanceByYear: {},
            booksByMonth: {},
            cashLedgerByMonth: {},
          },
        },
        franchiseOps: {
          ...current.business.franchiseOps,
          [teamId]: (() => {
            const identity = generateFranchiseIdentity({
              rngSeed: current.meta.rngSeed,
              teamId,
              marketSize: candidate.marketSize,
              forceProfile: "market_growth",
            });
            return createDefaultFranchiseOps({
              marketSize: candidate.marketSize,
              aiProfile: identity.aiProfile,
              spendingTolerance: identity.spendingTolerance,
              patience: identity.patience,
              riskTolerance: identity.riskTolerance,
              foundedSeasonYear: year,
            });
          })(),
        },
        relocationByTeamId: {
          ...current.business.relocationByTeamId,
          [teamId]: createIdleRelocation(teamId, seasonYear),
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

    const feeShare = distributeExpansionFee(
      current,
      expansion.fee,
      teamId,
    );
    // Fee goes to pre-existing clubs only — exclude new team (already excluded).
    void preexistingIds;
    current = feeShare.state;
    events.push(...feeShare.events);

    const staffResult = generateLeagueStaffForTeam(current, rng, teamId);
    current = staffResult.state;
    events.push(...staffResult.events);
  }

  if (current.business.expansion.stage === "approved") {
    const draftResult = runExpansionDraft(current, rng);
    current = draftResult.state;
    events.push(...draftResult.events);
  }

  // Mark complete then reset so a later era can propose again when ready.
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

  const reset = resetExpansionState(current);
  current = reset.state;
  events.push(...reset.events);

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
