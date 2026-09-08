/**
 * Team Hub composition — read-only projections from existing selectors.
 */

import type { GameState } from "@/state/game-state";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import {
  buildActionCenterView,
  filterTeamDecisions,
} from "@/state/action-center-selectors";
import {
  getRecentForm,
  type RecentFormView,
} from "@/state/recent-form-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import {
  toDashboardSnapshot,
  toRosterView,
  type RosterPlayerView,
} from "@/state/selectors";
import {
  toRotationView,
  type RotationRowView,
  type RotationView,
} from "@/state/team-management-selectors";

export type TeamHubRotationSnapshot = {
  starters: RotationRowView[];
  bench: RotationRowView[];
  totalPlanned: number;
  target: number;
  delta: number;
  plannedValid: boolean;
  feedbackMessages: string[];
};

export type TeamHubView = {
  saveId: string;
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  };
  wins: number;
  losses: number;
  leagueRank: number;
  seasonPhase: string;
  offseasonStage: string;
  strength: number;
  payroll: number;
  capSpace: number;
  healthyCount: number;
  injuredCount: number;
  recentForm: RecentFormView;
  rotation: TeamHubRotationSnapshot;
  corePlayers: RosterPlayerView[];
  injuredPlayers: RosterPlayerView[];
  upcomingGames: ReturnType<typeof toDashboardSnapshot>["upcomingGames"];
  decisions: ActionCenterItem[];
};

function rotationSnapshot(rotation: RotationView): TeamHubRotationSnapshot {
  const ordered = [...rotation.rows].sort(
    (a, b) => a.rotationPriority - b.rotationPriority,
  );
  const starters = ordered
    .filter(
      (row) =>
        row.rotationRole === "starter" ||
        (row.role === "starter" && row.targetMinutes > 0),
    )
    .slice(0, 5);
  const starterIds = new Set(starters.map((s) => s.playerId));
  const bench = ordered
    .filter(
      (row) =>
        !starterIds.has(row.playerId) &&
        row.role !== "inactive" &&
        row.targetMinutes > 0,
    )
    .slice(0, 7);

  // Fallback: if rotation roles aren't set, take top 5 by priority with minutes.
  if (starters.length === 0) {
    const withMinutes = ordered.filter(
      (row) => row.role !== "inactive" && row.targetMinutes > 0,
    );
    return {
      starters: withMinutes.slice(0, 5),
      bench: withMinutes.slice(5, 12),
      totalPlanned: rotation.totalPlanned,
      target: rotation.target,
      delta: rotation.delta,
      plannedValid: rotation.plannedValid,
      feedbackMessages: rotation.feedback.map((f) => f.message).slice(0, 3),
    };
  }

  return {
    starters,
    bench,
    totalPlanned: rotation.totalPlanned,
    target: rotation.target,
    delta: rotation.delta,
    plannedValid: rotation.plannedValid,
    feedbackMessages: rotation.feedback.map((f) => f.message).slice(0, 3),
  };
}

export function toTeamHubView(state: GameState): TeamHubView {
  const dashboard = toDashboardSnapshot(state);
  const owner = toOwnerDashboardView(state);
  const roster = toRosterView(state);
  const rotation = toRotationView(state);
  const recentForm = getRecentForm(state, state.user.activeOwnerTeamId);
  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId: owner.saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });

  const healthy = roster.filter((p) => p.injuryKind === "available");
  const injured = roster.filter((p) => p.injuryKind !== "available");
  const corePlayers = [...roster]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 6);

  return {
    saveId: dashboard.saveId,
    teamId: dashboard.controlledTeam.id,
    city: dashboard.controlledTeam.city,
    name: dashboard.controlledTeam.name,
    abbreviation: dashboard.controlledTeam.abbreviation,
    branding: dashboard.controlledTeam.branding,
    wins: dashboard.controlledStanding.wins,
    losses: dashboard.controlledStanding.losses,
    leagueRank: dashboard.standingsRank,
    seasonPhase: dashboard.seasonPhase,
    offseasonStage: dashboard.offseasonStage,
    strength: owner.team.strength,
    payroll: dashboard.payroll,
    capSpace: dashboard.capSpace,
    healthyCount: healthy.length,
    injuredCount: injured.length,
    recentForm,
    rotation: rotationSnapshot(rotation),
    corePlayers,
    injuredPlayers: injured.slice(0, 5),
    upcomingGames: dashboard.upcomingGames.slice(0, 5),
    decisions: filterTeamDecisions(actionCenter.items, 5),
  };
}
