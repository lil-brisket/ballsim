/**
 * Player Development Hub — answers "Who is changing?"
 * Composes roster + playerHistory; does not invent development focus or causal trainer links.
 */

import type { GameState } from "@/state/game-state";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import {
  buildActionCenterView,
  filterDomainDecisions,
} from "@/state/action-center-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { toRosterView } from "@/state/selectors";
import { toStaffView } from "@/state/franchise-selectors";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";

export type DevelopmentHubRow = {
  playerId: string;
  playerName: string;
  position: string;
  age: number;
  stage: string;
  overall: number;
  /** Season-over-season OVR delta; null when history unavailable. */
  changeDelta: number | null;
  /** Short contextual series labels e.g. "74 → 77" — not a chart. */
  changeLabel: string | null;
  potential: number;
  onDevelopmentLeague: boolean;
};

export type DevelopmentStaffContext = {
  trainerName: string | null;
  trainerOverall: number | null;
  trainerId: string | null;
};

export type DevelopmentHubView = {
  saveId: string;
  teamName: string;
  currentDate: string;
  stageCounts: {
    developing: number;
    prime: number;
    declining: number;
  };
  notableImprovers: DevelopmentHubRow[];
  rows: DevelopmentHubRow[];
  staffContext: DevelopmentStaffContext;
  decisions: ActionCenterItem[];
};

/**
 * Sort: notable change (delta desc, nulls last) → stage → OVR → name
 */
export function sortDevelopmentRows(
  rows: DevelopmentHubRow[],
): DevelopmentHubRow[] {
  const stageOrder: Record<string, number> = {
    developing: 0,
    prime: 1,
    declining: 2,
  };
  return [...rows].sort((a, b) => {
    const aDelta = a.changeDelta;
    const bDelta = b.changeDelta;
    if (aDelta !== null && bDelta !== null && aDelta !== bDelta) {
      return bDelta - aDelta;
    }
    if (aDelta !== null && bDelta === null) return -1;
    if (aDelta === null && bDelta !== null) return 1;
    const sa = stageOrder[a.stage] ?? 9;
    const sb = stageOrder[b.stage] ?? 9;
    if (sa !== sb) return sa - sb;
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.playerName.localeCompare(b.playerName);
  });
}

function changeFromHistory(
  state: GameState,
  playerId: string,
  currentOverall: number,
): { delta: number | null; label: string | null } {
  const history = state.business.playerHistory[playerId];
  if (!history || history.seasons.length === 0) {
    return { delta: null, label: null };
  }
  const seasons = [...history.seasons].sort(
    (a, b) => a.seasonYear - b.seasonYear,
  );
  const last = seasons[seasons.length - 1]!;
  // Prefer last completed season vs current live OVR when years differ.
  if (last.seasonYear < state.competition.season.year) {
    const delta = currentOverall - last.overall;
    return {
      delta,
      label: `${last.overall} → ${currentOverall}`,
    };
  }
  if (seasons.length >= 2) {
    const prev = seasons[seasons.length - 2]!;
    const delta = last.overall - prev.overall;
    return {
      delta,
      label: `${prev.overall} → ${last.overall}`,
    };
  }
  // Only one season snapshot — contextual evidence, not a fabricated prior.
  return { delta: null, label: String(last.overall) };
}

export function toDevelopmentHubView(state: GameState): DevelopmentHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const roster = toRosterView(state);
  const staff = toStaffView(state);
  const owner = toOwnerDashboardView(state);

  const rowsRaw: DevelopmentHubRow[] = [];
  let developing = 0;
  let prime = 0;
  let declining = 0;

  for (const row of roster) {
    const player = state.world.players[row.playerId];
    if (!player) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    const { delta, label } = changeFromHistory(state, player.id, overall);
    const stage = player.development.stage;
    if (stage === "developing") developing += 1;
    else if (stage === "prime") prime += 1;
    else if (stage === "declining") declining += 1;

    rowsRaw.push({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      position: player.position,
      age: player.age,
      stage,
      overall,
      changeDelta: delta,
      changeLabel: label,
      potential: player.potential.overall,
      onDevelopmentLeague: isPlayerDlAssigned(player),
    });
  }

  const rows = sortDevelopmentRows(rowsRaw);
  const notableImprovers = rows
    .filter((r) => r.changeDelta !== null && r.changeDelta > 0)
    .slice(0, 5);

  const trainer = staff.roster.find((m) => m.role === "trainer") ?? null;

  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId: owner.saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });

  return {
    saveId,
    teamName: team ? `${team.city} ${team.name}` : "Team",
    currentDate: owner.currentDate,
    stageCounts: { developing, prime, declining },
    notableImprovers,
    rows,
    staffContext: {
      trainerName: trainer
        ? `${trainer.firstName} ${trainer.lastName}`
        : null,
      trainerOverall: trainer?.overall ?? null,
      trainerId: trainer?.staffId ?? null,
    },
    decisions: filterDomainDecisions(actionCenter.items, ["roster"], 5),
  };
}
