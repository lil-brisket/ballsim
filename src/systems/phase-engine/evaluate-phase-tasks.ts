import {
  getContractStatus,
} from "@/domain/entities/contract";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { evaluatePhaseFocus } from "@/systems/phase-engine/evaluate-phase-focus";
import { getActivePhaseId } from "@/systems/phase-engine/resolve-current-phase";
import {
  analyzeTeamPhaseContext,
} from "@/systems/phase-engine/team-context";
import type {
  ActionPriority,
  DismissedRecommendation,
  FranchisePhaseState,
  LeaguePhaseId,
  PhaseAttentionSummary,
  PhaseTask,
} from "@/systems/phase-engine/phase-types";

/**
 * Derive required / recommended / optional tasks from game state.
 * Completion is never persisted — game actions are the source of truth.
 * Dismissals only hide recommendations temporarily.
 */
export function evaluatePhaseTasks(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): PhaseAttentionSummary {
  const phaseId = getActivePhaseId(state);
  const tasks = buildTasksForPhase(state, teamId, phaseId);
  const franchiseState = state.user.franchisePhaseState?.[teamId];
  const filtered = applyDismissals(tasks, franchiseState, phaseId);

  const required = filtered.filter((task) => task.priority === "required");
  const recommended = filtered.filter(
    (task) => task.priority === "recommended",
  );
  const optional = filtered.filter((task) => task.priority === "optional");

  return {
    required,
    recommended,
    optional,
    counts: {
      required: required.length,
      recommended: recommended.length,
      optional: optional.length,
    },
  };
}

export function evaluatePhaseTasksForOwnedTeams(
  state: GameState,
): Record<string, PhaseAttentionSummary> {
  const result: Record<string, PhaseAttentionSummary> = {};
  for (const teamId of state.user.ownedTeamIds) {
    result[teamId] = evaluatePhaseTasks(state, teamId);
  }
  return result;
}

