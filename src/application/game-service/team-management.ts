import "server-only";
import {
  toTeamManagementOverview,
  toLineupView,
  toRotationView,
  toCoachingView,
  toInjuryReportView,
  toSeasonTransactionsView,
} from "@/state/team-management-selectors";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { toDashboardSnapshot } from "@/state/selectors";
import { ownerNavGroupsForState } from "@/application/owner-nav-config";
import type { GameState } from "@/state/game-state";
import {
  updateLineupCommand,
  updateLineupAndRotationCommand,
  updateRotationCommand,
  optimizeRotationCommand,
  applyLineupRecommendationCommand,
  updateCoachingPhilosophyCommand,
  applyCoachingPresetCommand,
} from "@/systems/team-management-commands";
import { asTeamId, asPlayerId } from "@/domain/ids";
import type { TeamRosterManagement } from "@/domain/entities/team-roster-management";
import {
  type OptimizeChange,
  getTeamRosterManagement,
  mergeLineupIntoManagement,
  applyRotationEditsToManagement,
  withTeamRosterManagement,
  previewOptimizeRotation,
} from "@/systems/roster-management";
import type {
  CreateGameResult,
  OwnerCommandResult,
} from "@/application/game-service/types";
import {
  getStore,
  toSaveSummary,
  fail,
  persistWorkingState,
  withDashboard,
} from "@/application/game-service/internal";

export type TeamManagementView = CreateGameResult & {
  overview: ReturnType<typeof toTeamManagementOverview>;
  lineup: ReturnType<typeof toLineupView>;
  rotation: ReturnType<typeof toRotationView>;
  coaching: ReturnType<typeof toCoachingView>;
  injuries: ReturnType<typeof toInjuryReportView>;
  transactions: ReturnType<typeof toSeasonTransactionsView>;
};

export async function loadTeamManagementView(
  saveId: string,
  transactionQuery?: {
    scope?: "team" | "league";
    type?: string;
    sort?: string;
    page?: number;
  },
  store?: SaveGameStore,
): Promise<TeamManagementView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const state = loaded.state;
  const scope = transactionQuery?.scope === "league" ? "league" : "team";
  const sort =
    transactionQuery?.sort === "oldest" ||
    transactionQuery?.sort === "type" ||
    transactionQuery?.sort === "team" ||
    transactionQuery?.sort === "player"
      ? transactionQuery.sort
      : "newest";
  const type =
    transactionQuery?.type && transactionQuery.type !== "all"
      ? (transactionQuery.type as Parameters<
          typeof toSeasonTransactionsView
        >[1]["type"])
      : "all";

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    overview: toTeamManagementOverview(state),
    lineup: toLineupView(state),
    rotation: toRotationView(state),
    coaching: toCoachingView(state),
    injuries: toInjuryReportView(state),
    transactions: toSeasonTransactionsView(state, {
      scope,
      type,
      sort,
      page: transactionQuery?.page ?? 0,
      pageSize: 50,
    }),
    navGroups: ownerNavGroupsForState(state),
  };
}

async function runTeamManagementMutation(
  saveId: string,
  mutate: (
    state: GameState,
  ) => { ok: true; state: GameState } | { ok: false; error: string },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const result = mutate(loaded.state);
  if (!result.ok) {
    return fail(result.error);
  }
  const saved = await persistWorkingState(
    saveId,
    result.state,
    loaded.state.meta.rngState,
    saveStore,
  );
  return withDashboard(saved);
}

export async function updateOwnerLineup(
  saveId: string,
  input: {
    teamId: string;
    startingLineup: Array<{ playerId: string; slot: string }>;
    bench: string[];
    inactive: string[];
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      updateLineupCommand(state, {
        teamId: asTeamId(input.teamId),
        startingLineup: input.startingLineup.map((slot) => ({
          playerId: asPlayerId(slot.playerId),
          slot: slot.slot as "PG" | "SG" | "SF" | "PF" | "C",
        })),
        bench: input.bench.map((id) => asPlayerId(id)),
        inactive: input.inactive.map((id) => asPlayerId(id)),
      }),
    store,
  );
}

