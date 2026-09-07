/**
 * Actionable / unread nav badges — not raw record counts.
 * Reuses existing briefing, media read state, and pending decisions.
 */

import { isContractActive } from "@/domain/entities/contract";
import { isMediaUnread } from "@/domain/entities/media-item";
import {
  getBlockingOwnerDecisions,
  getPendingDecisionsForTeam,
} from "@/domain/entities/owner-decision";
import { STARTER_STAFF_ROLES } from "@/domain/entities/staff-roles";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnedFranchise,
  getActiveOwnerTeamId,
} from "@/state/owner-context";
import {
  isOffseasonPeriod,
  isRelocationAccessible,
} from "@/state/owner-season-context";
import { getCalendarTodayBriefing } from "@/systems/calendar/today-briefing";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { isUserOnDraftClock } from "@/systems/draft";

export type OwnerNavBadgeKind = "actionable" | "unread" | "critical";

export type OwnerNavBadge = {
  count: number;
  kind: OwnerNavBadgeKind;
  /** Screen-reader suffix, e.g. "decisions" or "unread" */
  label: string;
};

export type OwnerNavBadgeKey =
  | "calendar"
  | "roster"
  | "contracts"
  | "media"
  | "offseason"
  | "staff";

export type OwnerNavBadgeMap = Partial<Record<OwnerNavBadgeKey, OwnerNavBadge>>;

/**
 * Compute sidebar badge counts from GameState.
 * Badges mean "look here" — not "N records exist".
 */
export function computeOwnerNavBadges(state: GameState): OwnerNavBadgeMap {
  const badges: OwnerNavBadgeMap = {};
  const teamId = getActiveOwnerTeamId(state);
  const franchise = getActiveOwnedFranchise(state);
  const calendar = getCalendarContext(state);
  const briefing = getCalendarTodayBriefing(state);

  const calendarActions = briefing.actionRequired.length;
  if (calendarActions > 0) {
    const hasBlocking = briefing.actionRequired.some((event) => event.blocking);
    badges.calendar = {
      count: calendarActions,
      kind: hasBlocking ? "critical" : "actionable",
      label:
        calendarActions === 1
          ? "event needing attention"
          : "events needing attention",
    };
  }

  const pendingForTeam = getPendingDecisionsForTeam(state.user, teamId);
  if (pendingForTeam.length > 0) {
    const blocking = pendingForTeam.some((d) => d.blockingLevel === "blocking");
    badges.roster = {
      count: pendingForTeam.length,
      kind: blocking ? "critical" : "actionable",
      label: pendingForTeam.length === 1 ? "decision" : "decisions",
    };
  }

  const year = state.competition.season.year;
  const inContractWindow =
    isOffseasonPeriod(state) || Boolean(calendar.deadlineWindow);
  if (inContractWindow) {
    const actionableContracts = Object.values(state.business.contracts).filter(
      (contract) =>
        contract.teamId === teamId &&
        isContractActive(contract, year) &&
        contract.endYear === year,
    ).length;
    if (actionableContracts > 0) {
      badges.contracts = {
        count: actionableContracts,
        kind: "actionable",
        label:
          actionableContracts === 1
            ? "contract needing a decision"
            : "contracts needing a decision",
      };
    }
  }

  const mediaFeed = franchise.mediaFeed?.items ?? [];
  const readState = franchise.mediaReadState ?? {};
  const unreadMedia = mediaFeed.filter((item) =>
    isMediaUnread(item, readState),
  ).length;
  if (unreadMedia > 0) {
    badges.media = {
      count: unreadMedia,
      kind: "unread",
      label: "unread",
    };
  }

  const filledRoles = new Set(
    Object.values(state.world.staff)
      .filter((member) => member.teamId === teamId)
      .map((member) => member.role),
  );
  const staffVacancies = STARTER_STAFF_ROLES.filter(
    (role) => !filledRoles.has(role),
  ).length;
  if (staffVacancies > 0) {
    badges.staff = {
      count: staffVacancies,
      kind: "actionable",
      label: staffVacancies === 1 ? "staff vacancy" : "staff vacancies",
    };
  }

  if (isOffseasonPeriod(state)) {
    let outstanding = 0;
    if (isUserOnDraftClock(state)) {
      outstanding += 1;
    }
    outstanding += getBlockingOwnerDecisions(state.user).filter(
      (d) =>
        d.primaryTeamId === teamId || d.participantTeamIds.includes(teamId),
    ).length;
    if (badges.contracts) {
      outstanding += 1;
    }
    if (isRelocationAccessible(state, teamId)) {
      outstanding += 1;
    }
    if (calendar.offseasonStage === "free_agency") {
      outstanding += 1;
    }
    if (
      calendar.offseasonStage === "draft" ||
      calendar.offseasonStage === "draft_preparation"
    ) {
      outstanding += 1;
    }
    if (outstanding > 0) {
      badges.offseason = {
        count: outstanding,
        kind: "actionable",
        label:
          outstanding === 1
            ? "outstanding decision"
            : "outstanding decisions",
      };
    }
  }

  return badges;
}
