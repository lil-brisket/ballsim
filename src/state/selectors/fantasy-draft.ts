import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import {
  type FantasyDraftAutoPickStrategy,
  type FantasyDraftTeamSummary,
  type FantasyDraftLeagueRecap,
  fantasyDraftPlayerTier,
} from "@/domain/entities/fantasy-draft";
import {
  type TeamBrandingView,
  toBrandingView,
} from "@/state/team-branding-view";
import type { GameState } from "@/state/game-state";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import {
  getCurrentPick,
  getNextPick,
  getNextPickNumberForTeam,
} from "@/systems/fantasy-draft/draft-order";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { ARCHETYPE_LABELS } from "@/domain/entities/player-archetype";
import { calculateTeamDraftNeeds } from "@/systems/draft/draft-needs";
import {
  getAvailableDraftPlayers,
  isUserOnFantasyDraftClock,
  getRemainingPickSeconds,
} from "@/systems/fantasy-draft/draft-clock";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import {
  draftTalentScore,
  rankCandidates,
  fantasyDraftPositionCounts,
} from "@/systems/fantasy-draft/draft-evaluation";
import { derivePlayerStrengthsWeaknesses } from "@/domain/player-evaluation";

export type FantasyDraftPoolPlayerView = {
  playerId: string;
  /** Persisted portrait (world.playerPortraits); null → initials fallback. */
  portrait: PlayerPortraitAssignment | null;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  archetype: string;
  archetypeLabel: string;
  overall: number;
  potential: number;
  tier: string;
  isDrafted: boolean;
  draftedByTeamId: string | null;
  draftedByAbbreviation: string | null;
  pickNumber: number | null;
  round: number | null;
};

export type FantasyDraftQueueEntryView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  potential: number;
  isAvailable: boolean;
  draftedByTeamId: string | null;
  draftedByAbbreviation: string | null;
  pickNumber: number | null;
};

export type FantasyDraftRecommendationView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  potential: number;
  tier: string;
};

export type FantasyDraftView = {
  status: string;
  draftType: string;
  orderMode: string;
  orderConfirmed: boolean;
  picksPerTeam: number;
  totalPicks: number;
  currentPickNumber: number | null;
  currentRound: number | null;
  draftProgressPercent: number;
  onClockTeamId: string | null;
  onClockTeamName: string | null;
  onClockTeamAbbreviation: string | null;
  onClockIsUser: boolean;
  nextTeamId: string | null;
  nextTeamName: string | null;
  userOnClock: boolean;
  timerEnabled: boolean;
  timerSecondsPerPick: number;
  pickStartedAt: string | null;
  remainingSeconds: number | null;
  paused: boolean;
  activeOwnerTeamId: string;
  settings: { confirmPicks: boolean };
  autoPickStrategy: FantasyDraftAutoPickStrategy;
  draftOrder: Array<{
    pickNumber: number;
    teamId: string;
    teamName: string;
    abbreviation: string;
    isUser: boolean;
    branding: TeamBrandingView | null;
  }>;
  controlledFranchises: Array<{
    teamId: string;
    teamName: string;
    abbreviation: string;
    isActive: boolean;
    isOnClock: boolean;
    autoPick: boolean;
    autoPickStrategy: FantasyDraftAutoPickStrategy;
    nextPickNumber: number | null;
    rosterCount: number;
    branding: TeamBrandingView | null;
  }>;
  availablePlayers: FantasyDraftPoolPlayerView[];
  poolPlayers: FantasyDraftPoolPlayerView[];
  queue: FantasyDraftQueueEntryView[];
  teamNeeds: Array<{ position: string; level: "HIGH" | "MEDIUM" | "LOW" }>;
  bestAvailable: FantasyDraftRecommendationView | null;
  bestFit: FantasyDraftRecommendationView | null;
  activeRoster: Array<{
    playerId: string;
    name: string;
    position: string;
    overall: number;
  }>;
  positionCounts: Array<{ position: string; count: number }>;
  selections: Array<{
    pickNumber: number;
    round: number;
    pickInRound: number;
    teamId: string;
    teamAbbreviation: string;
    teamName: string;
    playerId: string;
    playerName: string;
    position: string;
  }>;
  undraftedCount: number;
  selectionsMade: number;
};

