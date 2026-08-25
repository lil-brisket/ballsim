import type { ContractInput } from "@/domain/entities/contract";
import type { Player } from "@/domain/entities/player";
import { PLAYER_POSITIONS, type PlayerPosition } from "@/domain/entities/player";
import type { StaffRole } from "@/domain/entities/staff";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import {
  asContractId,
  asOfferId,
  type PlayerId,
  type StaffId,
  type TeamId,
} from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  acceptOffer,
  listFreeAgents,
  makeOffer,
} from "@/systems/free-agency";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import {
  AI_FA_MAX_SALARY,
  AI_FA_MIN_SALARY,
} from "@/systems/owner-objectives-config";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { hireStaff } from "@/systems/staff";
import { findTeamStaffByRole } from "@/systems/staff-effects";
import { STARTER_ROLES } from "@/systems/staff-generation";
import {
  isAiAssistEnabledForDomain,
  resolveDomainAssistMode,
} from "@/systems/simulation/ai-assist-settings";
import { resolveSimulationPhaseKey } from "@/systems/simulation/simulation-phase";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason, makeDraftSelection } from "@/systems/draft";
import { selectProspectForTeam } from "@/systems/ai-team-decisions";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";

export type RunAiContinuityOptions = {
  /** Optional phase key override for idempotency / forced handoff. */
  forcePhase?: string;
};

/**
 * User-franchise AI continuity: fill roster / hire missing starter staff / draft.
 * Respects AI assist settings and explicitDecisions. CPU teams are untouched.
 */
export function runAiContinuity(
  state: GameState,
  _rng: Rng,
  options: RunAiContinuityOptions = {},
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const teamId = current.user.controlledTeamId;
  const date = current.world.calendar.currentDate;
  const phaseKey = options.forcePhase ?? resolveSimulationPhaseKey(current);
  const continuityKey = `ai_continuity:${phaseKey}:${date}`;

  if (hasAppliedGameplayConsequence(current, continuityKey)) {
    return systemResult(current);
  }

  if (current.settings.ai.managementMode === "off") {
    return systemResult(withAppliedGameplayConsequence(current, continuityKey));
  }

  const rosterResult = fillRosterIfNeeded(current, teamId, date);
  current = rosterResult.state;
  events.push(...rosterResult.events);

  const staffResult = hireMissingStaff(current, teamId, date);
  current = staffResult.state;
  events.push(...staffResult.events);

  const draftResult = pickDraftIfOnClock(current, teamId, date);
  current = draftResult.state;
  events.push(...draftResult.events);

  current = withAppliedGameplayConsequence(current, continuityKey);
  return systemResult(current, events);
}

function pickDraftIfOnClock(
  state: GameState,
  teamId: TeamId,
  date: string,
): SystemResult {
  if (!isAiAssistEnabledForDomain(state.settings, "draft")) {
    return systemResult(state);
  }
  if (!isUserOnDraftClock(state)) {
    return systemResult(state);
  }

  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.status !== "active") {
    return systemResult(state);
  }

  const onClock = draft.order.find((slot) => slot.status === "available");
  if (onClock === undefined || onClock.ownerTeamId !== teamId) {
    return systemResult(state);
  }

  const key = `ai_continuity_draft:${onClock.draftPickId}`;
  if (hasAppliedGameplayConsequence(state, key)) {
    return systemResult(state);
  }

  const prospectId = selectProspectForTeam(state, draft, teamId);
  if (prospectId === undefined) {
    return systemResult(withAppliedGameplayConsequence(state, key));
  }

  const result = makeDraftSelection(state, {
    draftClassId,
    draftPickId: onClock.draftPickId,
    prospectPlayerId: prospectId,
    teamId,
  });
  if (!result.success) {
    return systemResult(withAppliedGameplayConsequence(state, key));
  }

  let next = withAppliedGameplayConsequence(result.state, key);
  const events: DomainEvent[] = [
    ...result.events,
    createDomainEvent({
      type: "AiAssistAction",
      occurredOn: date,
      payload: {
        domain: "draft",
        action: "draft_pick",
        reason: "User team was on the draft clock with AI draft assistance enabled.",
        playerId: prospectId,
      },
    }),
  ];
  return systemResult(next, events);
}

