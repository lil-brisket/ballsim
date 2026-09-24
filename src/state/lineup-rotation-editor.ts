/**
 * Lightweight client editor state for Lineup & Rotation workspace.
 * UI invariants only — authoritative validation stays on the server.
 */

import type {
  LineupView,
  RotationRowView,
  RotationView,
} from "@/state/team-management-selectors";

export type StarterDraft = { playerId: string; slot: string };

export type EditableRotationRow = {
  playerId: string;
  targetMinutes: number;
  rotationPriority: number;
  rotationStatus: string;
  role: string;
  preferredPositions: string[];
  secondaryPositions: string[];
  minutePriorityBias: number;
  overrideMedicalRecommendation: boolean;
  groupRole: string;
  firstName: string;
  lastName: string;
  position: string;
  age?: number;
  overall?: number;
  teamName?: string;
  actualMinutes: number;
  projectedMinutes: number;
  availabilityStatus: string;
  availabilityLabel: string;
  injuryType?: string | null;
  injurySeverity?: string | null;
  recommendedWorkloadMpg?: number | null;
  maximumWorkloadMpg?: number | null;
  gamesRemaining?: { min: number; max: number } | null;
  isLegacyUndisclosed?: boolean;
  workloadWarning?: string | null;
  seasonStats?: RotationRowView["seasonStats"];
};

export type LineupRotationEditorState = {
  starters: StarterDraft[];
  bench: string[];
  inactive: string[];
  rows: EditableRotationRow[];
  preset: string;
  closingPolicy: string;
  closingIds: string[];
  rotationStyle: string;
  rotationPhilosophy: string;
  rotationDepth: number;
};

export type LineupRotationSavePayload = {
  startingLineup: StarterDraft[];
  bench: string[];
  inactive: string[];
  rotation: Array<{
    playerId: string;
    targetMinutes: number;
    rotationPriority: number;
    rotationStatus: string;
    role: string;
    preferredPositions: string[];
    secondaryPositions: string[];
    minutePriorityBias: number;
    overrideMedicalRecommendation: boolean;
  }>;
  rotationPreset: string;
  rotationStyle: string;
  rotationPhilosophy: string;
  rotationDepth: number;
  closingLineupPolicy: string;
  closingLineupIds: string[];
};

export type PlayerCardLike = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  plannedMinutes: number;
  availabilityLabel: string;
  available: boolean;
  role: string;
  archetypeLabel?: string;
};

function mapRow(row: RotationRowView): EditableRotationRow {
  return {
    playerId: row.playerId,
    targetMinutes: row.targetMinutes,
    rotationPriority: row.rotationPriority,
    rotationStatus: row.rotationStatus,
    role: row.rotationRole,
    preferredPositions: [...row.preferredPositions],
    secondaryPositions: [...row.secondaryPositions],
    minutePriorityBias: row.minutePriorityBias,
    overrideMedicalRecommendation: row.overrideMedicalRecommendation,
    groupRole: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    age: row.age,
    overall: row.overall,
    teamName: row.teamName,
    actualMinutes: row.actualMinutes,
    projectedMinutes: row.projectedMinutes,
    availabilityStatus: row.availabilityStatus,
    availabilityLabel: row.availabilityLabel,
    injuryType: row.injuryType,
    injurySeverity: row.injurySeverity,
    recommendedWorkloadMpg: row.recommendedWorkloadMpg,
    maximumWorkloadMpg: row.maximumWorkloadMpg,
    gamesRemaining: row.gamesRemaining,
    isLegacyUndisclosed: row.isLegacyUndisclosed,
    workloadWarning: row.workloadWarning,
    seasonStats: row.seasonStats,
  };
}