export type FantasyDraftPlayerDetailView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  archetype: string;
  archetypeLabel: string;
  nationality: string;
  overall: number;
  potential: number;
  tier: string;
  injuryKind: string;
  developmentStage: string;
  attributes: Record<string, number>;
  strengths: Array<{ label: string; rating: number }>;
  weaknesses: Array<{ label: string; rating: number }>;
  isDrafted: boolean;
  draftedByTeamId: string | null;
  draftedByTeamName: string | null;
  draftedByAbbreviation: string | null;
  pickNumber: number | null;
  round: number | null;
  inActiveQueue: boolean;
};

export type FantasyDraftSummaryView = {
  status: string;
  totalPicks: number;
  selectionsMade: number;
  undraftedCount: number;
  controlledTeamIds: string[];
  teamSummaries: Record<string, FantasyDraftTeamSummary>;
  leagueRecap: FantasyDraftLeagueRecap | null;
  teamNames: Record<string, { name: string; abbreviation: string }>;
};

function mapNeedLevel(level: string): "HIGH" | "MEDIUM" | "LOW" {
  if (level === "critical" || level === "major") return "HIGH";
  if (level === "moderate") return "MEDIUM";
  return "LOW";
}

function toRecommendationView(
  state: GameState,
  playerId: string | undefined,
): FantasyDraftRecommendationView | null {
  if (!playerId) return null;
  const player = state.world.players[playerId as PlayerId];
  if (!player) return null;
  const overall = calculatePlayerOverall(player.position, player.attributes);
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    overall,
    potential: player.potential.overall,
    tier: fantasyDraftPlayerTier(overall),
  };
}