function fillRosterIfNeeded(
  state: GameState,
  teamId: TeamId,
  date: string,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  if (
    !isAiAssistEnabledForDomain(current.settings, "rosterFilling") &&
    !isAiAssistEnabledForDomain(current.settings, "freeAgency")
  ) {
    return systemResult(current);
  }

  const mode = isAiAssistEnabledForDomain(current.settings, "rosterFilling")
    ? resolveDomainAssistMode(current.settings, "rosterFilling")
    : resolveDomainAssistMode(current.settings, "freeAgency");

  if (mode === "off") {
    return systemResult(current);
  }

  const inFaWindow =
    current.competition.season.phase === "offseason" &&
    current.competition.season.offseasonStage === "free_agency";
  if (!inFaWindow && mode === "smart") {
    // Smart assist only auto-signs during free agency unless forced full.
    return systemResult(current);
  }
  if (
    !inFaWindow &&
    !isAiAssistEnabledForDomain(current.settings, "rosterFilling")
  ) {
    return systemResult(current);
  }

  const team = current.world.teams[teamId];
  if (!team || team.roster.length >= DEFAULT_ROSTER_SIZE) {
    return systemResult(current);
  }

  const seasonYear = current.competition.season.year;
  const maxSignings = DEFAULT_ROSTER_SIZE - team.roster.length;
  let signed = 0;

  while (signed < maxSignings) {
    const liveTeam = current.world.teams[teamId];
    if (!liveTeam || liveTeam.roster.length >= DEFAULT_ROSTER_SIZE) {
      break;
    }

    const capSpace = current.settings.financialRules.salaryCapEnabled
      ? getTeamCapSpace(teamId, seasonYear, current)
      : Number.MAX_SAFE_INTEGER;
    if (capSpace < AI_FA_MIN_SALARY) {
      break;
    }

    const excluded = new Set<PlayerId>(
      Object.keys(current.user.explicitDecisions)
        .filter((key) => key.startsWith("declined_fa:"))
        .map((key) => key.slice("declined_fa:".length) as PlayerId),
    );
    const candidate = pickBestAffordableFreeAgent(current, teamId, capSpace, {
      excludePlayerIds: excluded,
    });
    if (candidate === undefined) {
      break;
    }

    const signedOne = trySignFreeAgent(
      current,
      teamId,
      candidate,
      date,
      seasonYear,
    );
    if (signedOne === null) {
      break;
    }
    current = signedOne.state;
    events.push(...signedOne.events);
    signed += 1;
  }

  return systemResult(current, events);
}

function trySignFreeAgent(
  state: GameState,
  teamId: TeamId,
  candidate: Player,
  date: string,
  seasonYear: number,
): SystemResult | null {
  const capSpace = state.settings.financialRules.salaryCapEnabled
    ? getTeamCapSpace(teamId, seasonYear, state)
    : Number.MAX_SAFE_INTEGER;
  const salary = Math.min(
    AI_FA_MAX_SALARY,
    Math.max(AI_FA_MIN_SALARY, Math.floor(capSpace * 0.15)),
  );
  if (salary > capSpace) {
    return null;
  }

  const offerId = asOfferId(
    `offer_ai_cont_${teamId}_${candidate.id}_${date}`,
  );
  const contractId = asContractId(
    `contract_ai_cont_${candidate.id}_${date.replaceAll("-", "")}`,
  );
  const terms: ContractInput = {
    id: contractId,
    playerId: candidate.id,
    teamId,
    startYear: seasonYear,
    endYear: seasonYear,
    salaryByYear: { [String(seasonYear)]: salary },
  };

  try {
    let current = state;
    const events: DomainEvent[] = [];
    const offered = makeOffer(current, {
      id: offerId,
      playerId: candidate.id,
      teamId,
      terms,
    });
    current = offered.state;
    events.push(...offered.events);
    const accepted = acceptOffer(current, offerId);
    current = accepted.state;
    events.push(...accepted.events);
    events.push(
      createDomainEvent({
        type: "AiAssistAction",
        occurredOn: date,
        payload: {
          domain: "rosterFilling",
          action: "sign_free_agent",
          reason: "roster_below_minimum",
          playerId: candidate.id,
          teamId,
        },
      }),
    );
    return systemResult(current, events);
  } catch {
    return null;
  }
}