export function createEditorState(
  lineup: LineupView,
  rotation: RotationView,
): LineupRotationEditorState {
  return {
    starters: lineup.starters.map((player) => ({
      playerId: player.playerId as string,
      slot: (player.slot ?? player.position) as string,
    })),
    bench: lineup.bench.map((p) => p.playerId as string),
    inactive: lineup.inactive.map((p) => p.playerId as string),
    rows: rotation.rows.map(mapRow),
    preset: rotation.rotationPreset,
    closingPolicy: rotation.closingLineupPolicy,
    closingIds: rotation.closingLineupIds.map(String),
    rotationStyle: rotation.rotationStyle,
    rotationPhilosophy: rotation.rotationPhilosophy,
    rotationDepth: rotation.rotationDepth,
  };
}

export function cloneEditorState(
  state: LineupRotationEditorState,
): LineupRotationEditorState {
  return {
    starters: state.starters.map((s) => ({ ...s })),
    bench: [...state.bench],
    inactive: [...state.inactive],
    rows: state.rows.map((row) => ({
      ...row,
      preferredPositions: [...row.preferredPositions],
      secondaryPositions: [...row.secondaryPositions],
    })),
    preset: state.preset,
    closingPolicy: state.closingPolicy,
    closingIds: [...state.closingIds],
    rotationStyle: state.rotationStyle,
    rotationPhilosophy: state.rotationPhilosophy,
    rotationDepth: state.rotationDepth,
  };
}

/** Detect duplicate player IDs across starter / bench / inactive groups. */
export function findDuplicateAssignments(
  state: LineupRotationEditorState,
): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const id of [
    ...state.starters.map((s) => s.playerId),
    ...state.bench,
    ...state.inactive,
  ]) {
    if (seen.has(id)) {
      dupes.push(id);
    }
    seen.add(id);
  }
  return dupes;
}

function syncRowGroups(state: LineupRotationEditorState): EditableRotationRow[] {
  const starterIds = new Set(state.starters.map((s) => s.playerId));
  const inactiveIds = new Set(state.inactive);
  return state.rows.map((row) => {
    if (inactiveIds.has(row.playerId)) {
      return {
        ...row,
        groupRole: "inactive",
        targetMinutes: 0,
        projectedMinutes: 0,
        rotationStatus: "inactive",
      };
    }
    if (starterIds.has(row.playerId)) {
      return {
        ...row,
        groupRole: "starter",
        role: row.role === "starter" ? row.role : "starter",
        rotationStatus:
          row.rotationStatus === "inactive" ? "active" : row.rotationStatus,
      };
    }
    return {
      ...row,
      groupRole: "bench",
      role: row.role === "starter" ? "bench" : row.role,
      rotationStatus:
        row.rotationStatus === "inactive" ? "active" : row.rotationStatus,
    };
  });
}

/**
 * Change a starter slot. Previous starter returns to bench; selected player
 * leaves bench/inactive. Display-level rotation rows stay membership-aligned.
 */
export function setStarterSlot(
  state: LineupRotationEditorState,
  slot: string,
  playerId: string,
): LineupRotationEditorState {
  const previous = state.starters.find((row) => row.slot === slot)?.playerId;
  const starters = state.starters.map((row) =>
    row.slot === slot ? { ...row, playerId } : row,
  );
  let bench = state.bench.filter((id) => id !== playerId);
  if (previous && previous !== playerId && !bench.includes(previous)) {
    bench = [...bench, previous];
  }
  const inactive = state.inactive.filter((id) => id !== playerId);
  const next: LineupRotationEditorState = {
    ...state,
    starters,
    bench,
    inactive,
    preset: "custom",
  };
  return { ...next, rows: syncRowGroups(next) };
}

export function moveBenchToInactive(
  state: LineupRotationEditorState,
  playerId: string,
): LineupRotationEditorState {
  if (!state.bench.includes(playerId)) {
    return state;
  }
  const next: LineupRotationEditorState = {
    ...state,
    bench: state.bench.filter((id) => id !== playerId),
    inactive: state.inactive.includes(playerId)
      ? state.inactive
      : [...state.inactive, playerId],
    closingIds: state.closingIds.filter((id) => id !== playerId),
    preset: "custom",
  };
  return { ...next, rows: syncRowGroups(next) };
}

