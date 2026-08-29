import {
  getOwnedFranchise,
  getOwnedTeamIds,
  withOwnedFranchise,
} from "@/state/owner-context";
/**
 * User-franchise AI assistance orchestrator.
 * Flow: detect need → evaluate policy → execute | recommend | continue | block.
 * CPU franchises are never touched here.
 * Simulation keys off ownedTeamIds — never activeOwnerTeamId.
 */

import { addCalendarDays } from "@/domain/calendar-date";
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
import {
  EMPTY_AI_ASSIST_STATE,
  type AiAssistRuntimeState,
  type GameState,
} from "@/state/game-state";
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
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason, makeDraftSelection } from "@/systems/draft";
import { selectProspectForTeam } from "@/systems/ai-team-decisions";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { createAiAssistLogEvent } from "@/systems/simulation/ai-assist-logging";
import {
  detectManagementNeeds,
  type ManagementNeed,
} from "@/systems/simulation/management-needs";
import {
  recommendRosterManagement,
  withTeamRosterManagement,
} from "@/systems/roster-management";
import {
  buildManagementPolicy,
  evaluateAction,
  isUserAssistCompletelyOff,
  type PolicyDecision,
  type ResolvedManagementPolicy,
} from "@/systems/simulation/management-policy";
import { resolveSimulationPhaseKey } from "@/systems/simulation/simulation-phase";

export type RunUserFranchiseAssistOptions = {
  forcePhase?: string;
  /** When omitted, runs for every owned franchise. */
  teamId?: TeamId;
};

/**
 * Run user-franchise management assistance for one simulation day.
 * Short-circuits when preset is Off.
 * When teamId is omitted, processes every owned franchise independently.
 */
export function runUserFranchiseAssist(
  state: GameState,
  rng: Rng,
  options: RunUserFranchiseAssistOptions = {},
): SystemResult {
  if (options.teamId !== undefined) {
    return runUserFranchiseAssistForTeam(state, rng, options.teamId, options);
  }

  const events: DomainEvent[] = [];
  let current = state;
  for (const teamId of getOwnedTeamIds(state)) {
    const result = runUserFranchiseAssistForTeam(current, rng, teamId, options);
    current = result.state;
    events.push(...result.events);
  }
  return systemResult(current, events);
}

function runUserFranchiseAssistForTeam(
  state: GameState,
  _rng: Rng,
  teamId: TeamId,
  options: RunUserFranchiseAssistOptions,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = ensureAiAssistState(state, teamId);
  const franchise = getOwnedFranchise(current, teamId);
  const date = current.world.calendar.currentDate;
  const phaseKey = options.forcePhase ?? resolveSimulationPhaseKey(current);
  const continuityKey = `ai_continuity:${teamId}:${phaseKey}:${date}`;

  if (hasAppliedGameplayConsequence(current, continuityKey, teamId)) {
    return systemResult(current);
  }

  const franchiseAssistance = {
    managementPreset: franchise.managementPreset,
    aiAssistance: franchise.aiAssistance,
  };

  if (isUserAssistCompletelyOff(current.settings, franchiseAssistance)) {
    return systemResult(
      withAppliedGameplayConsequence(current, continuityKey, teamId),
    );
  }

  current = syncSeasonCounters(current, teamId);
  const policy = buildManagementPolicy(current.settings, franchiseAssistance);
  const needs = detectManagementNeeds(current, teamId);

  for (const need of needs) {
    if (
      isNeedOnCooldown(
        getOwnedFranchise(current, teamId).aiAssistState,
        need.needKey,
        date,
      )
    ) {
      continue;
    }

    const decision = evaluateAction(policy, need.actionId);

    if (decision.outcome === "DENY_CONTINUE") {
      events.push(
        createAiAssistLogEvent({
          decision,
          occurredOn: date,
          teamId,
          reason: `AI declined: ${need.detail}`,
          trigger: need.needKey,
          before: need.metadata ?? {},
          after: { declined: true },
        }),
      );
      continue;
    }

    if (decision.outcome === "DENY_BLOCK" || decision.outcome === "RECOMMEND") {
      events.push(
        createAiAssistLogEvent({
          decision,
          occurredOn: date,
          teamId,
          reason: need.detail,
          trigger: need.needKey,
          before: need.metadata ?? {},
          after: {
            unresolved: true,
            outcome: decision.outcome,
          },
        }),
      );
      if (
        decision.outcome === "RECOMMEND" &&
        need.actionId === "DRAFT_SCOUT"
      ) {
        const scout = recommendDraftProspect(current, teamId, date, decision);
        current = scout.state;
        events.push(...scout.events);
        current = markNeedResolved(
          current,
          teamId,
          need,
          date,
          decision.action.cooldownDays,
        );
      }
      continue;
    }

    const executed = executeNeed(current, teamId, date, need, decision, policy);
    current = executed.state;
    events.push(...executed.events);
    if (executed.didAct) {
      current = markNeedResolved(
        current,
        teamId,
        need,
        date,
        decision.action.cooldownDays,
      );
      current = incrementAssistCounters(current, teamId, need.actionId);
    }
  }

  current = withAppliedGameplayConsequence(current, continuityKey, teamId);
  return systemResult(current, events);
}