function mapRotationEntriesForCommand(
  rotation: Array<{
    playerId: string;
    targetMinutes: number;
    minimumMinutes?: number;
    normalMaximumMinutes?: number;
    absoluteMaximumMinutes?: number;
    rotationPriority: number;
    rotationStatus: string;
    role: string;
    preferredPositions: string[];
    secondaryPositions?: string[];
    minutePriorityBias?: number;
    overrideMedicalRecommendation?: boolean;
  }>,
) {
  return rotation.map((entry) => ({
    playerId: asPlayerId(entry.playerId),
    targetMinutes: entry.targetMinutes,
    minimumMinutes: entry.minimumMinutes ?? 0,
    normalMaximumMinutes: entry.normalMaximumMinutes ?? 0,
    absoluteMaximumMinutes: entry.absoluteMaximumMinutes ?? 0,
    rotationPriority: entry.rotationPriority as 1 | 2 | 3 | 4 | 5,
    rotationStatus: entry.rotationStatus as "active" | "inactive" | "emergency",
    role: entry.role as
      | "starter"
      | "sixth_man"
      | "rotation"
      | "bench"
      | "deep_bench"
      | "emergency",
    preferredPositions: entry.preferredPositions as Array<
      "PG" | "SG" | "SF" | "PF" | "C"
    >,
    secondaryPositions: (entry.secondaryPositions ?? []) as Array<
      "PG" | "SG" | "SF" | "PF" | "C"
    >,
    minutePriorityBias: (entry.minutePriorityBias ?? 0) as -1 | 0 | 1,
    overrideMedicalRecommendation: entry.overrideMedicalRecommendation === true,
  }));
}

export async function updateOwnerLineupAndRotation(
  saveId: string,
  input: {
    teamId: string;
    startingLineup: Array<{ playerId: string; slot: string }>;
    bench: string[];
    inactive: string[];
    rotation: Array<{
      playerId: string;
      targetMinutes: number;
      minimumMinutes?: number;
      normalMaximumMinutes?: number;
      absoluteMaximumMinutes?: number;
      rotationPriority: number;
      rotationStatus: string;
      role: string;
      preferredPositions: string[];
      secondaryPositions?: string[];
      minutePriorityBias?: number;
      overrideMedicalRecommendation?: boolean;
    }>;
    rotationStyle?: string;
    rotationPhilosophy?: string;
    rotationDepth?: number;
    rotationPreset?: string;
    closingLineupPolicy?: string;
    closingLineupIds?: string[];
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      updateLineupAndRotationCommand(state, {
        teamId: asTeamId(input.teamId),
        startingLineup: input.startingLineup.map((slot) => ({
          playerId: asPlayerId(slot.playerId),
          slot: slot.slot as "PG" | "SG" | "SF" | "PF" | "C",
        })),
        bench: input.bench.map((id) => asPlayerId(id)),
        inactive: input.inactive.map((id) => asPlayerId(id)),
        rotation: mapRotationEntriesForCommand(input.rotation),
        rotationStyle: input.rotationStyle as
          "tight" | "balanced" | "deep" | undefined,
        rotationPhilosophy: input.rotationPhilosophy as
          | "deep"
          | "balanced"
          | "tight"
          | "star_heavy"
          | "development"
          | undefined,
        rotationDepth: input.rotationDepth,
        rotationPreset: input.rotationPreset as
          | "auto"
          | "balanced"
          | "star_heavy"
          | "deep"
          | "development"
          | "custom"
          | undefined,
        closingLineupPolicy: input.closingLineupPolicy as
          "auto" | "best_five" | "starters" | "custom" | undefined,
        closingLineupIds: input.closingLineupIds?.map((id) => asPlayerId(id)),
      }),
    store,
  );
}

