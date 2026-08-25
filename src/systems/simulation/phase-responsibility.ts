import { playoffRoundLabel } from "@/domain/entities/playoffs";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { findTeamStaffByRole } from "@/systems/staff-effects";
import { STARTER_ROLES } from "@/systems/staff-generation";
import {
  isAiAssistEnabledForDomain,
  resolveDomainAssistMode,
} from "@/systems/simulation/ai-assist-settings";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

export type UnresolvedDecision = {
  id: string;
  domain:
    | "freeAgency"
    | "draft"
    | "staffHiring"
    | "contracts"
    | "rosterFilling";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

export type PhaseResponsibility = {
  phaseKey: string;
  owner: "user" | "ai" | "unresolved";
  unresolvedCount: number;
  unresolvedItems: UnresolvedDecision[];
};

/**
 * Derived ownership of the current phase decisions for the user franchise.
 */
export function computePhaseResponsibility(
  state: GameState,
): PhaseResponsibility {
  const phaseKey = phaseKeyForResponsibility(state);
  const unresolvedItems = collectUnresolvedDecisions(state);
  const unresolvedCount = unresolvedItems.length;
  const managementMode = state.settings.ai.managementMode;

  if (unresolvedCount === 0) {
    return {
      phaseKey,
      owner: managementMode === "full_management" ? "ai" : "user",
      unresolvedCount: 0,
      unresolvedItems: [],
    };
  }

  if (managementMode === "off") {
    return {
      phaseKey,
      owner: "user",
      unresolvedCount,
      unresolvedItems,
    };
  }

  const allAiHandled = unresolvedItems.every((item) =>
    isAiAssistEnabledForDomain(state.settings, item.domain),
  );

  if (managementMode === "full_management" && allAiHandled) {
    return {
      phaseKey,
      owner: "ai",
      unresolvedCount,
      unresolvedItems,
    };
  }

  if (managementMode === "full_management") {
    const anyFull = unresolvedItems.some(
      (item) => resolveDomainAssistMode(state.settings, item.domain) === "full",
    );
    return {
      phaseKey,
      owner: anyFull ? "ai" : "unresolved",
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

function collectUnresolvedDecisions(state: GameState): UnresolvedDecision[] {
  const items: UnresolvedDecision[] = [];
  const teamId = state.user.controlledTeamId;
  const team = state.world.teams[teamId];
  const season = state.competition.season;

  if (team && team.roster.length < DEFAULT_ROSTER_SIZE) {
    const inFa =
      season.phase === "offseason" && season.offseasonStage === "free_agency";
    items.push({
      id: "roster_below_min",
      domain: inFa ? "freeAgency" : "rosterFilling",
      severity: "critical",
      title: "Roster below minimum",
      detail: `Roster has ${team.roster.length}/${DEFAULT_ROSTER_SIZE} players.`,
    });
  }

  if (season.phase === "offseason" && season.offseasonStage === "draft") {
    const draftYear = draftYearForSeason(season.year);
    const draftClassId = draftClassIdFor(draftYear);
    const draft = state.world.drafts[draftClassId];
    if (draft !== undefined && draft.status === "active") {
      const onClock = draft.order.find((slot) => slot.status === "available");
      if (onClock !== undefined && onClock.ownerTeamId === teamId) {
        items.push({
          id: "draft_clock",
          domain: "draft",
          severity: "critical",
          title: "Draft clock",
          detail: "Your team is on the draft clock.",
        });
      }
    }
  }

  for (const role of STARTER_ROLES) {
    if (findTeamStaffByRole(state, teamId, role) === null) {
      items.push({
        id: `staff_gap_${role}`,
        domain: "staffHiring",
        severity: "warning",
        title: "Staff gap",
        detail: `Missing required staff role: ${role}.`,
      });
    }
  }

  return items;
}