/**
 * @deprecated Use {@link runUserFranchiseAssist}.
 */
export function runAiContinuity(
  state: GameState,
  rng: Rng,
  options: RunUserFranchiseAssistOptions = {},
): SystemResult {
  return runUserFranchiseAssist(state, rng, options);
}

export type RunAiContinuityOptions = RunUserFranchiseAssistOptions;

function executeNeed(
  state: GameState,
  teamId: TeamId,
  date: string,
  need: ManagementNeed,
  decision: PolicyDecision,
  _policy: ResolvedManagementPolicy,
): SystemResult & { didAct: boolean } {
  switch (need.actionId) {
    case "MAINTAIN_MIN_ROSTER":
    case "SIGN_INJURY_REPLACEMENT":
    case "SIGN_EMERGENCY_FA":
    case "SIGN_ROUTINE_FA":
      return fillRosterForNeed(state, teamId, date, need, decision);
    case "HIRE_REQUIRED_COACH":
    case "HIRE_REQUIRED_FRONT_OFFICE":
      return hireStaffForNeed(state, teamId, date, need, decision);
    case "DRAFT_PICK":
      return pickDraftForNeed(state, teamId, date, need, decision);
    case "FIX_INVALID_ROTATION":
    case "ADJUST_STARTING_LINEUP":
      // V1: game-validity — log repair intent; lineup is computed at game time.
      return logRotationRepair(state, teamId, date, need, decision);
    default:
      return { ...systemResult(state), didAct: false };
  }
}