/**
 * Preview optimize against a posted lineup+rotation draft without persisting.
 * Uses full GameState + recommendRosterManagement (not suitable for client bundle).
 */
export async function previewOwnerOptimizeRotation(
  saveId: string,
  input: {
    teamId: string;
    startingLineup: Array<{ playerId: string; slot: string }>;
    bench: string[];
    inactive: string[];
    rotation: Array<{
      playerId: string;
      targetMinutes: number;
      minimumMinutes?: number;
      normalMaximumMinutes?: number;
      absoluteMaximumMinutes?: number;
      rotationPriority: number;
      rotationStatus: string;
      role: string;
      preferredPositions: string[];
      secondaryPositions?: string[];
      minutePriorityBias?: number;
      overrideMedicalRecommendation?: boolean;
    }>;
    rotationStyle?: string;
    rotationPhilosophy?: string;
    rotationDepth?: number;
    rotationPreset?: string;
    closingLineupPolicy?: string;
    closingLineupIds?: string[];
  },
  store?: SaveGameStore,
): Promise<
  | {
      ok: true;
      management: TeamRosterManagement;
      changelog: OptimizeChange[];
    }
  | { ok: false; error: string }
> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return { ok: false, error: "Save not found." };
  }
  const teamId = asTeamId(input.teamId);
  const current = getTeamRosterManagement(loaded.state, teamId);
  const afterLineup = mergeLineupIntoManagement(loaded.state, teamId, current, {
    startingLineup: input.startingLineup.map((slot) => ({
      playerId: asPlayerId(slot.playerId),
      slot: slot.slot as "PG" | "SG" | "SF" | "PF" | "C",
    })),
    bench: input.bench.map((id) => asPlayerId(id)),
    inactive: input.inactive.map((id) => asPlayerId(id)),
  });
  const applied = applyRotationEditsToManagement(
    loaded.state,
    teamId,
    afterLineup,
    {
      rotation: mapRotationEntriesForCommand(input.rotation),
      rotationStyle: input.rotationStyle as
        "tight" | "balanced" | "deep" | undefined,
      rotationPhilosophy: input.rotationPhilosophy as
        | "deep"
        | "balanced"
        | "tight"
        | "star_heavy"
        | "development"
        | undefined,
      rotationDepth: input.rotationDepth,
      rotationPreset: input.rotationPreset as
        | "auto"
        | "balanced"
        | "star_heavy"
        | "deep"
        | "development"
        | "custom"
        | undefined,
      closingLineupPolicy: input.closingLineupPolicy as
        "auto" | "best_five" | "starters" | "custom" | undefined,
      closingLineupIds: input.closingLineupIds?.map((id) => asPlayerId(id)),
    },
  );
  if (!applied.ok) {
    return applied;
  }
  const draftState = withTeamRosterManagement(
    loaded.state,
    teamId,
    applied.management,
  );
  const preview = previewOptimizeRotation(draftState, teamId, {
    rotationPreset:
      (input.rotationPreset as
        | "auto"
        | "balanced"
        | "star_heavy"
        | "deep"
        | "development"
        | "custom"
        | undefined) ?? "auto",
    configuredBy: "user",
  });
  return {
    ok: true,
    management: preview.management,
    changelog: preview.changelog,
  };
}