export function moveInactiveToBench(
  state: LineupRotationEditorState,
  playerId: string,
): LineupRotationEditorState {
  if (!state.inactive.includes(playerId)) {
    return state;
  }
  const next: LineupRotationEditorState = {
    ...state,
    inactive: state.inactive.filter((id) => id !== playerId),
    bench: state.bench.includes(playerId)
      ? state.bench
      : [...state.bench, playerId],
    preset: "custom",
  };
  return { ...next, rows: syncRowGroups(next) };
}

export function updateRotationRow(
  state: LineupRotationEditorState,
  playerId: string,
  patch: Partial<EditableRotationRow>,
): LineupRotationEditorState {
  return {
    ...state,
    preset: "custom",
    rows: state.rows.map((row) => {
      if (row.playerId !== playerId) {
        return row;
      }
      const next = { ...row, ...patch };
      if (row.groupRole === "inactive") {
        next.targetMinutes = 0;
        next.projectedMinutes = 0;
      }
      return next;
    }),
  };
}

export function applyOptimizedManagement(
  state: LineupRotationEditorState,
  management: {
    startingLineup: Array<{ playerId: string; slot: string }>;
    bench: string[];
    inactive: string[];
    rotation: Array<{
      playerId: string;
      targetMinutes: number;
      rotationPriority: number;
      rotationStatus: string;
      role: string;
      preferredPositions: string[];
      secondaryPositions: string[];
      minutePriorityBias: number;
      overrideMedicalRecommendation?: boolean;
    }>;
    rotationPreset: string;
    closingLineupPolicy: string;
    closingLineupIds: string[];
    rotationStyle?: string;
    rotationPhilosophy?: string;
    rotationDepth?: number;
  },
): LineupRotationEditorState {
  const byId = new Map(management.rotation.map((e) => [e.playerId, e]));
  const starterIds = new Set(
    management.startingLineup.map((s) => s.playerId),
  );
  const inactiveIds = new Set(management.inactive);
  const rows = state.rows.map((row) => {
    const entry = byId.get(row.playerId);
    if (!entry) {
      if (inactiveIds.has(row.playerId)) {
        return {
          ...row,
          groupRole: "inactive",
          targetMinutes: 0,
          projectedMinutes: 0,
          rotationStatus: "inactive",
        };
      }
      return row;
    }
    return {
      ...row,
      targetMinutes: entry.targetMinutes,
      projectedMinutes: entry.targetMinutes,
      rotationPriority: entry.rotationPriority,
      rotationStatus: entry.rotationStatus,
      role: entry.role,
      preferredPositions: [...entry.preferredPositions],
      secondaryPositions: [...entry.secondaryPositions],
      minutePriorityBias: entry.minutePriorityBias,
      overrideMedicalRecommendation:
        entry.overrideMedicalRecommendation === true,
      groupRole: inactiveIds.has(row.playerId)
        ? "inactive"
        : starterIds.has(row.playerId)
          ? "starter"
          : "bench",
    };
  });

  // Add rows for players present in optimized rotation but missing locally
  for (const entry of management.rotation) {
    if (rows.some((r) => r.playerId === entry.playerId)) {
      continue;
    }
    const meta = state.rows.find((r) => r.playerId === entry.playerId);
    rows.push({
      playerId: entry.playerId,
      targetMinutes: entry.targetMinutes,
      rotationPriority: entry.rotationPriority,
      rotationStatus: entry.rotationStatus,
      role: entry.role,
      preferredPositions: [...entry.preferredPositions],
      secondaryPositions: [...entry.secondaryPositions],
      minutePriorityBias: entry.minutePriorityBias,
      overrideMedicalRecommendation:
        entry.overrideMedicalRecommendation === true,
      groupRole: starterIds.has(entry.playerId) ? "starter" : "bench",
      firstName: meta?.firstName ?? entry.playerId,
      lastName: meta?.lastName ?? "",
      position: meta?.position ?? "SF",
      overall: meta?.overall,
      actualMinutes: 0,
      projectedMinutes: entry.targetMinutes,
      availabilityStatus: meta?.availabilityStatus ?? "available",
      availabilityLabel: meta?.availabilityLabel ?? "Available",
    });
  }

  return {
    ...state,
    starters: management.startingLineup.map((s) => ({
      playerId: s.playerId,
      slot: s.slot,
    })),
    bench: [...management.bench],
    inactive: [...management.inactive],
    rows,
    preset: management.rotationPreset,
    closingPolicy: management.closingLineupPolicy,
    closingIds: management.closingLineupIds.map(String),
    rotationStyle: management.rotationStyle ?? state.rotationStyle,
    rotationPhilosophy:
      management.rotationPhilosophy ?? state.rotationPhilosophy,
    rotationDepth: management.rotationDepth ?? state.rotationDepth,
  };
}

