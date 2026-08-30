import type { ContractInput } from "@/domain/entities/contract";
import type { DraftClass } from "@/domain/entities/draft";
import type { Player, PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { DomainEvent } from "@/domain/events";
import {
  asContractId,
  asOfferId,
  type PlayerId,
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
  resolveFranchisePreferences,
  type EffectivePreferences,
} from "@/systems/franchise-ai-preferences";
import {
  AI_FA_CAP_FRACTION_MAX,
  AI_FA_CAP_FRACTION_MIN,
  AI_VETERAN_AGE_MIN,
  AI_YOUTH_AGE_MAX,
  boundedPreferenceDelta,
} from "@/systems/franchise-ai-preferences-config";
import {
  AI_FA_MAX_SALARY,
  AI_FA_MIN_SALARY,
} from "@/systems/owner-objectives-config";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import {
  draftYearForSeason,
  makeDraftSelection,
} from "@/systems/draft";
import {
  addToTradeBlock,
  evaluateTradeOffer,
  executeTrade,
  generateAiTradeProposal,
  getTradeBlock,
} from "@/systems/trades";
import {
  getActiveOwnerDecision,
  tryEnqueueCpuToUserTradeOffer,
} from "@/systems/owner-decisions";
import { tryEnqueueAnyOwnedTeamTradeOffer } from "@/systems/owner-decisions/owned-team-trade-offer";
import { isUserControlledTeam } from "@/state/owner-context";
import { selectProspectFromTeamScouting } from "@/systems/draft/mock-draft";
import {
  recommendRosterManagement,
  reconcileRosterManagement,
  withTeamRosterManagement,
} from "@/systems/roster-management";
import {
  isDraftAiPhase,
  isFreeAgencyAiPhase,
} from "@/systems/phase-engine";

export { isUserControlledTeam };

const REQUIRED_POSITIONS: readonly PlayerPosition[] = PLAYER_POSITIONS;
/**
 * Deterministic AI decisions for non-user teams.
 * Uses shared EffectivePreferences with owner AI. Never mutates the user team.
 * Cap/legality remain hard constraints. Inaction is valid.
 */
export function runAiTeamDecisions(state: GameState, _rng: Rng): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  if (current.competition.season.phase === "offseason") {
    if (isFreeAgencyAiPhase(current)) {
      const fa = runAiFreeAgency(current);
      current = fa.state;
      events.push(...fa.events);
    }
    if (isDraftAiPhase(current)) {
      const draft = runAiDraft(current);
      current = draft.state;
      events.push(...draft.events);
    }
  }

  const calendar = getCalendarContext(current);
  const phase = current.competition.season.phase;
  const playerTradesAllowed =
    calendar.tradesOpen || phase === "offseason" || phase === "preseason";
  if (playerTradesAllowed) {
    const trade = runAiTrades(current);
    current = trade.state;
    events.push(...trade.events);
  }

  current = maintainAiRosterManagement(current);

  return systemResult(current, events);
}

/**
 * CPU teams: ensure rosterManagement stays valid after roster churn.
 * Never touches user-controlled franchises.
 */
function maintainAiRosterManagement(state: GameState): GameState {
  let current = state;
  const teamIds = (Object.keys(current.world.teams) as TeamId[])
    .filter((teamId) => !isUserControlledTeam(current, teamId))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const teamId of teamIds) {
    const management = current.world.teams[teamId]?.rosterManagement;
    if (management == null || management.startingLineup.length < 5) {
      const recommended = recommendRosterManagement(current, teamId, {
        configuredBy: "ai",
      });
      current = withTeamRosterManagement(current, teamId, recommended);
      continue;
    }
    if (management.lastConfiguredBy === "user") {
      continue;
    }
    current = reconcileRosterManagement(current, teamId);
  }
  return current;
}