function hireMissingStaff(
  state: GameState,
  teamId: TeamId,
  date: string,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  if (!isAiAssistEnabledForDomain(current.settings, "staffHiring")) {
    return systemResult(current);
  }

  const mode = resolveDomainAssistMode(current.settings, "staffHiring");
  if (mode === "off") {
    return systemResult(current);
  }

  for (const role of STARTER_ROLES) {
    if (findTeamStaffByRole(current, teamId, role) !== null) {
      continue;
    }
    const declineKey = `declined_staff:${role}`;
    if (current.user.explicitDecisions[declineKey] === true) {
      continue;
    }

    const candidate = pickUnemployedStaff(current, role);
    if (candidate === undefined) {
      continue;
    }

    try {
      const hired = hireStaff(current, teamId, candidate.id);
      current = hired.state;
      events.push(...hired.events);
      events.push(
        createDomainEvent({
          type: "AiAssistAction",
          occurredOn: date,
          payload: {
            domain: "staffHiring",
            action: "hire_staff",
            reason: "missing_starter_role",
            staffId: candidate.id,
            role,
            teamId,
          },
        }),
      );
    } catch {
      // Skip role on hire failure.
    }
  }

  return systemResult(current, events);
}

function pickUnemployedStaff(
  state: GameState,
  role: StaffRole,
): { id: StaffId; quality: number } | undefined {
  const pool = Object.values(state.world.staff)
    .filter((staff) => staff.teamId === null && staff.role === role)
    .sort((a, b) => {
      if (b.quality !== a.quality) {
        return b.quality - a.quality;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const best = pool[0];
  return best === undefined
    ? undefined
    : { id: best.id, quality: best.quality };
}

function pickBestAffordableFreeAgent(
  state: GameState,
  teamId: TeamId,
  capSpace: number,
  options: { excludePlayerIds?: Set<PlayerId> } = {},
): Player | undefined {
  const missing = missingPositions(state, teamId);
  const exclude = options.excludePlayerIds ?? new Set<PlayerId>();
  const pool = listFreeAgents(state)
    .playerIds.map((playerId) => state.world.players[playerId])
    .filter((player): player is Player => player !== undefined)
    .filter((player) => !exclude.has(player.id));

  const ranked = [...pool].sort((a, b) => {
    const aMissing = missing.includes(a.position) ? 0 : 1;
    const bMissing = missing.includes(b.position) ? 0 : 1;
    if (aMissing !== bMissing) {
      return aMissing - bMissing;
    }
    const aOverall = calculatePlayerOverall(a.position, a.attributes);
    const bOverall = calculatePlayerOverall(b.position, b.attributes);
    if (bOverall !== aOverall) {
      return bOverall - aOverall;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  for (const player of ranked) {
    if (capSpace >= AI_FA_MIN_SALARY) {
      return player;
    }
  }
  return undefined;
}

function missingPositions(
  state: GameState,
  teamId: TeamId,
): PlayerPosition[] {
  const counts = new Map<PlayerPosition, number>();
  for (const position of PLAYER_POSITIONS) {
    counts.set(position, 0);
  }
  const team = state.world.teams[teamId];
  if (!team) {
    return [...PLAYER_POSITIONS];
  }
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  return PLAYER_POSITIONS.filter((position) => (counts.get(position) ?? 0) === 0);
}