export function toFantasyDraftView(
  state: GameState,
  nowIso: string = new Date().toISOString(),
): FantasyDraftView | null {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return null;
  }

  const current = getCurrentPick(state);
  const next = getNextPick(state);
  const onClockTeam = current ? state.world.teams[current.teamId] : undefined;
  const nextTeam = next ? state.world.teams[next.teamId] : undefined;
  const activeOwnerTeamId = state.user.activeOwnerTeamId;

  const selectionByPlayer = new Map(
    draft.selections.map((sel) => [String(sel.playerId), sel]),
  );

  const draftOrder = draft.draftOrder.map((teamId, index) => {
    const team = state.world.teams[teamId];
    return {
      pickNumber: index + 1,
      teamId,
      teamName: team ? `${team.city} ${team.name}` : teamId,
      abbreviation: team?.abbreviation ?? "???",
      isUser: state.user.ownedTeamIds.includes(teamId as TeamId),
      branding: toBrandingView(team?.branding),
    };
  });

  const controlledFranchises = state.user.ownedTeamIds.map((teamId) => {
    const team = state.world.teams[teamId];
    const strategy = draft.autoPickStrategy[teamId] ?? "queue_then_best_fit";
    return {
      teamId,
      teamName: team ? `${team.city} ${team.name}` : teamId,
      abbreviation: team?.abbreviation ?? "???",
      isActive: teamId === activeOwnerTeamId,
      isOnClock: current?.teamId === teamId,
      autoPick: Boolean(draft.userTeamAutoPick[teamId]),
      autoPickStrategy: strategy,
      nextPickNumber: getNextPickNumberForTeam(state, teamId),
      rosterCount: team?.roster.length ?? 0,
      branding: toBrandingView(team?.branding),
    };
  });

  const poolPlayers: FantasyDraftPoolPlayerView[] = [];
  for (const playerId of draft.poolPlayerIds) {
    const player = state.world.players[playerId];
    if (!player) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    const selection = selectionByPlayer.get(String(playerId));
    const draftedTeam = selection
      ? state.world.teams[selection.teamId]
      : undefined;
    poolPlayers.push({
      playerId: String(player.id),
      portrait: selectPlayerPortrait(state, player.id),
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      heightInches: player.heightInches,
      weightPounds: player.weightPounds,
      archetype: player.archetype,
      archetypeLabel: ARCHETYPE_LABELS[player.archetype] ?? player.archetype,
      overall,
      potential: player.potential.overall,
      tier: fantasyDraftPlayerTier(overall),
      isDrafted: selection !== undefined,
      draftedByTeamId: selection?.teamId ?? null,
      draftedByAbbreviation: draftedTeam?.abbreviation ?? null,
      pickNumber: selection?.pickNumber ?? null,
      round: selection?.round ?? null,
    });
  }
  poolPlayers.sort((a, b) => b.overall - a.overall);

  const availablePlayers = poolPlayers.filter((p) => !p.isDrafted);

  const queueIds = draft.teamQueues[activeOwnerTeamId] ?? [];
  const queueEntries: FantasyDraftQueueEntryView[] = queueIds.map(
    (playerId) => {
      const player = state.world.players[playerId];
      const selection = selectionByPlayer.get(String(playerId));
      const draftedTeam = selection
        ? state.world.teams[selection.teamId]
        : undefined;
      const overall = player
        ? calculatePlayerOverall(player.position, player.attributes)
        : 0;
      return {
        playerId,
        firstName: player?.firstName ?? "Unknown",
        lastName: player?.lastName ?? "",
        position: player?.position ?? "?",
        overall,
        potential: player?.potential.overall ?? 0,
        isAvailable: selection === undefined,
        draftedByTeamId: selection?.teamId ?? null,
        draftedByAbbreviation: draftedTeam?.abbreviation ?? null,
        pickNumber: selection?.pickNumber ?? null,
      };
    },
  );
  const queue = [
    ...queueEntries.filter((e) => e.isAvailable),
    ...queueEntries.filter((e) => !e.isAvailable),
  ];

  const needs = calculateTeamDraftNeeds(state, activeOwnerTeamId);
  const teamNeeds = ["PG", "SG", "SF", "PF", "C"].map((position) => {
    const row = needs.byPosition.find((n) => n.position === position);
    return {
      position,
      level: mapNeedLevel(row?.level ?? "none"),
    };
  });

  const availableEntities = getAvailableDraftPlayers(state);
  const prefs = resolveFranchisePreferences(
    state,
    activeOwnerTeamId,
  )?.preferences;
  let bestAvailableId: string | undefined;
  let bestTalent = -Infinity;
  for (const player of availableEntities) {
    const score = draftTalentScore(player, prefs);
    if (score > bestTalent) {
      bestTalent = score;
      bestAvailableId = player.id;
    }
  }
  const fitRanked = rankCandidates(
    state,
    activeOwnerTeamId,
    availableEntities,
    current?.round ?? 1,
    draft.picksPerTeam,
  );
  const bestAvailable = toRecommendationView(state, bestAvailableId);
  const bestFit = toRecommendationView(state, fitRanked[0]);

  const activeTeam = state.world.teams[activeOwnerTeamId];
  const activeRoster =
    activeTeam?.roster.map((playerId) => {
      const player = state.world.players[playerId];
      return {
        playerId,
        name: player ? `${player.firstName} ${player.lastName}` : playerId,
        position: player?.position ?? "?",
        overall: player
          ? calculatePlayerOverall(player.position, player.attributes)
          : 0,
      };
    }) ?? [];

  const counts = fantasyDraftPositionCounts(state, activeOwnerTeamId);
  const positionCounts = ["PG", "SG", "SF", "PF", "C"].map((position) => ({
    position,
    count: counts.get(position as "PG") ?? 0,
  }));

  const selections = draft.selections.map((selection) => {
    const team = state.world.teams[selection.teamId];
    const player = state.world.players[selection.playerId];
    return {
      pickNumber: selection.pickNumber,
      round: selection.round,
      pickInRound: selection.pickInRound,
      teamId: selection.teamId,
      teamAbbreviation: team?.abbreviation ?? "???",
      teamName: team ? `${team.city} ${team.name}` : selection.teamId,
      playerId: selection.playerId,
      playerName: player
        ? `${player.firstName} ${player.lastName}`
        : selection.playerId,
      position: player?.position ?? "?",
    };
  });

  const selectionsMade = draft.selections.length;
  const draftProgressPercent =
    draft.totalPicks > 0
      ? Math.round((selectionsMade / draft.totalPicks) * 100)
      : 0;

  return {
    status: draft.status,
    draftType: draft.draftType,
    orderMode: draft.orderMode,
    orderConfirmed: draft.orderConfirmed,
    picksPerTeam: draft.picksPerTeam,
    totalPicks: draft.totalPicks,
    currentPickNumber: draft.currentPickNumber,
    currentRound: current?.round ?? null,
    draftProgressPercent,
    onClockTeamId: current?.teamId ?? null,
    onClockTeamName: onClockTeam
      ? `${onClockTeam.city} ${onClockTeam.name}`
      : null,
    onClockTeamAbbreviation: onClockTeam?.abbreviation ?? null,
    onClockIsUser: current
      ? state.user.ownedTeamIds.includes(current.teamId)
      : false,
    nextTeamId: next?.teamId ?? null,
    nextTeamName: nextTeam ? `${nextTeam.city} ${nextTeam.name}` : null,
    userOnClock: isUserOnFantasyDraftClock(state),
    timerEnabled: draft.timer.enabled,
    timerSecondsPerPick: draft.timer.secondsPerPick,
    pickStartedAt: draft.timer.pickStartedAt,
    remainingSeconds: getRemainingPickSeconds(draft, nowIso),
    paused: draft.status === "paused",
    activeOwnerTeamId,
    settings: {
      confirmPicks: draft.settings?.confirmPicks ?? true,
    },
    autoPickStrategy:
      draft.autoPickStrategy[activeOwnerTeamId] ?? "queue_then_best_fit",
    draftOrder,
    controlledFranchises,
    availablePlayers,
    poolPlayers,
    queue,
    teamNeeds,
    bestAvailable,
    bestFit,
    activeRoster,
    positionCounts,
    selections,
    undraftedCount: draft.poolPlayerIds.length - draft.selectedPlayerIds.length,
    selectionsMade,
  };
}