export async function updateOwnerRotation(
  saveId: string,
  input: {
    teamId: string;
    rotation: Array<{
      playerId: string;
      targetMinutes: number;
      minimumMinutes?: number;
      normalMaximumMinutes?: number;
      absoluteMaximumMinutes?: number;
      rotationPriority: number;
      rotationStatus: string;
      role: string;
      preferredPositions: string[];
      secondaryPositions?: string[];
      minutePriorityBias?: number;
      overrideMedicalRecommendation?: boolean;
    }>;
    rotationStyle?: string;
    rotationPhilosophy?: string;
    rotationDepth?: number;
    rotationPreset?: string;
    closingLineupPolicy?: string;
    closingLineupIds?: string[];
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      updateRotationCommand(state, {
        teamId: asTeamId(input.teamId),
        rotation: input.rotation.map((entry) => ({
          playerId: asPlayerId(entry.playerId),
          targetMinutes: entry.targetMinutes,
          minimumMinutes: entry.minimumMinutes ?? 0,
          normalMaximumMinutes: entry.normalMaximumMinutes ?? 0,
          absoluteMaximumMinutes: entry.absoluteMaximumMinutes ?? 0,
          rotationPriority: entry.rotationPriority as 1 | 2 | 3 | 4 | 5,
          rotationStatus: entry.rotationStatus as
            "active" | "inactive" | "emergency",
          role: entry.role as
            | "starter"
            | "sixth_man"
            | "rotation"
            | "bench"
            | "deep_bench"
            | "emergency",
          preferredPositions: entry.preferredPositions as Array<
            "PG" | "SG" | "SF" | "PF" | "C"
          >,
          secondaryPositions: (entry.secondaryPositions ?? []) as Array<
            "PG" | "SG" | "SF" | "PF" | "C"
          >,
          minutePriorityBias: (entry.minutePriorityBias ?? 0) as -1 | 0 | 1,
          overrideMedicalRecommendation:
            entry.overrideMedicalRecommendation === true,
        })),
        rotationStyle: input.rotationStyle as
          "tight" | "balanced" | "deep" | undefined,
        rotationPhilosophy: input.rotationPhilosophy as
          | "deep"
          | "balanced"
          | "tight"
          | "star_heavy"
          | "development"
          | undefined,
        rotationDepth: input.rotationDepth,
        rotationPreset: input.rotationPreset as
          | "auto"
          | "balanced"
          | "star_heavy"
          | "deep"
          | "development"
          | "custom"
          | undefined,
        closingLineupPolicy: input.closingLineupPolicy as
          "auto" | "best_five" | "starters" | "custom" | undefined,
        closingLineupIds: input.closingLineupIds?.map((id) => asPlayerId(id)),
      }),
    store,
  );
}

export async function optimizeOwnerRotation(
  saveId: string,
  input: {
    teamId: string;
    rotationPreset?: string;
    rotationPhilosophy?: string;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      optimizeRotationCommand(state, {
        teamId: asTeamId(input.teamId),
        rotationPreset: input.rotationPreset as
          | "auto"
          | "balanced"
          | "star_heavy"
          | "deep"
          | "development"
          | "custom"
          | undefined,
        rotationPhilosophy: input.rotationPhilosophy as
          | "deep"
          | "balanced"
          | "tight"
          | "star_heavy"
          | "development"
          | undefined,
      }),
    store,
  );
}

export async function applyOwnerLineupRecommendation(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) => applyLineupRecommendationCommand(state, asTeamId(teamId)),
    store,
  );
}

export async function updateOwnerCoachingPhilosophy(
  saveId: string,
  input: {
    teamId: string;
    pace: string;
    offensiveEmphasis: string;
    defensiveApproach: string;
  },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      updateCoachingPhilosophyCommand(state, {
        teamId: asTeamId(input.teamId),
        philosophy: {
          pace: input.pace as "fast" | "balanced" | "halfCourt",
          offensiveEmphasis: input.offensiveEmphasis as
            "threePointHeavy" | "balanced" | "inside",
          defensiveApproach: input.defensiveApproach as
            "aggressive" | "balanced" | "conservative",
        },
      }),
    store,
  );
}

export async function applyOwnerCoachingPreset(
  saveId: string,
  input: { teamId: string; presetId: string },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return runTeamManagementMutation(
    saveId,
    (state) =>
      applyCoachingPresetCommand(state, {
        teamId: asTeamId(input.teamId),
        presetId: input.presetId as Parameters<
          typeof applyCoachingPresetCommand
        >[1]["presetId"],
      }),
    store,
  );
}