function fillRosterForNeed(
  state: GameState,
  teamId: TeamId,
  date: string,
  need: ManagementNeed,
  decision: PolicyDecision,
): SystemResult & { didAct: boolean } {
  const events: DomainEvent[] = [];
  let current = state;
  const team = current.world.teams[teamId];
  if (!team) {
    return { ...systemResult(current), didAct: false };
  }

  const isRoutine = need.actionId === "SIGN_ROUTINE_FA";
  const targetSize = isRoutine
    ? Math.max(team.roster.length + 1, DEFAULT_ROSTER_SIZE)
    : DEFAULT_ROSTER_SIZE;

  if (!isRoutine && team.roster.length >= DEFAULT_ROSTER_SIZE) {
    // Injury replacement when already at min — still allow one sign if healthy < starters
    if (need.actionId !== "SIGN_INJURY_REPLACEMENT") {
      return { ...systemResult(current), didAct: false };
    }
  }

  const seasonYear = current.competition.season.year;
  const beforeSize = team.roster.length;
  const maxSignings = Math.max(1, targetSize - team.roster.length);
  let signed = 0;

  while (signed < maxSignings) {
    const liveTeam = current.world.teams[teamId];
    if (!liveTeam) {
      break;
    }
    if (!isRoutine && liveTeam.roster.length >= DEFAULT_ROSTER_SIZE) {
      break;
    }
    if (isRoutine && signed >= 1) {
      break; // Smart routine: at most one discretionary depth signing per need
    }

    const capSpace = current.settings.financialRules.salaryCapEnabled
      ? getTeamCapSpace(teamId, seasonYear, current)
      : Number.MAX_SAFE_INTEGER;
    if (capSpace < AI_FA_MIN_SALARY) {
      break;
    }

    // Routine FA: do not spend most of available cap.
    if (isRoutine && capSpace > 0) {
      const maxSpend = Math.min(AI_FA_MAX_SALARY, Math.floor(capSpace * 0.25));
      if (maxSpend < AI_FA_MIN_SALARY) {
        break;
      }
    }

    const excluded = new Set<PlayerId>(
      Object.keys(getOwnedFranchise(current, teamId).explicitDecisions)
        .filter((key) => key.startsWith("declined_fa:"))
        .map((key) => key.slice("declined_fa:".length) as PlayerId),
    );
    const candidate = pickBestAffordableFreeAgent(current, teamId, capSpace, {
      excludePlayerIds: excluded,
      preferCheap: isRoutine || need.actionId === "SIGN_EMERGENCY_FA",
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
      decision,
      need,
      beforeSize,
    );
    if (signedOne === null) {
      break;
    }
    current = signedOne.state;
    events.push(...signedOne.events);
    signed += 1;
  }

  return { ...systemResult(current, events), didAct: signed > 0 };
}

function trySignFreeAgent(
  state: GameState,
  teamId: TeamId,
  candidate: Player,
  date: string,
  seasonYear: number,
  decision: PolicyDecision,
  need: ManagementNeed,
  beforeSize: number,
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

  const offerId = asOfferId(`offer_ai_cont_${teamId}_${candidate.id}_${date}`);
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
    const afterSize = current.world.teams[teamId]?.roster.length ?? beforeSize;
    events.push(
      createAiAssistLogEvent({
        decision,
        occurredOn: date,
        teamId,
        reason: need.detail,
        trigger: need.needKey,
        before: { availablePlayers: beforeSize },
        after: { availablePlayers: afterSize, playerId: candidate.id },
        playerId: candidate.id,
      }),
    );
    return systemResult(current, events);
  } catch {
    return null;
  }
}

function hireStaffForNeed(
  state: GameState,
  teamId: TeamId,
  date: string,
  need: ManagementNeed,
  decision: PolicyDecision,
): SystemResult & { didAct: boolean } {
  const role = need.metadata?.role as StaffRole | undefined;
  if (!role) {
    return { ...systemResult(state), didAct: false };
  }

  const declineKey = `declined_staff:${role}`;
  if (getOwnedFranchise(state, teamId).explicitDecisions[declineKey] === true) {
    return { ...systemResult(state), didAct: false };
  }
  if (findTeamStaffByRole(state, teamId, role) !== null) {
    return { ...systemResult(state), didAct: false };
  }

  const candidate = pickUnemployedStaff(state, role);
  if (candidate === undefined) {
    return { ...systemResult(state), didAct: false };
  }

  try {
    const hired = hireStaff(state, teamId, candidate.id);
    const events: DomainEvent[] = [
      ...hired.events,
      createAiAssistLogEvent({
        decision,
        occurredOn: date,
        teamId,
        reason: need.detail,
        trigger: need.needKey,
        before: { role, vacant: true },
        after: { staffId: candidate.id },
        staffId: candidate.id,
        role,
      }),
    ];
    return { ...systemResult(hired.state, events), didAct: true };
  } catch {
    return { ...systemResult(state), didAct: false };
  }
}