export function toFantasyDraftPlayerDetailView(
  state: GameState,
  playerId: string,
): FantasyDraftPlayerDetailView | null {
  const draft = state.world.fantasyDraft;
  const player = state.world.players[playerId as PlayerId];
  if (!draft || !player) {
    return null;
  }
  if (!draft.poolPlayerIds.some((id) => id === player.id)) {
    return null;
  }

  const overall = calculatePlayerOverall(player.position, player.attributes);
  const selection = draft.selections.find(
    (sel) => String(sel.playerId) === String(playerId),
  );
  const draftedTeam = selection
    ? state.world.teams[selection.teamId]
    : undefined;
  const { strengths, weaknesses } = derivePlayerStrengthsWeaknesses(
    player.position,
    player.attributes,
  );
  const activeQueue = draft.teamQueues[state.user.activeOwnerTeamId] ?? [];

  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    age: player.age,
    heightInches: player.heightInches,
    weightPounds: player.weightPounds,
    archetype: player.archetype,
    archetypeLabel: ARCHETYPE_LABELS[player.archetype] ?? player.archetype,
    nationality: player.nationality,
    overall,
    potential: player.potential.overall,
    tier: fantasyDraftPlayerTier(overall),
    injuryKind: player.availability,
    developmentStage: player.development.stage,
    attributes: { ...player.attributes },
    strengths: strengths.map((s) => ({ label: s.label, rating: s.rating })),
    weaknesses: weaknesses.map((w) => ({ label: w.label, rating: w.rating })),
    isDrafted: selection !== undefined,
    draftedByTeamId: selection?.teamId ?? null,
    draftedByTeamName: draftedTeam
      ? `${draftedTeam.city} ${draftedTeam.name}`
      : null,
    draftedByAbbreviation: draftedTeam?.abbreviation ?? null,
    pickNumber: selection?.pickNumber ?? null,
    round: selection?.round ?? null,
    inActiveQueue: activeQueue.some((id) => id === player.id),
  };
}

export function toFantasyDraftSummaryView(
  state: GameState,
): FantasyDraftSummaryView | null {
  const draft = state.world.fantasyDraft;
  if (draft === null || draft.status !== "complete") {
    return null;
  }

  const teamNames: Record<string, { name: string; abbreviation: string }> = {};
  for (const teamId of draft.draftOrder) {
    const team = state.world.teams[teamId];
    teamNames[teamId] = {
      name: team ? `${team.city} ${team.name}` : teamId,
      abbreviation: team?.abbreviation ?? "???",
    };
  }

  return {
    status: draft.status,
    totalPicks: draft.totalPicks,
    selectionsMade: draft.selections.length,
    undraftedCount: draft.poolPlayerIds.length - draft.selectedPlayerIds.length,
    controlledTeamIds: [...state.user.ownedTeamIds],
    teamSummaries: draft.teamSummaries ?? {},
    leagueRecap: draft.leagueRecap ?? null,
    teamNames,
  };
}