function runAiFreeAgency(state: GameState): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const date = current.world.calendar.currentDate;
  const seasonYear = current.competition.season.year;
  const teamIds = (Object.keys(current.world.teams) as TeamId[])
    .filter((teamId) => !isUserControlledTeam(current, teamId))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const teamId of teamIds) {
    const key = `ai_fa:${teamId}:${date}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }
    if (!teamNeedsSigning(current, teamId)) {
      current = withAppliedGameplayConsequence(current, key);
      continue;
    }

    const resolved = resolveFranchisePreferences(current, teamId);
    const prefs = resolved?.preferences;
    // Conservative / cash-preserving: may skip non-urgent FA (inaction)
    if (
      prefs &&
      prefs.cashPreservation > 0.7 &&
      prefs.spendWillingness < 0.4 &&
      prefs.patiencePressure < 0.55 &&
      !teamUrgentlyNeedsSigning(current, teamId)
    ) {
      current = withAppliedGameplayConsequence(current, key);
      continue;
    }

    const capSpace = current.settings.financialRules.salaryCapEnabled
      ? getTeamCapSpace(teamId, seasonYear, current)
      : Number.MAX_SAFE_INTEGER;
    if (capSpace < AI_FA_MIN_SALARY) {
      current = withAppliedGameplayConsequence(current, key);
      continue;
    }

    const candidate = pickBestAffordableFreeAgent(
      current,
      teamId,
      capSpace,
      prefs,
    );
    if (candidate === undefined) {
      current = withAppliedGameplayConsequence(current, key);
      continue;
    }

    const fraction = faSalaryCapFraction(prefs);
    const salary = Math.min(
      AI_FA_MAX_SALARY,
      Math.max(AI_FA_MIN_SALARY, Math.floor(capSpace * fraction)),
    );
    if (salary > capSpace) {
      current = withAppliedGameplayConsequence(current, key);
      continue;
    }

    const offerId = asOfferId(`offer_ai_${teamId}_${candidate.id}_${date}`);
    const contractId = asContractId(
      `contract_ai_${candidate.id}_${date.replaceAll("-", "")}`,
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
    } catch {
      // Cap/interest/roster failures: skip without throwing out of the day loop.
    }
    current = withAppliedGameplayConsequence(current, key);
  }

  return systemResult(current, events);
}

function faSalaryCapFraction(prefs: EffectivePreferences | undefined): number {
  if (!prefs) {
    return (AI_FA_CAP_FRACTION_MIN + AI_FA_CAP_FRACTION_MAX) / 2;
  }
  const t = prefs.spendWillingness;
  return (
    AI_FA_CAP_FRACTION_MIN +
    (AI_FA_CAP_FRACTION_MAX - AI_FA_CAP_FRACTION_MIN) * t
  );
}

function runAiDraft(state: GameState): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const draftYear = draftYearForSeason(current.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  let draft = current.world.drafts[draftClassId];
  if (draft === undefined || draft.status !== "active") {
    return systemResult(current);
  }

  while (true) {
    draft = current.world.drafts[draftClassId] as DraftClass;
    const onClock = draft.order.find((slot) => slot.status === "available");
    if (onClock === undefined) {
      break;
    }
    if (isUserControlledTeam(current, onClock.ownerTeamId)) {
      break;
    }
    const key = `ai_draft:${onClock.draftPickId}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      break;
    }

    const prospectId = selectProspectForTeam(
      current,
      draft,
      onClock.ownerTeamId,
    );
    if (prospectId === undefined) {
      current = withAppliedGameplayConsequence(current, key);
      break;
    }

    const result = makeDraftSelection(current, {
      draftClassId,
      draftPickId: onClock.draftPickId,
      prospectPlayerId: prospectId,
      teamId: onClock.ownerTeamId,
    });
    if (!result.success) {
      current = withAppliedGameplayConsequence(current, key);
      break;
    }
    current = result.state;
    events.push(...result.events);
    current = withAppliedGameplayConsequence(current, key);
  }

  return systemResult(current, events);
}