function pickDraftForNeed(
  state: GameState,
  teamId: TeamId,
  date: string,
  need: ManagementNeed,
  decision: PolicyDecision,
): SystemResult & { didAct: boolean } {
  if (!isUserOnDraftClock(state)) {
    return { ...systemResult(state), didAct: false };
  }

  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.status !== "active") {
    return { ...systemResult(state), didAct: false };
  }

  const onClock = draft.order.find((slot) => slot.status === "available");
  if (onClock === undefined || onClock.ownerTeamId !== teamId) {
    return { ...systemResult(state), didAct: false };
  }

  const key = `ai_continuity_draft:${onClock.draftPickId}`;
  if (hasAppliedGameplayConsequence(state, key)) {
    return { ...systemResult(state), didAct: false };
  }

  const prospectId = selectProspectForTeam(state, draft, teamId);
  if (prospectId === undefined) {
    return {
      ...systemResult(withAppliedGameplayConsequence(state, key)),
      didAct: false,
    };
  }

  const result = makeDraftSelection(state, {
    draftClassId,
    draftPickId: onClock.draftPickId,
    prospectPlayerId: prospectId,
    teamId,
  });
  if (!result.success) {
    return {
      ...systemResult(withAppliedGameplayConsequence(state, key)),
      didAct: false,
    };
  }

  let next = withAppliedGameplayConsequence(result.state, key);
  const events: DomainEvent[] = [
    ...result.events,
    createAiAssistLogEvent({
      decision,
      occurredOn: date,
      teamId,
      reason: need.detail,
      trigger: need.needKey,
      before: { onClock: true },
      after: { prospectPlayerId: prospectId },
      playerId: prospectId,
    }),
  ];
  return { ...systemResult(next, events), didAct: true };
}

function recommendDraftProspect(
  state: GameState,
  teamId: TeamId,
  date: string,
  decision: PolicyDecision,
): SystemResult {
  if (!isUserOnDraftClock(state)) {
    return systemResult(state);
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.status !== "active") {
    return systemResult(state);
  }
  const prospectId = selectProspectForTeam(state, draft, teamId);
  if (prospectId === undefined) {
    return systemResult(state);
  }
  return systemResult(state, [
    createAiAssistLogEvent({
      decision,
      occurredOn: date,
      teamId,
      reason: "Recommended draft prospect (no selection made)",
      trigger: "draft_scout",
      before: {},
      after: { recommendedPlayerId: prospectId },
      playerId: prospectId,
    }),
    createDomainEvent({
      type: "AiAssistAction",
      occurredOn: date,
      payload: {
        domain: "draft",
        action: "draft_recommend",
        reason: "Draft selection assistance is recommend-only.",
        playerId: prospectId,
      },
    }),
  ]);
}

function logRotationRepair(
  state: GameState,
  teamId: TeamId,
  date: string,
  need: ManagementNeed,
  decision: PolicyDecision,
): SystemResult & { didAct: boolean } {
  const recommended = recommendRosterManagement(state, teamId, {
    configuredBy: "ai",
  });
  const next = withTeamRosterManagement(state, teamId, recommended);
  const events = [
    createAiAssistLogEvent({
      decision,
      occurredOn: date,
      teamId,
      reason: need.detail,
      trigger: need.needKey,
      before: need.metadata ?? {},
      after: {
        lastConfiguredBy: "ai",
        starterCount: recommended.startingLineup.length,
      },
    }),
  ];
  return { ...systemResult(next, events), didAct: true };
}

