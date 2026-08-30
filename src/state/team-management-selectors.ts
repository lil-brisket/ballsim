/**
 * View models for Team Management hub screens.
 */

import {
  matchCoachingPreset,
  COACHING_PRESETS,
  type CoachingPresetId,
} from "@/domain/coaching/coaching-presets";
import { ARCHETYPE_LABELS } from "@/domain/entities/player-archetype";
import {
  PLAYER_POSITIONS,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { DomainEventType } from "@/domain/events";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getControlledTeam } from "@/state/selectors";
import { getActiveOwnerTeamId, getOwnedTeamIds } from "@/state/owner-context";
import {
  getPlayerAvailability,
  type UnavailabilityReason,
} from "@/systems/player-availability";
import {
  getRegulationTeamMinutesTarget,
  getRotationFeedback,
  getTeamRosterManagement,
  validatePlannedMinutes,
  type RotationFeedback,
} from "@/systems/roster-management";
import {
  formatFeasibilityBanner,
  validateRotationFeasibility,
} from "@/systems/rotation/rotation-feasibility";
import {
  analyzeRotationHealth,
  type RotationHealthReport,
} from "@/systems/rotation/rotation-health";
import { toEventLogEntry, type EventLogEntryView } from "@/state/selectors";
import type { PlayerInjury } from "@/domain/entities/player";