function runAiTrades(state: GameState): SystemResult {
  const date = state.world.calendar.currentDate;
  const key = `ai_trade:${date}`;
  if (hasAppliedGameplayConsequence(state, key)) {
    return systemResult(state);
  }

  const calendar = getCalendarContext(state);
  let current = state;
  const teamIds = (Object.keys(current.world.teams) as TeamId[])
    .filter((teamId) => !isUserControlledTeam(current, teamId))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let queuedUserOffer = false;

  for (const teamId of teamIds) {
    const resolved = resolveFranchisePreferences(current, teamId);
    const prefs = resolved?.preferences;
    if (!prefs) {
      continue;
    }

    // Calendar pressure modifies urgency; it does not override identity.
    // Deadline window: lower skip thresholds without forcing every team to act.
    const deadlineBoost = calendar.deadlineWindow ? 0.12 : 0;
    const skipRisk = 0.35 - deadlineBoost * (prefs.riskAppetite > 0.5 ? 1 : 0.4);
    const skipPatience =
      0.45 - deadlineBoost * (prefs.patiencePressure > 0.4 ? 1 : 0.3);
    const skipWinNow =
      0.55 - deadlineBoost * (prefs.winNowPressure > prefs.rebuildPressure ? 1 : 0);

    if (
      prefs.riskAppetite < skipRisk &&
      prefs.patiencePressure < skipPatience &&
      prefs.winNowPressure < skipWinNow
    ) {
      continue;
    }

    // Rebuilders sell more readily near the deadline; contenders list less surplus.
    if (calendar.deadlineWindow && prefs.rebuildPressure > prefs.winNowPressure) {
      current = ensureSurplusOnBlock(current, teamId, prefs);
    } else if (!calendar.deadlineWindow || prefs.winNowPressure >= 0.5) {
      current = ensureSurplusOnBlock(current, teamId, prefs);
    }

    // Prefer a meaningful offer to the user when none is already pending.
    if (!queuedUserOffer && !getActiveOwnerDecision(current.user)) {
      const userOffer = tryEnqueueCpuToUserTradeOffer(current, teamId);
      if (userOffer.outcome === "queued") {
        current = userOffer.state;
        queuedUserOffer = true;
        // Continue scanning for a possible CPU↔CPU trade the same day;
        // user offer already caps further user-facing queues.
        continue;
      }
    }

    const proposal = generateAiTradeProposal(current, teamId);
    if (proposal === undefined) {
      continue;
    }
    if (
      isUserControlledTeam(current, proposal.sideA.teamId) ||
      isUserControlledTeam(current, proposal.sideB.teamId)
    ) {
      // User-involved proposals from the block finder are not auto-executed.
      continue;
    }

    const evalA = evaluateTradeOffer(current, proposal.sideA.teamId, proposal);
    const evalB = evaluateTradeOffer(current, proposal.sideB.teamId, proposal);
    if (!evalA.accepted || !evalB.accepted) {
      continue;
    }

    const executed = executeTrade(current, proposal);
    if (!executed.success) {
      continue;
    }
    current = withAppliedGameplayConsequence(executed.state, key);
    return systemResult(current, executed.events);
  }

  if (!queuedUserOffer && !getActiveOwnerDecision(current.user)) {
    const ownedOffer = tryEnqueueAnyOwnedTeamTradeOffer(current);
    if (ownedOffer.outcome === "queued") {
      current = ownedOffer.state;
      return systemResult(current);
    }
  }

  return systemResult(withAppliedGameplayConsequence(current, key));
}

function ensureSurplusOnBlock(
  state: GameState,
  teamId: TeamId,
  prefs: EffectivePreferences | undefined,
): GameState {
  const block = getTradeBlock(state, teamId);
  if (block.assets.some((asset) => asset.kind === "player")) {
    return state;
  }
  const surplus = findSurplusPlayer(state, teamId, prefs);
  if (surplus === undefined) {
    return state;
  }
  if (
    block.assets.some(
      (asset) => asset.kind === "player" && asset.playerId === surplus,
    )
  ) {
    return state;
  }
  return addToTradeBlock(state, teamId, {
    kind: "player",
    playerId: surplus,
  }).state;
}

function teamNeedsSigning(state: GameState, teamId: TeamId): boolean {
  const team = state.world.teams[teamId];
  if (!team) {
    return false;
  }
  if (team.roster.length < DEFAULT_ROSTER_SIZE) {
    return true;
  }
  return missingPositions(state, teamId).length > 0;
}

function teamUrgentlyNeedsSigning(state: GameState, teamId: TeamId): boolean {
  const team = state.world.teams[teamId];
  if (!team) {
    return false;
  }
  return (
    team.roster.length < DEFAULT_ROSTER_SIZE - 2 ||
    missingPositions(state, teamId).length > 0
  );
}

function missingPositions(state: GameState, teamId: TeamId): PlayerPosition[] {
  const counts = positionCounts(state, teamId);
  return REQUIRED_POSITIONS.filter((position) => (counts.get(position) ?? 0) === 0);
}

function positionCounts(
  state: GameState,
  teamId: TeamId,
): Map<PlayerPosition, number> {
  const counts = new Map<PlayerPosition, number>();
  for (const position of REQUIRED_POSITIONS) {
    counts.set(position, 0);
  }
  const team = state.world.teams[teamId];
  if (!team) {
    return counts;
  }
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  return counts;
}

