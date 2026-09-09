/**
 * Offseason Command Center presentation.
 * Composes calendar milestones, owner dashboard, Action Center, and finances.
 * Does not recreate domain math or invent deadlines.
 */

import type { GameState } from "@/state/game-state";
import {
  buildActionCenterView,
  type ActionCenterView,
} from "@/state/action-center-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { toFinancesView } from "@/state/selectors";
import {
  isOffseasonPeriod,
  isRelocationAccessible,
} from "@/state/owner-season-context";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import {
  getLeagueMilestones,
  type LeagueMilestoneKey,
} from "@/systems/league-rules/calendar-events";
import { isContractActive } from "@/domain/entities/contract";
import { STARTER_STAFF_ROLES } from "@/domain/entities/staff-roles";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";
import { listFreeAgents } from "@/systems/free-agency";

export type OffseasonTimelineStatus = "upcoming" | "active" | "completed";

export type OffseasonTimelineEvent = {
  key: LeagueMilestoneKey;
  label: string;
  date: string | null;
  status: OffseasonTimelineStatus;
  href: string | null;
};

export type OffseasonStatusItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};

export type OffseasonQuickLink = {
  label: string;
  href: string;
};

export type OffseasonHubView = {
  active: boolean;
  saveId: string;
  currentDate: string;
  seasonYear: number;
  teamName: string;
  record: string;
  playoffResult: string | null;
  rosterCount: number;
  playerPayroll: number;
  capSpace: number;
  offseasonStageLabel: string;
  displayLabel: string;
  actionCenter: ActionCenterView;
  timeline: OffseasonTimelineEvent[];
  status: OffseasonStatusItem[];
  quickLinks: OffseasonQuickLink[];
  relocationAvailable: boolean;
};

const OFFSEASON_TIMELINE_KEYS: readonly LeagueMilestoneKey[] = [
  "offseasonStart",
  "rfaWindowOpen",
  "draftStart",
  "draftComplete",
  "freeAgencyOpen",
  "freeAgencyClose",
  "preseasonStart",
  "regularSeasonStart",
] as const;

function milestoneHref(
  key: LeagueMilestoneKey,
  base: string,
): string | null {
  switch (key) {
    case "draftStart":
    case "draftComplete":
      return `${base}/draft`;
    case "freeAgencyOpen":
    case "freeAgencyClose":
      return `${base}/free-agency`;
    case "rfaWindowOpen":
      return `${base}/contracts`;
    case "preseasonStart":
    case "regularSeasonStart":
    case "offseasonStart":
      return `${base}/calendar`;
    default:
      return null;
  }
}

function timelineStatus(
  reached: boolean,
  active: boolean,
): OffseasonTimelineStatus {
  if (active) return "active";
  if (reached) return "completed";
  return "upcoming";
}

function playoffResultLabel(state: GameState, teamId: string): string | null {
  const playoffs = state.competition.playoffs;
  if (playoffs.status !== "complete" && playoffs.status !== "in_progress") {
    return null;
  }
  if (playoffs.championTeamId === teamId) {
    return "Champion";
  }
  const qualified = playoffs.qualifiedTeams.some((q) => q.teamId === teamId);
  if (!qualified) {
    return "Missed playoffs";
  }
  if (playoffs.status === "complete") {
    return "Playoffs — eliminated";
  }
  return "In playoffs";
}