function deriveGamesRemainingFromInjury(
  injury: PlayerInjury | null | undefined,
  currentDate: string,
): { min: number; max: number } | null {
  const window = injury?.expectedReturnWindow;
  if (window == null) return null;
  const toDays = (iso: string) => {
    const a = Date.parse(`${currentDate}T12:00:00Z`);
    const b = Date.parse(`${iso}T12:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, Math.round((b - a) / 86_400_000));
  };
  const min = toDays(window.earliest);
  const max = Math.max(min, toDays(window.latest));
  return { min, max };
}

export type LineupPlayerCardView = {
  playerId: PlayerId;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  overall: number;
  archetypeLabel: string;
  plannedMinutes: number;
  availabilityLabel: string;
  available: boolean;
  unavailableReason?: UnavailabilityReason;
  slot?: PlayerPosition;
  role: "starter" | "bench" | "inactive";
};

export type LineupView = {
  teamId: TeamId;
  teamName: string;
  city: string;
  abbreviation: string;
  starters: LineupPlayerCardView[];
  bench: LineupPlayerCardView[];
  inactive: LineupPlayerCardView[];
  lastConfiguredBy: string;
};

export type RotationSeasonStatsView = {
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
};

export type RotationRowView = {
  playerId: PlayerId;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  age: number;
  overall: number;
  teamName: string;
  /** Display role including inactive group membership. */
  role: string;
  rotationRole: string;
  rotationStatus: string;
  plannedMinutes: number;
  targetMinutes: number;
  projectedMinutes: number;
  minimumMinutes: number;
  normalMaximumMinutes: number;
  absoluteMaximumMinutes: number;
  rotationPriority: number;
  minutePriorityBias: number;
  overrideMedicalRecommendation: boolean;
  actualMinutes: number;
  eligiblePositions: PlayerPosition[];
  preferredPositions: PlayerPosition[];
  secondaryPositions: PlayerPosition[];
  availabilityStatus: string;
  availabilityLabel: string;
  available: boolean;
  injuryLabel: string | null;
  injuryType: string | null;
  injurySeverity: string | null;
  recommendedWorkloadMpg: number | null;
  maximumWorkloadMpg: number | null;
  gamesRemaining: { min: number; max: number } | null;
  isLegacyUndisclosed: boolean;
  workloadWarning: string | null;
  seasonStats: RotationSeasonStatsView | null;
};

export type RotationPreviewBand = {
  label: string;
  minMinutes: number;
  maxMinutes: number;
};

export type RotationView = {
  teamId: TeamId;
  teamName: string;
  rows: RotationRowView[];
  totalPlanned: number;
  target: number;
  delta: number;
  plannedValid: boolean;
  feedback: RotationFeedback[];
  health: RotationHealthReport;
  rotationStyle: string;
  rotationPhilosophy: string;
  rotationDepth: number;
  rotationPreset: string;
  closingLineupPolicy: string;
  closingLineupIds: PlayerId[];
  feasibilityBanner: string | null;
  previewBands: RotationPreviewBand[];
};

export type CoachingView = {
  teamId: TeamId;
  philosophy: {
    pace: string;
    offensiveEmphasis: string;
    defensiveApproach: string;
  };
  rotationStyle: string;
  activePreset: CoachingPresetId | "custom";
  presets: Array<{ id: CoachingPresetId; label: string; description: string }>;
};

export type InjuryEffectDeltaView = {
  attribute: string;
  delta: number;
};

export type InjuryHistorySnippetView = {
  type: string;
  bodyPart: string;
  severity: string;
  injuredOn: string;
  isReinjury: boolean;
  isAggravation: boolean;
};

export type InjuryRowView = {
  playerId: PlayerId;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  overall: number;
  status: import("@/domain/entities/player").PlayerAvailability;
  statusLabel: string;
  injuryType: string | null;
  bodyPart: string | null;
  severity: string | null;
  recoveryProgress: number | null;
  expectedReturnEarliest: string | null;
  expectedReturnLatest: string | null;
  practiceRestriction: string | null;
  gameRestriction: string | null;
  minutesRestriction: number | null;
  recommendedWorkloadMpg: number | null;
  maximumWorkloadMpg: number | null;
  reinjuryRisk: number | null;
  temporaryEffects: InjuryEffectDeltaView[];
  gamesRemaining: { min: number; max: number } | null;
  isLegacyUndisclosed: boolean;
  isLongTerm: boolean;
  isHighReinjuryRisk: boolean;
  activeInjuryCount: number;
  recentHistory: InjuryHistorySnippetView[];
};

export type InjuryReportView = {
  teamId: TeamId;
  rows: InjuryRowView[];
  injuredCount: number;
  historyRows: InjuryHistorySnippetView[];
};

export type TeamManagementOverview = {
  teamId: TeamId;
  teamName: string;
  city: string;
  abbreviation: string;
  starters: Array<{ slot: PlayerPosition; name: string; overall: number }>;
  injuredCount: number;
  totalPlanned: number;
  targetMinutes: number;
  rotationDepth: number;
  coachingLabel: string;
  coachingCustomized: boolean;
  recentTransactions: EventLogEntryView[];
};

export type SeasonTransactionFilters = {
  scope: "team" | "league";
  type?: DomainEventType | "all";
  sort: "newest" | "oldest" | "type" | "team" | "player";
  page: number;
  pageSize: number;
};

export type SeasonTransactionsView = {
  rows: EventLogEntryView[];
  total: number;
  page: number;
  pageSize: number;
};

function playerCard(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
  role: "starter" | "bench" | "inactive",
  slot?: PlayerPosition,
): LineupPlayerCardView | null {
  const player = state.world.players[playerId];
  if (player == null) {
    return null;
  }
  const management = getTeamRosterManagement(state, teamId);
  const rotation = management.rotation.find(
    (entry) => entry.playerId === playerId,
  );
  const availability = getPlayerAvailability(state, playerId, teamId);
  return {
    playerId,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    overall: calculatePlayerOverall(player.position, player.attributes),
    archetypeLabel: ARCHETYPE_LABELS[player.archetype] ?? player.archetype,
    plannedMinutes: role === "inactive" ? 0 : (rotation?.targetMinutes ?? 0),
    availabilityLabel: availability.label,
    available: availability.available,
    unavailableReason: availability.reason,
    slot,
    role,
  };
}

export function toLineupView(state: GameState): LineupView {
  const team = getControlledTeam(state);
  const management = team.rosterManagement;
  const starters = management.startingLineup
    .map((slot) =>
      playerCard(state, team.id, slot.playerId, "starter", slot.slot),
    )
    .filter((row): row is LineupPlayerCardView => row != null);
  // Ensure PG..C order
  starters.sort((a, b) => {
    const ai = PLAYER_POSITIONS.indexOf(a.slot ?? a.position);
    const bi = PLAYER_POSITIONS.indexOf(b.slot ?? b.position);
    return ai - bi;
  });

  return {
    teamId: team.id,
    teamName: team.name,
    city: team.city,
    abbreviation: team.abbreviation,
    starters,
    bench: management.bench
      .map((playerId) => playerCard(state, team.id, playerId, "bench"))
      .filter((row): row is LineupPlayerCardView => row != null),
    inactive: management.inactive
      .map((playerId) => playerCard(state, team.id, playerId, "inactive"))
      .filter((row): row is LineupPlayerCardView => row != null),
    lastConfiguredBy: management.lastConfiguredBy,
  };
}

function seasonActualMinutes(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): number {
  let total = 0;
  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") {
      continue;
    }
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) {
      continue;
    }
    const row = game.playerStats.find((stats) => stats.playerId === playerId);
    if (row) {
      total += row.minutes;
    }
  }
  return total;
}

function seasonStatsForPlayer(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): RotationSeasonStatsView | null {
  let games = 0;
  let minutes = 0;
  let points = 0;
  let rebounds = 0;
  let assists = 0;
  let steals = 0;
  let blocks = 0;
  let fgMade = 0;
  let fgAtt = 0;
  let threeMade = 0;
  let threeAtt = 0;
  let ftMade = 0;
  let ftAtt = 0;

  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") {
      continue;
    }
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) {
      continue;
    }
    const row = game.playerStats.find((stats) => stats.playerId === playerId);
    if (row == null) {
      continue;
    }
    games += 1;
    minutes += row.minutes;
    points += row.points;
    rebounds += row.rebounds;
    assists += row.assists;
    steals += row.steals;
    blocks += row.blocks;
    fgMade += row.fieldGoalsMade;
    fgAtt += row.fieldGoalsAttempted;
    threeMade += row.threePointersMade;
    threeAtt += row.threePointersAttempted;
    ftMade += row.freeThrowsMade;
    ftAtt += row.freeThrowsAttempted;
  }

  if (games === 0) {
    return null;
  }

  const perGame = (value: number) =>
    Math.round((value / games) * 10) / 10;
  const pct = (made: number, attempted: number) =>
    attempted > 0 ? Math.round((made / attempted) * 1000) / 10 : null;

  return {
    mpg: perGame(minutes),
    ppg: perGame(points),
    rpg: perGame(rebounds),
    apg: perGame(assists),
    spg: perGame(steals),
    bpg: perGame(blocks),
    fgPct: pct(fgMade, fgAtt),
    threePct: pct(threeMade, threeAtt),
    ftPct: pct(ftMade, ftAtt),
  };
}

function injuryDisplayLabel(
  availabilityStatus: string,
  injuryType: string | null,
  isLegacyUndisclosed: boolean,
): string | null {
  if (availabilityStatus === "available") {
    return null;
  }
  if (isLegacyUndisclosed) {
    return "Undisclosed injury";
  }
  if (injuryType) {
    return injuryType;
  }
  if (availabilityStatus === "suspended") {
    return "Suspended";
  }
  return null;
}

function workloadWarningForRow(
  targetMinutes: number,
  recommendedWorkloadMpg: number | null,
  maximumWorkloadMpg: number | null,
  overrideMedicalRecommendation: boolean,
): string | null {
  if (
    recommendedWorkloadMpg == null ||
    targetMinutes <= recommendedWorkloadMpg
  ) {
    return null;
  }
  if (overrideMedicalRecommendation) {
    return `Medical override — target ${targetMinutes} exceeds recommended ${recommendedWorkloadMpg} MPG`;
  }
  if (
    maximumWorkloadMpg != null &&
    targetMinutes > maximumWorkloadMpg
  ) {
    return `Target ${targetMinutes} exceeds maximum ${maximumWorkloadMpg} MPG`;
  }
  return `Target ${targetMinutes} exceeds recommended ${recommendedWorkloadMpg} MPG`;
}

export function toRotationView(state: GameState): RotationView {
  const team = getControlledTeam(state);
  const management = team.rosterManagement;
  const minutes = validatePlannedMinutes(management);
  const feasibility = validateRotationFeasibility(management);
  const health = analyzeRotationHealth(state, team.id, management);
  const starterIds = new Set(
    management.startingLineup.map((slot) => slot.playerId),
  );

  const rows: RotationRowView[] = [];
  for (const playerId of [
    ...management.startingLineup.map((slot) => slot.playerId),
    ...management.bench,
    ...management.inactive,
  ]) {
    const player = state.world.players[playerId];
    if (player == null) {
      continue;
    }
    const rotation = management.rotation.find(
      (entry) => entry.playerId === playerId,
    );
    const availability = getPlayerAvailability(state, playerId, team.id);
    const groupRole = management.inactive.includes(playerId)
      ? "inactive"
      : starterIds.has(playerId)
        ? "starter"
        : "bench";
    const targetMinutes =
      groupRole === "inactive" ? 0 : (rotation?.targetMinutes ?? 0);
    const overrideMedicalRecommendation =
      rotation?.overrideMedicalRecommendation === true;
    const injuryType = player.injury?.type ?? availability.injuryType;
    const isLegacyUndisclosed =
      availability.isLegacyUndisclosed ||
      (player.injury?.type === "Undisclosed" &&
        player.injury.isLegacyData === true);
    rows.push({
      playerId,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
      teamName: team.name,
      role: groupRole,
      rotationRole: rotation?.role ?? groupRole,
      rotationStatus: rotation?.rotationStatus ?? "inactive",
      plannedMinutes: targetMinutes,
      targetMinutes,
      projectedMinutes: targetMinutes,
      minimumMinutes: rotation?.minimumMinutes ?? 0,
      normalMaximumMinutes: rotation?.normalMaximumMinutes ?? 0,
      absoluteMaximumMinutes: rotation?.absoluteMaximumMinutes ?? 0,
      rotationPriority: rotation?.rotationPriority ?? 5,
      minutePriorityBias: rotation?.minutePriorityBias ?? 0,
      overrideMedicalRecommendation,
      actualMinutes: seasonActualMinutes(state, team.id, playerId),
      eligiblePositions: rotation?.preferredPositions ?? [player.position],
      preferredPositions: rotation?.preferredPositions ?? [player.position],
      secondaryPositions: rotation?.secondaryPositions ?? [],
      availabilityStatus: availability.status,
      availabilityLabel: availability.label,
      available: availability.available,
      injuryLabel: injuryDisplayLabel(
        availability.status,
        injuryType,
        isLegacyUndisclosed,
      ),
      injuryType,
      injurySeverity: player.injury?.severity ?? null,
      recommendedWorkloadMpg: availability.recommendedWorkloadMpg,
      maximumWorkloadMpg: availability.maximumWorkloadMpg,
      gamesRemaining: deriveGamesRemainingFromInjury(
        player.injury,
        state.world.calendar.currentDate,
      ),
      isLegacyUndisclosed,
      workloadWarning: workloadWarningForRow(
        targetMinutes,
        availability.recommendedWorkloadMpg,
        availability.maximumWorkloadMpg,
        overrideMedicalRecommendation,
      ),
      seasonStats: seasonStatsForPlayer(state, team.id, playerId),
    });
  }

  return {
    teamId: team.id,
    teamName: team.name,
    rows,
    totalPlanned: minutes.totalPlanned,
    target: minutes.target,
    delta: minutes.delta,
    plannedValid: minutes.valid,
    feedback: getRotationFeedback(state, team.id, management),
    health,
    rotationStyle: management.rotationStyle,
    rotationPhilosophy: management.rotationPhilosophy,
    rotationDepth: management.rotationDepth,
    rotationPreset: management.rotationPreset,
    closingLineupPolicy: management.closingLineupPolicy,
    closingLineupIds: [...management.closingLineupIds],
    feasibilityBanner: formatFeasibilityBanner(feasibility),
    previewBands: buildPreviewBands(rows),
  };
}

function buildPreviewBands(rows: RotationRowView[]): RotationPreviewBand[] {
  const groups: Array<{
    label: string;
    match: (row: RotationRowView) => boolean;
  }> = [
    { label: "Starters", match: (row) => row.rotationRole === "starter" },
    { label: "Sixth Man", match: (row) => row.rotationRole === "sixth_man" },
    { label: "Rotation", match: (row) => row.rotationRole === "rotation" },
    { label: "Bench", match: (row) => row.rotationRole === "bench" },
    {
      label: "Deep Bench",
      match: (row) =>
        row.rotationRole === "deep_bench" || row.rotationRole === "emergency",
    },
  ];
  return groups
    .map((group) => {
      const matched = rows.filter(
        (row) => row.role !== "inactive" && group.match(row),
      );
      if (matched.length === 0) {
        return null;
      }
      const targets = matched.map((row) => row.targetMinutes);
      return {
        label: group.label,
        minMinutes: Math.min(...targets),
        maxMinutes: Math.max(...targets),
      };
    })
    .filter((band): band is RotationPreviewBand => band != null);
}

export function toCoachingView(state: GameState): CoachingView {
  const team = getControlledTeam(state);
  const activePreset = matchCoachingPreset(
    team.coachingPhilosophy,
    team.rosterManagement.rotationStyle,
  );
  return {
    teamId: team.id,
    philosophy: { ...team.coachingPhilosophy },
    rotationStyle: team.rosterManagement.rotationStyle,
    activePreset,
    presets: COACHING_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      description: preset.description,
    })),
  };
}

export function toInjuryReportView(state: GameState): InjuryReportView {
  const team = getControlledTeam(state);
  const rows: InjuryRowView[] = [];
  const historyRows: InjuryHistorySnippetView[] = [];

  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (player == null) {
      continue;
    }
    const availability = getPlayerAvailability(state, playerId, team.id);
    const active = player.activeInjuries ?? (player.injury ? [player.injury] : []);
    const primary = player.injury ?? active[0] ?? null;
    const effects = primary?.temporaryEffects ?? [];
    const window = primary?.expectedReturnWindow ?? null;
    let gamesRemaining: { min: number; max: number } | null = null;
    if (window != null) {
      const today = state.world.calendar.currentDate;
      const toDays = (iso: string) => {
        const a = Date.parse(`${today}T12:00:00Z`);
        const b = Date.parse(`${iso}T12:00:00Z`);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
        return Math.max(0, Math.round((b - a) / 86_400_000));
      };
      gamesRemaining = {
        min: toDays(window.earliest),
        max: Math.max(toDays(window.earliest), toDays(window.latest)),
      };
    }

    const recentHistory = (player.injuryHistory ?? []).slice(0, 3).map((entry) => ({
      type: entry.type,
      bodyPart: entry.bodyPart,
      severity: entry.severity,
      injuredOn: entry.injuredOn,
      isReinjury: entry.isReinjury,
      isAggravation: entry.isAggravation,
    }));
    historyRows.push(...recentHistory);

    rows.push({
      playerId,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      overall: calculatePlayerOverall(player.position, player.attributes),
      status: player.availability,
      statusLabel: availability.label.split(" · ")[0] ?? availability.label,
      injuryType: primary?.type ?? null,
      bodyPart: primary?.bodyPart ?? null,
      severity: primary?.severity ?? null,
      recoveryProgress: primary?.recoveryProgress ?? null,
      expectedReturnEarliest: window?.earliest ?? null,
      expectedReturnLatest: window?.latest ?? null,
      practiceRestriction: primary?.practiceRestriction ?? null,
      gameRestriction: primary?.gameRestriction ?? null,
      minutesRestriction: primary?.minutesRestriction ?? null,
      recommendedWorkloadMpg: availability.recommendedWorkloadMpg,
      maximumWorkloadMpg: availability.maximumWorkloadMpg,
      reinjuryRisk: primary?.reinjuryRisk ?? null,
      temporaryEffects: effects.map((effect) => ({
        attribute: effect.attribute,
        delta: Math.round(effect.delta * (1 - (primary?.recoveryProgress ?? 0))),
      })),
      gamesRemaining,
      isLegacyUndisclosed:
        primary?.type === "Undisclosed" && primary.isLegacyData === true,
      isLongTerm:
        primary != null &&
        (primary.severity === "major" || primary.severity === "severe") &&
        (gamesRemaining?.min ?? 0) >= 14,
      isHighReinjuryRisk: (primary?.reinjuryRisk ?? 0) >= 0.2,
      activeInjuryCount: active.length,
      recentHistory,
    });
  }
  rows.sort((a, b) => {
    if (a.status !== b.status) {
      const order = [
        "out",
        "suspended",
        "recovery",
        "limited",
        "questionable",
        "minor",
        "available",
      ];
      return order.indexOf(a.status) - order.indexOf(b.status);
    }
    return a.lastName.localeCompare(b.lastName);
  });
  return {
    teamId: team.id,
    rows,
    injuredCount: rows.filter(
      (row) =>
        row.status === "out" ||
        row.status === "limited" ||
        row.status === "recovery" ||
        row.status === "questionable" ||
        row.status === "minor",
    ).length,
    historyRows,
  };
}

export function toTeamManagementOverview(
  state: GameState,
): TeamManagementOverview {
  const lineup = toLineupView(state);
  const rotation = toRotationView(state);
  const coaching = toCoachingView(state);
  const injuries = toInjuryReportView(state);
  const transactions = toSeasonTransactionsView(state, {
    scope: "team",
    type: "all",
    sort: "newest",
    page: 0,
    pageSize: 5,
  });

  const coachingPreset = coaching.presets.find(
    (preset) => preset.id === coaching.activePreset,
  );

  return {
    teamId: lineup.teamId,
    teamName: lineup.teamName,
    city: lineup.city,
    abbreviation: lineup.abbreviation,
    starters: lineup.starters.map((starter) => ({
      slot: starter.slot ?? starter.position,
      name: `${starter.firstName} ${starter.lastName}`,
      overall: starter.overall,
    })),
    injuredCount: injuries.injuredCount,
    totalPlanned: rotation.totalPlanned,
    targetMinutes: rotation.target,
    rotationDepth: rotation.rows.filter((row) => row.plannedMinutes > 0).length,
    coachingLabel: coachingPreset?.label ?? "Customized",
    coachingCustomized: coaching.activePreset === "custom",
    recentTransactions: transactions.rows,
  };
}

const TRANSACTION_TYPES: readonly DomainEventType[] = [
  "ContractSigned",
  "FreeAgentSigned",
  "PlayerTraded",
  "PlayerReleased",
  "DraftPickMade",
  "CoachHired",
  "StaffHired",
  "StaffFired",
];

export function toSeasonTransactionsView(
  state: GameState,
  filters: SeasonTransactionFilters,
): SeasonTransactionsView {
  const activeTeamId = getActiveOwnerTeamId(state);
  const owned = new Set(getOwnedTeamIds(state).map(String));

  let events = [...state.competition.seasonEventLog];

  if (filters.scope === "team") {
    events = events.filter((event) => {
      const payload = event.payload;
      const teamId =
        (typeof payload.teamId === "string" && payload.teamId) ||
        (typeof payload.toTeamId === "string" && payload.toTeamId) ||
        (typeof payload.fromTeamId === "string" && payload.fromTeamId) ||
        null;
      if (teamId == null) {
        return false;
      }
      return teamId === activeTeamId || owned.has(teamId);
    });
    // Prefer exact active team match when both owned
    events = events.filter((event) => {
      const payload = event.payload;
      const ids = [
        payload.teamId,
        payload.toTeamId,
        payload.fromTeamId,
      ].filter((id): id is string => typeof id === "string");
      return ids.includes(activeTeamId);
    });
  }

  if (filters.type && filters.type !== "all") {
    events = events.filter((event) => event.type === filters.type);
  } else {
    events = events.filter((event) =>
      TRANSACTION_TYPES.includes(event.type),
    );
  }

  events.sort((a, b) => {
    if (filters.sort === "oldest") {
      return a.occurredOn.localeCompare(b.occurredOn);
    }
    if (filters.sort === "type") {
      return a.type.localeCompare(b.type);
    }
    if (filters.sort === "team") {
      const aTeam = String(a.payload.teamId ?? a.payload.toTeamId ?? "");
      const bTeam = String(b.payload.teamId ?? b.payload.toTeamId ?? "");
      return aTeam.localeCompare(bTeam);
    }
    if (filters.sort === "player") {
      const aPlayer = String(a.payload.playerId ?? "");
      const bPlayer = String(b.payload.playerId ?? "");
      return aPlayer.localeCompare(bPlayer);
    }
    // newest
    return b.occurredOn.localeCompare(a.occurredOn);
  });

  const total = events.length;
  const start = filters.page * filters.pageSize;
  const pageEvents = events.slice(start, start + filters.pageSize);

  return {
    rows: pageEvents.map((event) =>
      enrichEventLogEntry(state, toEventLogEntry(event)),
    ),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

function enrichEventLogEntry(
  state: GameState,
  entry: EventLogEntryView,
): EventLogEntryView {
  // Prefer name-resolved description when IDs are present in the raw event
  const event = state.competition.seasonEventLog.find((row) => row.id === entry.id);
  if (event == null) {
    return entry;
  }
  return {
    ...entry,
    description: describeTransactionEvent(state, event),
  };
}

function describeTransactionEvent(
  state: GameState,
  event: GameState["competition"]["seasonEventLog"][number],
): string {
  const payload = event.payload;
  const playerName = resolvePlayerName(state, payload.playerId);
  const teamName = resolveTeamName(state, payload.teamId);
  const fromTeam = resolveTeamName(state, payload.fromTeamId);
  const toTeam = resolveTeamName(state, payload.toTeamId);

  switch (event.type) {
    case "FreeAgentSigned":
    case "ContractSigned":
      return `Signed ${playerName}${teamName ? ` — ${teamName}` : ""}`;
    case "PlayerTraded":
      return `Trade: ${playerName} (${fromTeam} → ${toTeam})`;
    case "PlayerReleased":
      return `Released ${playerName}${teamName ? ` — ${teamName}` : ""}`;
    case "DraftPickMade":
      return `Drafted ${playerName}${teamName ? ` — ${teamName}` : ""}`;
    case "CoachHired":
    case "StaffHired":
      return `Hired staff${teamName ? ` — ${teamName}` : ""}`;
    case "StaffFired":
      return `Fired staff${teamName ? ` — ${teamName}` : ""}`;
    default:
      return entryDescriptionFallback(event.type, playerName, teamName);
  }
}

function entryDescriptionFallback(
  type: string,
  playerName: string,
  teamName: string,
): string {
  return [type, playerName, teamName].filter(Boolean).join(" — ");
}

function resolvePlayerName(state: GameState, playerId: unknown): string {
  if (typeof playerId !== "string") {
    return "Unknown player";
  }
  const player = state.world.players[playerId];
  if (player == null) {
    return playerId;
  }
  return `${player.firstName} ${player.lastName}`;
}

function resolveTeamName(state: GameState, teamId: unknown): string {
  if (typeof teamId !== "string") {
    return "";
  }
  const team = state.world.teams[teamId];
  if (team == null) {
    return teamId;
  }
  return `${team.city} ${team.name}`;
}

export { getRegulationTeamMinutesTarget };