function buildTasksForPhase(
  state: GameState,
  teamId: TeamId,
  phaseId: LeaguePhaseId,
): PhaseTask[] {
  const tasks: PhaseTask[] = [];
  const saveId = state.meta.saveId;
  const context = analyzeTeamPhaseContext(state, teamId);

  // Pending owner decisions — required when this franchise participates.
  for (const decision of state.user.pendingOwnerDecisions) {
    if (!decision.participantTeamIds.includes(teamId)) {
      continue;
    }
    const isBlocking = decision.blockingLevel === "blocking";
    tasks.push({
      taskKey: `owner_decision:${decision.id}`,
      type: "owner_decision",
      subject: decision.id,
      phaseId,
      priority: isBlocking ? "required" : "recommended",
      title:
        decision.type === "trade_offer"
          ? "Respond to trade offer"
          : "Pending decision",
      detail: isBlocking
        ? "This decision pauses simulation until you resolve it."
        : "A decision is waiting for your attention.",
      explanation:
        decision.type === "trade_offer"
          ? "Another team proposed a trade involving your franchise."
          : "An owner decision requires your response.",
      href: `/dashboard/${saveId}`,
      teamId,
    });
  }

  if (phaseId === "offseason.roster_decisions") {
    tasks.push(...rosterDecisionTasks(state, teamId, phaseId, saveId));
  }

  if (phaseId === "offseason.draft_preparation") {
    if (context.bestDraftPick !== null) {
      tasks.push({
        taskKey: `scout_needs:${teamId}`,
        type: "scout_prospect",
        phaseId,
        priority: "recommended",
        title: "Scout prospects matching roster needs",
        detail:
          context.weakestPositions.length > 0
            ? `Focus on ${context.weakestPositions.slice(0, 2).join(" / ")}.`
            : "Build your draft board before the draft begins.",
        explanation:
          context.bestDraftPick !== null
            ? `You hold pick #${context.bestDraftPick}; scouting now improves draft-day decisions.`
            : "Scouting prepares you for trades and draft-day value.",
        href: `/dashboard/${saveId}/draft`,
        teamId,
        focusKey: "draft_pick",
      });
    }
    tasks.push({
      taskKey: `review_team_needs:${teamId}`,
      type: "team_needs",
      phaseId,
      priority: "recommended",
      title: "Review team needs",
      detail: "Confirm which positions you want to address in the draft.",
      explanation:
        "Draft prep is most effective when tied to clear roster priorities.",
      href: `/dashboard/${saveId}/roster`,
      teamId,
    });
    tasks.push({
      taskKey: `optional_trades_prep:${teamId}`,
      type: "trades",
      phaseId,
      priority: "optional",
      title: "Explore pick trades",
      detail: "Move up, back, or acquire extra picks.",
      explanation: "Trades are available but not required to advance.",
      href: `/dashboard/${saveId}/team-management/transactions`,
      teamId,
    });
  }

  if (phaseId === "offseason.draft") {
    if (isUserOnDraftClock(state)) {
      const draftYear = draftYearForSeason(state.competition.season.year);
      const draft = state.world.drafts[draftClassIdFor(draftYear)];
      const onClock = draft?.order.find((slot) => slot.status === "available");
      if (onClock && onClock.ownerTeamId === teamId) {
        tasks.push({
          taskKey: `draft_clock:${onClock.draftPickId}`,
          type: "draft_pick",
          subject: onClock.draftPickId,
          phaseId,
          priority: "required",
          title: "Make your draft pick",
          detail: `You are on the clock at overall pick #${onClock.overallPick}.`,
          explanation:
            "The draft cannot advance past your pick until you select a prospect.",
          href: `/dashboard/${saveId}/draft`,
          teamId,
          focusKey: "draft_pick",
        });
      }
    } else if (context.bestDraftPick !== null) {
      tasks.push({
        taskKey: `await_draft:${teamId}`,
        type: "draft_wait",
        phaseId,
        priority: "recommended",
        title: "Prepare for your next pick",
        detail: `Your next selection is #${context.bestDraftPick}.`,
        explanation:
          "Monitor the board and be ready when your pick approaches.",
        href: `/dashboard/${saveId}/draft`,
        teamId,
      });
    }
  }

  if (phaseId === "offseason.free_agency") {
    if (context.weakestPositions.length > 0) {
      const position = context.weakestPositions[0]!;
      const strength = context.positionalStrengths.find(
        (entry) => entry.position === position,
      );
      tasks.push({
        taskKey: `roster_need:${position}:free_agency`,
        type: "roster_need",
        subject: position,
        phaseId,
        priority: "recommended",
        title: `Review ${position} free agents`,
        detail: "Fill a clear roster weakness through free agency.",
        explanation: strength
          ? `Your starting ${position} is rated ${strength.bestOverall} (league avg ${strength.leaguePositionalAvg}).`
          : `You need help at ${position}.`,
        href: `/dashboard/${saveId}/free-agency`,
        teamId,
        focusKey: `fa_need:${position}`,
      });
    }
    tasks.push({
      taskKey: `fa_budget:${teamId}`,
      type: "budget",
      phaseId,
      priority: "recommended",
      title: "Review player budget",
      detail: `Cap space ≈ $${Math.round(context.capSpace / 1_000_000)}M.`,
      explanation:
        "Stay within your budget while addressing roster priorities.",
      href: `/dashboard/${saveId}/finances`,
      teamId,
      focusKey: "cap_space",
    });
    tasks.push({
      taskKey: `optional_fa_trades:${teamId}`,
      type: "trades",
      phaseId,
      priority: "optional",
      title: "Explore trades",
      detail: "Trades remain available during free agency.",
      explanation: "Optional — use only if it improves roster construction.",
      href: `/dashboard/${saveId}/team-management/transactions`,
      teamId,
    });
  }

  if (phaseId === "offseason.staff_development") {
    for (const role of context.vacantStaffRoles) {
      tasks.push({
        taskKey: `staff_gap:${role}`,
        type: "staff_hire",
        subject: role,
        phaseId,
        priority: "recommended",
        title: `Hire ${role.replaceAll("_", " ")}`,
        detail: "Fill a vacant starter staff role.",
        explanation:
          "Empty staff roles reduce development and organizational quality.",
        href: `/dashboard/${saveId}/staff`,
        teamId,
        focusKey: "staff_vacancies",
      });
    }
    tasks.push({
      taskKey: `optional_staff_review:${teamId}`,
      type: "staff_review",
      phaseId,
      priority: "optional",
      title: "Review staff and development",
      detail: "Upgrade roles or adjust priorities.",
      explanation: "Optional fine-tuning before preseason.",
      href: `/dashboard/${saveId}/staff`,
      teamId,
    });
  }

  if (phaseId === "preseason.preparation") {
    tasks.push({
      taskKey: `preseason_rotation:${teamId}`,
      type: "rotation",
      phaseId,
      priority: "recommended",
      title: "Set rotations and lineups",
      detail: "Confirm depth chart before opening night.",
      explanation:
        "A configured rotation avoids early-season lineup issues.",
      href: `/dashboard/${saveId}/team-management/rotations`,
      teamId,
      focusKey: "preseason_prep",
    });
    tasks.push({
      taskKey: `optional_preseason_roster:${teamId}`,
      type: "roster",
      phaseId,
      priority: "optional",
      title: "Review final roster",
      detail: "Cut or adjust fringe players if needed.",
      explanation: "Optional — only if roster construction still needs work.",
      href: `/dashboard/${saveId}/roster`,
      teamId,
    });
  }

  // Optional cross-phase shortcuts when focus exists
  const focus = evaluatePhaseFocus(state, teamId);
  if (
    focus.some((item) => item.focusKey.startsWith("weak_position")) &&
    phaseId === "offseason.roster_decisions"
  ) {
    tasks.push({
      taskKey: `optional_roster_eval:${teamId}`,
      type: "roster",
      phaseId,
      priority: "optional",
      title: "Explore trade targets",
      detail: "Address roster weakness via trades before the draft.",
      explanation: "Optional — draft and free agency can also fill holes.",
      href: `/dashboard/${saveId}/team-management/transactions`,
      teamId,
    });
  }

  return tasks;
}