export function toSavePayload(
  state: LineupRotationEditorState,
): LineupRotationSavePayload {
  const inactiveIds = new Set(state.inactive);
  const rotation = state.rows
    .filter((row) => !inactiveIds.has(row.playerId))
    .map((row) => ({
      playerId: row.playerId,
      targetMinutes: row.targetMinutes,
      rotationPriority: row.rotationPriority,
      rotationStatus: row.rotationStatus,
      role: row.role,
      preferredPositions: row.preferredPositions,
      secondaryPositions: row.secondaryPositions,
      minutePriorityBias: row.minutePriorityBias,
      overrideMedicalRecommendation: row.overrideMedicalRecommendation,
    }));

  return {
    startingLineup: state.starters.map((s) => ({ ...s })),
    bench: [...state.bench],
    inactive: [...state.inactive],
    rotation,
    rotationPreset: state.preset,
    rotationStyle: state.rotationStyle,
    rotationPhilosophy: state.rotationPhilosophy,
    rotationDepth: state.rotationDepth,
    closingLineupPolicy: state.closingPolicy,
    closingLineupIds: [...state.closingIds],
  };
}

export function collectPlayerCards(
  lineup: LineupView,
): Map<string, PlayerCardLike> {
  const map = new Map<string, PlayerCardLike>();
  for (const player of [
    ...lineup.starters,
    ...lineup.bench,
    ...lineup.inactive,
  ]) {
    map.set(player.playerId, {
      playerId: player.playerId,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      overall: player.overall,
      plannedMinutes: player.plannedMinutes,
      availabilityLabel: player.availabilityLabel,
      available: player.available,
      role: player.role,
      archetypeLabel: player.archetypeLabel,
    });
  }
  return map;
}

export function buildOptimizeChangelog(
  before: EditableRotationRow[],
  after: EditableRotationRow[],
): string[] {
  const beforeById = new Map(before.map((row) => [row.playerId, row]));
  const lines: string[] = [];
  for (const row of after) {
    const prev = beforeById.get(row.playerId);
    if (prev == null) continue;
    const parts: string[] = [];
    if (prev.targetMinutes !== row.targetMinutes) {
      parts.push(`${prev.targetMinutes} → ${row.targetMinutes} MPG`);
    }
    if (prev.role !== row.role) {
      parts.push(`role ${prev.role} → ${row.role}`);
    }
    if (prev.rotationPriority !== row.rotationPriority) {
      parts.push(`pri ${prev.rotationPriority} → ${row.rotationPriority}`);
    }
    if (parts.length > 0) {
      lines.push(`${row.firstName} ${row.lastName}: ${parts.join(", ")}`);
    }
  }
  return lines;
}

export const CORE_ROTATION_ROLES = new Set([
  "starter",
  "sixth_man",
  "rotation",
]);

export const DEPTH_ROTATION_ROLES = new Set([
  "bench",
  "deep_bench",
  "emergency",
]);

export function rotationGroupLabel(row: EditableRotationRow): "core" | "depth" | "inactive" {
  if (row.groupRole === "inactive") {
    return "inactive";
  }
  if (CORE_ROTATION_ROLES.has(row.role)) {
    return "core";
  }
  return "depth";
}