function pickUnemployedStaff(
  state: GameState,
  role: StaffRole,
): { id: StaffId; overall: number } | undefined {
  const pool = Object.values(state.world.staff)
    .filter((staff) => staff.teamId === null && staff.role === role)
    .sort((a, b) => {
      if (b.overall !== a.overall) {
        return b.overall - a.overall;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const best = pool[0];
  return best === undefined
    ? undefined
    : { id: best.id, overall: best.overall };
}

function pickBestAffordableFreeAgent(
  state: GameState,
  teamId: TeamId,
  capSpace: number,
  options: {
    excludePlayerIds?: Set<PlayerId>;
    preferCheap?: boolean;
  } = {},
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
    if (options.preferCheap) {
      // Prefer mid-tier depth rather than stars (Smart boundary).
      const aScore = Math.abs(aOverall - 55);
      const bScore = Math.abs(bOverall - 55);
      if (aScore !== bScore) {
        return aScore - bScore;
      }
    } else if (bOverall !== aOverall) {
      return bOverall - aOverall;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  for (const player of ranked) {
    if (capSpace >= AI_FA_MIN_SALARY) {
      // Smart: never sign a "max-level" free agent under routine.
      if (options.preferCheap) {
        const overall = calculatePlayerOverall(player.position, player.attributes);
        if (overall >= 80) {
          continue;
        }
      }
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

function ensureAiAssistState(state: GameState, teamId: TeamId): GameState {
  if (getOwnedFranchise(state, teamId).aiAssistState !== undefined) {
    return state;
  }
  return withOwnedFranchise(state, teamId, (franchise) => ({
    ...franchise,
    aiAssistState: { ...EMPTY_AI_ASSIST_STATE },
  }));
}

function syncSeasonCounters(state: GameState, teamId: TeamId): GameState {
  const year = state.competition.season.year;
  const counters = getOwnedFranchise(state, teamId).aiAssistState.seasonCounters;
  if (counters.seasonYear === year) {
    return state;
  }
  return withOwnedFranchise(state, teamId, (franchise) => ({
    ...franchise,
    aiAssistState: {
      ...franchise.aiAssistState,
      seasonCounters: {
        seasonYear: year,
        decisions: 0,
        rosterMoves: 0,
        freeAgentSignings: 0,
      },
    },
  }));
}

function isNeedOnCooldown(
  assistState: AiAssistRuntimeState,
  needKey: string,
  date: string,
): boolean {
  const resolved = assistState.resolvedNeeds[needKey];
  if (!resolved?.cooldownUntil) {
    return false;
  }
  return date < resolved.cooldownUntil;
}

function markNeedResolved(
  state: GameState,
  teamId: TeamId,
  need: ManagementNeed,
  date: string,
  cooldownDays: number,
): GameState {
  const cooldownUntil =
    cooldownDays > 0 ? addCalendarDays(date, cooldownDays) : undefined;
  return withOwnedFranchise(state, teamId, (franchise) => ({
    ...franchise,
    aiAssistState: {
      ...franchise.aiAssistState,
      resolvedNeeds: {
        ...franchise.aiAssistState.resolvedNeeds,
        [need.needKey]: {
          resolvedOn: date,
          ...(cooldownUntil !== undefined ? { cooldownUntil } : {}),
        },
      },
    },
  }));
}

function incrementAssistCounters(
  state: GameState,
  teamId: TeamId,
  actionId: string,
): GameState {
  const counters = getOwnedFranchise(state, teamId).aiAssistState.seasonCounters;
  const freeAgent =
    actionId.includes("FA") ||
    actionId === "MAINTAIN_MIN_ROSTER" ||
    actionId === "SIGN_INJURY_REPLACEMENT";
  const rosterMove =
    freeAgent ||
    actionId.includes("RELEASE") ||
    actionId.includes("TRADE") ||
    actionId === "DRAFT_PICK";
  return withOwnedFranchise(state, teamId, (franchise) => ({
    ...franchise,
    aiAssistState: {
      ...franchise.aiAssistState,
      seasonCounters: {
        ...counters,
        decisions: counters.decisions + 1,
        freeAgentSignings: counters.freeAgentSignings + (freeAgent ? 1 : 0),
        rosterMoves: counters.rosterMoves + (rosterMove ? 1 : 0),
      },
    },
  }));
}