function rosterDecisionTasks(
  state: GameState,
  teamId: TeamId,
  phaseId: LeaguePhaseId,
  saveId: string,
): PhaseTask[] {
  const year = state.competition.season.year;
  const tasks: PhaseTask[] = [];

  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    const status = getContractStatus(contract, year);
    if (status === "team_option" || status === "player_option") {
      const player = state.world.players[contract.playerId];
      const name = player
        ? `${player.firstName} ${player.lastName}`
        : "Player";
      const optionKind =
        status === "team_option" ? "team option" : "player option";
      tasks.push({
        taskKey: `contract_option:${contract.id}`,
        type: "contract_option",
        subject: contract.playerId,
        phaseId,
        priority: "required",
        title: `Resolve ${name}'s ${optionKind}`,
        detail: `Exercise or decline the pending ${optionKind}.`,
        explanation:
          "Unresolved options block advancing past Roster Decisions.",
        href: `/dashboard/${saveId}/contracts`,
        teamId,
        focusKey: "pending_options",
      });
    } else if (
      status === "active" &&
      contract.endYear === year
    ) {
      const player = state.world.players[contract.playerId];
      const name = player
        ? `${player.firstName} ${player.lastName}`
        : "Player";
      tasks.push({
        taskKey: `expiring:${contract.id}`,
        type: "expiring_contract",
        subject: contract.playerId,
        phaseId,
        priority: "recommended",
        title: `Review ${name}'s expiring contract`,
        detail: "Consider extension, trade, or letting them reach free agency.",
        explanation: `${name} is in the final year of their contract.`,
        href: `/dashboard/${saveId}/contracts`,
        teamId,
        focusKey: "expiring_contracts",
      });
    }
  }

  return tasks;
}

function applyDismissals(
  tasks: PhaseTask[],
  franchiseState: FranchisePhaseState | undefined,
  phaseId: LeaguePhaseId,
): PhaseTask[] {
  if (!franchiseState || franchiseState.dismissed.length === 0) {
    return tasks;
  }
  const dismissedKeys = new Set<string>();
  for (const entry of franchiseState.dismissed) {
    if (!isDismissalActive(entry, phaseId)) {
      continue;
    }
    // Required tasks cannot be dismissed
    dismissedKeys.add(entry.taskKey);
  }
  return tasks.filter((task) => {
    if (task.priority === "required") {
      return true;
    }
    return !dismissedKeys.has(task.taskKey);
  });
}

function isDismissalActive(
  entry: DismissedRecommendation,
  phaseId: LeaguePhaseId,
): boolean {
  if (entry.dismissedUntil === "phase_end") {
    return entry.phaseId === phaseId;
  }
  if (entry.dismissedUntil === "date") {
    return true; // date check applied by caller with calendar if needed
  }
  // condition_change: keep dismissed until evaluator stops producing the key
  return entry.phaseId === phaseId;
}

export function countPriority(
  summary: PhaseAttentionSummary,
  priority: ActionPriority,
): number {
  return summary.counts[priority];
}