function freeAgentPreferenceScore(
  player: Player,
  prefs: EffectivePreferences | undefined,
): number {
  const overall = calculatePlayerOverall(player.position, player.attributes);
  if (!prefs) {
    return overall;
  }
  let score = overall;
  if (player.age <= AI_YOUTH_AGE_MAX) {
    score += boundedPreferenceDelta(prefs.youthValue, 8);
    // Development orgs prefer high-potential / early-stage players.
    score += boundedPreferenceDelta(prefs.developmentPriority, 4);
    const potentialGap = player.potential.overall - overall;
    if (potentialGap > 0) {
      score += potentialGap * prefs.youthValue * 0.35;
    }
    if (player.development.stage === "developing") {
      score += boundedPreferenceDelta(prefs.developmentPriority, 3);
    }
  } else if (player.age >= AI_VETERAN_AGE_MIN) {
    score += boundedPreferenceDelta(prefs.establishedPlayerValue, 8);
    score += boundedPreferenceDelta(prefs.winNowPressure, 4);
    // Asset/rebuild orgs discount veterans more heavily.
    score -= boundedPreferenceDelta(prefs.rebuildPressure, 5);
    score -= boundedPreferenceDelta(prefs.pickValue, 2);
  }
  return score;
}

function pickBestAffordableFreeAgent(
  state: GameState,
  teamId: TeamId,
  capSpace: number,
  prefs: EffectivePreferences | undefined,
): Player | undefined {
  const missing = missingPositions(state, teamId);
  const pool = listFreeAgents(state).playerIds
    .map((playerId) => state.world.players[playerId])
    .filter((player): player is Player => player !== undefined);

  const ranked = [...pool].sort((a, b) => {
    const aMissing = missing.includes(a.position) ? 0 : 1;
    const bMissing = missing.includes(b.position) ? 0 : 1;
    if (aMissing !== bMissing) {
      return aMissing - bMissing;
    }
    const scoreA = freeAgentPreferenceScore(a, prefs);
    const scoreB = freeAgentPreferenceScore(b, prefs);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const fraction = faSalaryCapFraction(prefs);
  for (const player of ranked) {
    const salary = Math.min(
      AI_FA_MAX_SALARY,
      Math.max(AI_FA_MIN_SALARY, Math.floor(capSpace * fraction)),
    );
    if (salary <= capSpace) {
      return player;
    }
  }
  return undefined;
}

/**
 * Draft *selection* preference using THIS team's scouting estimates + needs.
 * Never reads authoritative player attributes/potential for ranking.
 */
export function selectProspectForTeam(
  state: GameState,
  draft: DraftClass,
  teamId: TeamId,
): PlayerId | undefined {
  const available = Object.values(draft.prospects).filter(
    (prospect) => prospect.status === "eligible",
  );
  if (available.length === 0) {
    return undefined;
  }
  const eligibleIds = new Set(available.map((p) => p.playerId as string));
  const fromScouting = selectProspectFromTeamScouting(
    state,
    draft,
    teamId,
    eligibleIds,
  );
  if (fromScouting !== undefined) {
    return fromScouting;
  }
  // Fallback only when team has no scouting data (migrated incomplete draft):
  // use projected rank midpoints from any estimate, else stable id order — still
  // avoid true overall by sorting on playerId only.
  return available
    .slice()
    .sort((a, b) =>
      a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0,
    )[0]!.playerId;
}

function findSurplusPlayer(
  state: GameState,
  teamId: TeamId,
  prefs: EffectivePreferences | undefined,
): PlayerId | undefined {
  const counts = positionCounts(state, teamId);
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }
  if (maxCount <= 1) {
    return undefined;
  }
  const surplusPositions = REQUIRED_POSITIONS.filter(
    (position) => (counts.get(position) ?? 0) === maxCount,
  );
  const team = state.world.teams[teamId];
  if (!team) {
    return undefined;
  }
  const candidates = team.roster
    .map((playerId) => state.world.players[playerId])
    .filter((player): player is Player => player !== undefined)
    .filter((player) => surplusPositions.includes(player.position))
    .sort((a, b) => {
      // Rebuild / cash-poor: prefer trading older / lower youth value first
      if (prefs) {
        const ageBiasA =
          a.age >= AI_VETERAN_AGE_MIN
            ? -boundedPreferenceDelta(prefs.rebuildPressure, 5)
            : boundedPreferenceDelta(prefs.youthValue, 3);
        const ageBiasB =
          b.age >= AI_VETERAN_AGE_MIN
            ? -boundedPreferenceDelta(prefs.rebuildPressure, 5)
            : boundedPreferenceDelta(prefs.youthValue, 3);
        const scoreA =
          calculatePlayerOverall(a.position, a.attributes) + ageBiasA;
        const scoreB =
          calculatePlayerOverall(b.position, b.attributes) + ageBiasB;
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
      }
      const overallA = calculatePlayerOverall(a.position, a.attributes);
      const overallB = calculatePlayerOverall(b.position, b.attributes);
      if (overallA !== overallB) {
        return overallA - overallB;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  return candidates[0]?.id;
}
