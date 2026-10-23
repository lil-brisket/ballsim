/**
 * Team Hub composition — read-only projections from existing selectors.
 */

import { teamChemistry } from "@/systems/team-chemistry";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
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
  toMyTeamStandingsContext,
  type PlayoffPositionLabel,
} from "@/state/standings-selectors";
import {
  getTeamRecentHistory,
  type TeamRecentHistoryItem,
} from "@/state/team-recent-history-selectors";
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

export type TeamHubStandingsContext = {
  conferenceRank: number | null;
  conferenceName: string | null;
  gamesBack: number | null;
  playoffLabel: PlayoffPositionLabel | null;
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
  leagueRank: number | null;
  seasonPhase: string;
  offseasonStage: string;
  strength: number;
  payroll: number;
  capSpace: number;
  healthyCount: number;
  injuredCount: number;
  recentForm: RecentFormView;
  standings: TeamHubStandingsContext;
  recentHistory: TeamRecentHistoryItem[];
  rotation: TeamHubRotationSnapshot;
  corePlayers: RosterPlayerView[];
  injuredPlayers: RosterPlayerView[];
  chemistry: TeamChemistryView;
  /** Numbers the franchise no longer issues, low to high. */
  retiredNumbers: { number: number; playerName: string }[];
};

export type TeamChemistryView = {
  value: number;
  /** "Strong" / "Steady" / "Shaky". */
  label: string;
  /** Share of the core eight who were here last season (0-1). */
  continuity: number;
  /** Players traded in or out in the last 30 days. */
  recentTrades: number;
  /** One-line note when trades are costing chemistry, else null. */
  note: string | null;
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
  const teamId = state.user.activeOwnerTeamId;
  const recentForm = getRecentForm(state, teamId);
  const standingsCtx = toMyTeamStandingsContext(state);

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
    standings: {
      conferenceRank: standingsCtx?.conferenceRank ?? null,
      conferenceName: standingsCtx?.conferenceName ?? null,
      gamesBack: standingsCtx?.gamesBack ?? null,
      playoffLabel: standingsCtx?.playoffLabel ?? null,
    },
    recentHistory: getTeamRecentHistory(state, teamId),
    rotation: rotationSnapshot(rotation),
    corePlayers,
    injuredPlayers: injured.slice(0, 5),
    chemistry: chemistryView(state, teamId),
    retiredNumbers: (state.world.retiredNumbers?.[teamId] ?? []).map((r) => ({
      number: r.number,
      playerName: r.playerName,
    })),
  };
}

function chemistryView(state: GameState, teamId: TeamId): TeamChemistryView {
  const chemistry = teamChemistry(state, teamId);
  return {
    value: chemistry.value,
    label:
      chemistry.value >= 70
        ? "Strong"
        : chemistry.value >= 50
          ? "Steady"
          : "Shaky",
    continuity: chemistry.continuity,
    recentTrades: chemistry.recentTrades,
    note:
      chemistry.recentTrades > 0
        ? `${chemistry.recentTrades} recent trade${chemistry.recentTrades === 1 ? "" : "s"}: the group needs time to gel.`
        : null,
  };
}
