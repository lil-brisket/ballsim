import { playoffRoundLabel } from "@/domain/entities/playoffs";
import type { GameState } from "@/state/game-state";
import { getOwnedFranchiseAssistance } from "@/state/owner-context";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import {
  detectManagementNeeds,
  type ManagementNeed,
} from "@/systems/simulation/management-needs";
import {
  buildManagementPolicy,
  evaluateAction,
  isFullDelegation,
  isUserAssistCompletelyOff,
  type PolicyOutcome,
} from "@/systems/simulation/management-policy";
import type { ManagementPhase } from "@/domain/ai-management-presets";

export type UnresolvedDecision = {
  id: string;
  domain: ManagementPhase | "rosterFilling" | "staffHiring" | "draft";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  policyOutcome?: PolicyOutcome;
};

export type PhaseResponsibility = {
  phaseKey: string;
  owner: "user" | "ai" | "unresolved";
  unresolvedCount: number;
  unresolvedItems: UnresolvedDecision[];
};

/**
 * Derived ownership of the current phase decisions for the user franchise.
 * Does NOT implement AI permission logic — delegates to management-policy.
 */
export function computePhaseResponsibility(
  state: GameState,
): PhaseResponsibility {
  const phaseKey = phaseKeyForResponsibility(state);
  const needs = detectManagementNeeds(state);
  const franchiseAssist = getOwnedFranchiseAssistance(state);
  const unresolvedItems = toUnresolvedDecisions(state, needs, franchiseAssist);
  const unresolvedCount = unresolvedItems.length;
  const aiOwnsAll = isFullDelegation(state.settings, franchiseAssist);

  if (unresolvedCount === 0) {
    return {
      phaseKey,
      owner: aiOwnsAll ? "ai" : "user",
      unresolvedCount: 0,
      unresolvedItems: [],
    };
  }

  if (isUserAssistCompletelyOff(state.settings, franchiseAssist)) {
    return {
      phaseKey,
      owner: "user",
      unresolvedCount,
      unresolvedItems,
    };
  }

  const blocking = unresolvedItems.filter(
    (item) =>
      item.policyOutcome === "DENY_BLOCK" ||
      item.policyOutcome === "RECOMMEND",
  );

  if (aiOwnsAll) {
    const allAllowable = unresolvedItems.every(
      (item) => item.policyOutcome === "ALLOW",
    );
    if (allAllowable) {
      return {
        phaseKey,
        owner: "ai",
        unresolvedCount,
        unresolvedItems,
      };
    }
    if (blocking.length > 0) {
      return {
        phaseKey,
        owner: "unresolved",
        unresolvedCount,
        unresolvedItems,
      };
    }
    return {
      phaseKey,
      owner: "ai",
      unresolvedCount,
      unresolvedItems,
    };
  }

  // Partial delegation: any DENY_BLOCK or RECOMMEND that still needs
  // a user decision surfaces as unresolved.
  if (blocking.length > 0) {
    return {
      phaseKey,
      owner: "unresolved",
      unresolvedCount,
      unresolvedItems,
    };
  }

  const anyAllow = unresolvedItems.some(
    (item) => item.policyOutcome === "ALLOW",
  );
  if (anyAllow && unresolvedItems.every((i) => i.policyOutcome === "ALLOW")) {
    return {
      phaseKey,
      owner: "ai",
      unresolvedCount,
      unresolvedItems,
    };
  }

  return {
    phaseKey,
    owner: "unresolved",
    unresolvedCount,
    unresolvedItems,
  };
}

function toUnresolvedDecisions(
  state: GameState,
  needs: ManagementNeed[],
  franchiseAssist = getOwnedFranchiseAssistance(state),
): UnresolvedDecision[] {
  if (needs.length === 0) {
    return [];
  }
  const policy = buildManagementPolicy(state.settings, franchiseAssist);
  const items: UnresolvedDecision[] = [];

  for (const need of needs) {
    // Draft scout is informational when on clock — don't double-count with pick.
    if (need.actionId === "DRAFT_SCOUT") {
      continue;
    }

    const decision = evaluateAction(policy, need.actionId);
    // DENY_CONTINUE needs are not "unresolved" for the user — sim continues.
    if (decision.outcome === "DENY_CONTINUE") {
      continue;
    }
    // ALLOW means AI can handle — still list for full-delegation visibility,
    // but critical user-facing unresolved are BLOCK/RECOMMEND.
    if (
      decision.outcome === "ALLOW" &&
      !isFullDelegation(state.settings, franchiseAssist)
    ) {
      // Partial delegation will handle ALLOW needs; only surface if critical
      // and we're in a mode where AI might not run before advance stops.
      continue;
    }

    items.push({
      id: need.id,
      domain: legacyDomainAlias(need),
      severity: need.severity,
      title: need.title,
      detail: need.detail,
      policyOutcome: decision.outcome,
    });
  }

  // Always surface DENY_BLOCK / RECOMMEND for mandatory needs (draft clock).
  for (const need of needs) {
    if (need.actionId === "DRAFT_SCOUT") {
      continue;
    }
    const decision = evaluateAction(policy, need.actionId);
    if (
      decision.outcome === "DENY_BLOCK" ||
      decision.outcome === "RECOMMEND"
    ) {
      if (!items.some((item) => item.id === need.id)) {
        items.push({
          id: need.id,
          domain: legacyDomainAlias(need),
          severity: need.severity,
          title: need.title,
          detail: need.detail,
          policyOutcome: decision.outcome,
        });
      }
    }
  }

  return items;
}

function legacyDomainAlias(
  need: ManagementNeed,
): UnresolvedDecision["domain"] {
  switch (need.actionId) {
    case "DRAFT_PICK":
    case "DRAFT_SCOUT":
      return "draft";
    case "HIRE_REQUIRED_COACH":
    case "HIRE_REQUIRED_FRONT_OFFICE":
    case "HIRE_ROUTINE_STAFF":
      return "staffHiring";
    case "MAINTAIN_MIN_ROSTER":
    case "SIGN_INJURY_REPLACEMENT":
    case "SIGN_EMERGENCY_FA":
    case "SIGN_ROUTINE_FA":
      return "rosterFilling";
    default:
      return need.actionId === "FIX_INVALID_ROTATION"
        ? "rotationsDepthChart"
        : "injuriesEmergencyRoster";
  }
}

function phaseKeyForResponsibility(state: GameState): string {
  const season = state.competition.season;
  if (season.phase === "preseason") {
    return "preseason";
  }
  if (season.phase === "regular") {
    return getCalendarContext(state).seasonSegment === "deadline_window"
      ? "trade_deadline"
      : "regular";
  }
  if (season.phase === "playoffs") {
    const playoffs = state.competition.playoffs;
    if (playoffs.status === "in_progress" && playoffs.fieldSize >= 2) {
      const active = playoffs.series.filter((s) => s.status === "active");
      if (active.length > 0) {
        const maxRound = Math.max(...active.map((s) => s.round));
        try {
          if (playoffRoundLabel(maxRound, playoffs.fieldSize) === "final") {
            return "finals";
          }
        } catch {
          // fall through
        }
      }
    }
    return "playoffs";
  }
  if (season.phase === "postseason") {
    return "postseason";
  }
  switch (season.offseasonStage) {
    case "free_agency":
      return "free_agency";
    case "draft":
      return "draft";
    case "league_initialization":
      return "season_transition";
    default:
      return "offseason";
  }
}