function buildStatusChecklist(
  state: GameState,
  teamId: string,
): OffseasonStatusItem[] {
  const year = state.competition.season.year;
  const contractsNeedingDecision = Object.values(state.business.contracts).filter(
    (contract) =>
      contract.teamId === teamId &&
      isContractActive(contract, year) &&
      contract.endYear === year,
  ).length;

  const filledRoles = new Set(
    Object.values(state.world.staff)
      .filter((member) => member.teamId === teamId)
      .map((member) => member.role),
  );
  const staffVacancies = STARTER_STAFF_ROLES.filter(
    (role) => !filledRoles.has(role),
  ).length;

  const draftYear = draftYearForSeason(year);
  const draft = state.world.drafts[draftClassIdFor(draftYear)];
  const draftDone =
    draft?.status === "complete" ||
    state.competition.season.offseasonStage === "free_agency" ||
    state.competition.season.offseasonStage === "staff_development";

  const faActive =
    state.competition.season.offseasonStage === "free_agency";
  const freeAgentCount = faActive
    ? listFreeAgents(state).playerIds.length
    : 0;

  const team = state.world.teams[teamId];
  const rosterCount = team?.roster.length ?? 0;

  const dlAssigned = Object.values(state.world.players).filter(
    (p) =>
      p.teamId === teamId && p.developmentLeague.status === "assigned",
  ).length;

  return [
    {
      id: "contracts",
      label: "Contracts",
      detail:
        contractsNeedingDecision === 0
          ? "No expiring decisions this window"
          : `${contractsNeedingDecision} expiring this season`,
      done: contractsNeedingDecision === 0,
    },
    {
      id: "staff",
      label: "Staff",
      detail:
        staffVacancies === 0
          ? "Starter roles filled"
          : `${staffVacancies} vacancy${staffVacancies === 1 ? "" : "ies"}`,
      done: staffVacancies === 0,
    },
    {
      id: "draft",
      label: "Draft",
      detail: draft
        ? draftDone
          ? "Draft complete"
          : `Status: ${draft.status.replaceAll("_", " ")}`
        : "No draft class loaded",
      done: draftDone,
    },
    {
      id: "free_agency",
      label: "Free Agency",
      detail: faActive
        ? `${freeAgentCount} free agent${freeAgentCount === 1 ? "" : "s"} available`
        : "Not in free agency stage",
      done: !faActive,
    },
    {
      id: "development",
      label: "Development",
      detail:
        dlAssigned === 0
          ? "No DL assignments"
          : `${dlAssigned} player${dlAssigned === 1 ? "" : "s"} in DL`,
      done: true,
    },
    {
      id: "roster",
      label: "Roster",
      detail: `${rosterCount} player${rosterCount === 1 ? "" : "s"}`,
      done: rosterCount > 0,
    },
  ];
}

/**
 * Build Offseason Command Center view.
 * When not in offseason, returns active: false with empty operational sections.
 */
export function toOffseasonHubView(state: GameState): OffseasonHubView {
  const saveId = state.meta.saveId;
  const base = `/dashboard/${saveId}`;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const owner = toOwnerDashboardView(state);
  const finances = toFinancesView(state);
  const calendar = getCalendarContext(state);
  const active = isOffseasonPeriod(state);

  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });

  const milestones = getLeagueMilestones(state);
  const timeline: OffseasonTimelineEvent[] = milestones
    .filter((m) => OFFSEASON_TIMELINE_KEYS.includes(m.key))
    .filter((m) => m.date !== null || m.active || m.reached)
    .map((m) => ({
      key: m.key,
      label: m.label,
      date: m.date,
      status: timelineStatus(m.reached, m.active),
      href: milestoneHref(m.key, base),
    }))
    .sort((a, b) => {
      if (a.date === null && b.date === null) return 0;
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date.localeCompare(b.date);
    });

  const quickLinks: OffseasonQuickLink[] = [
    { label: "Calendar", href: `${base}/calendar` },
    { label: "Contracts", href: `${base}/contracts` },
    { label: "Draft", href: `${base}/draft` },
    { label: "Scouting", href: `${base}/scouting` },
    { label: "Free Agency", href: `${base}/free-agency` },
    { label: "Staff", href: `${base}/staff-coaching` },
    { label: "Development", href: `${base}/development` },
    { label: "Development League", href: `${base}/development-league` },
    { label: "Finances", href: `${base}/finances` },
    { label: "Franchise", href: `${base}/franchise` },
  ];

  if (isRelocationAccessible(state, teamId)) {
    quickLinks.push({ label: "Relocation", href: `${base}/relocation` });
  }

  return {
    active,
    saveId,
    currentDate: owner.currentDate,
    seasonYear: owner.seasonYear,
    teamName: team ? `${team.city} ${team.name}` : "Team",
    record: `${owner.team.wins}–${owner.team.losses}`,
    playoffResult: playoffResultLabel(state, teamId),
    rosterCount: team?.roster.length ?? 0,
    playerPayroll: finances.playerPayroll,
    capSpace: finances.capSpace,
    offseasonStageLabel: calendar.offseasonStage.replaceAll("_", " "),
    displayLabel: calendar.displayLabel,
    actionCenter,
    timeline: active ? timeline : [],
    status: active ? buildStatusChecklist(state, teamId) : [],
    quickLinks: active ? quickLinks : [{ label: "Calendar", href: `${base}/calendar` }],
    relocationAvailable: isRelocationAccessible(state, teamId),
  };
}
