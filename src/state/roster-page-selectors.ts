/**
 * Roster Management page view-model.
 * Pure projections from GameState — never runs findTrades / ensureAiTradeBlocks.
 */

import {
  PLAYER_POSITIONS,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import {
  ROTATION_ROLES,
  type RotationRole,
} from "@/domain/entities/team-roster-management";
import type { TradeBlockStatus } from "@/domain/entities/trade-block";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getControlledTeam,
  toFinancesView,
  toFreeAgentViews,
  toRosterView,
  type FreeAgentView,
  type RosterPlayerView,
} from "@/state/selectors";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { toBrandingView } from "@/state/team-branding-view";
import { getPlayerAvailability } from "@/systems/player-availability";
import {
  positionFitsForPlayer,
  type PositionFit,
} from "@/systems/roster-management";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { isInLeaguePhase } from "@/systems/phase-engine";
import type { TradeFinderCandidate } from "@/systems/trades/trade-finder";

export type { PositionFit };

export type RosterNeedLevel = "strong" | "adequate" | "weak" | "critical";

export type RosterNeed = {
  position: PlayerPosition;
  level: RosterNeedLevel;
  score: number;
  explanation?: string;
};

export type DepthChartLabel = "STARTER" | "PRIMARY" | "SECONDARY";

export type DepthChartEntryView = {
  playerId: string;
  firstName: string;
  lastName: string;
  overall: number;
  effectiveOverall: number;
  primaryPosition: PlayerPosition;
  depthPosition: PlayerPosition;
  fit: "primary" | "secondary";
  label: DepthChartLabel;
  available: boolean;
  canPlay: boolean;
  availabilityLabel: string;
};

export type DepthChartView = Record<PlayerPosition, DepthChartEntryView[]>;

export type RosterPagePlayerView = RosterPlayerView & {
  primaryPosition: PlayerPosition;
  rotationRole: RotationRole;
  isInactive: boolean;
  depthSlot?: PlayerPosition;
  onTradeBlock: boolean;
  tradeBlockStatus?: TradeBlockStatus;
  canPlay: boolean;
  availabilityLabel: string;
  roleDisplayLabel: string;
};

export type TradeBlockPlayerView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  overall: number;
  status: TradeBlockStatus;
};

export type TradeBlockPickView = {
  draftPickId: string;
  label: string;
  status: TradeBlockStatus;
};

export type TradeBlockView = {
  players: TradeBlockPlayerView[];
  picks: TradeBlockPickView[];
};

export type RosterPageSummary = {
  rosterCount: number;
  rosterMax: number;
  rotationPlayerCount: number;
  healthyCount: number;
  injuredCount: number;
  tradeBlockPlayerCount: number;
  tradeBlockPickCount: number;
  payroll: number;
  capSpace: number;
  openSpots: number;
};

export type RosterPageView = {
  saveId: string;
  team: {
    teamId: string;
    city: string;
    name: string;
    abbreviation: string;
    branding: TeamBrandingView | null;
  };
  summary: RosterPageSummary;
  roster: RosterPagePlayerView[];
  rosterNeeds: RosterNeed[];
  depthChart: DepthChartView;
  freeAgents: FreeAgentView[];
  freeAgencyActive: boolean;
  freeAgencyHubHref: string;
  tradeBlock: TradeBlockView;
  tradeFinder: {
    suggestedOutgoingPlayerId: string | null;
  };
  lineupHref: string;
  rotationsHref: string;
};

export type TradeFinderRowView = {
  counterpartyTeamId: string;
  counterpartyAbbreviation: string;
  counterpartyName: string;
  outgoingSummary: string;
  incomingSummary: string;
  acceptedByCounterparty: boolean | null;
  proposal: TradeFinderCandidate["proposal"];
  reviewHref: string;
};

const SECONDARY_OVR_WEIGHT = 0.65;

const ROLE_SORT_ORDER: Record<RotationRole, number> = {
  starter: 0,
  sixth_man: 1,
  rotation: 2,
  bench: 3,
  deep_bench: 4,
  emergency: 5,
};

const NEED_LEVEL_SEVERITY: Record<RosterNeedLevel, number> = {
  critical: 0,
  weak: 1,
  adequate: 2,
  strong: 3,
};

export function effectiveOverallAtPosition(
  overall: number,
  fit: "primary" | "secondary",
): number {
  if (fit === "primary") {
    return overall;
  }
  return Math.round(overall * SECONDARY_OVR_WEIGHT);
}

export function roleDisplayLabelFor(
  rotationRole: RotationRole,
  isInactive: boolean,
): string {
  if (isInactive) {
    return "Inactive";
  }
  return rotationRole.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function rotationRoleSortKey(role: RotationRole): number {
  return ROLE_SORT_ORDER[role] ?? 99;
}

function playerOverall(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function fitAtPosition(
  player: Player,
  position: PlayerPosition,
): PositionFit | undefined {
  return positionFitsForPlayer(player).find((entry) => entry.position === position);
}

/**
 * Locked first-pass roster-needs formula (Issue #53).
 * Secondary fits use 0.65× OVR. Only healthy (canPlay) players classify level.
 */
export function evaluateRosterNeeds(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): RosterNeed[] {
  const team = state.world.teams[teamId];
  if (team == null) {
    return PLAYER_POSITIONS.map((position) => ({
      position,
      level: "critical" as const,
      score: 0,
      explanation: "0 healthy · no roster",
    }));
  }

  return PLAYER_POSITIONS.map((position) => {
    const healthyEffective: number[] = [];
    let eligibleCount = 0;

    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (player == null) {
        continue;
      }
      const fit = fitAtPosition(player, position);
      if (fit == null) {
        continue;
      }
      eligibleCount += 1;
      const availability = getPlayerAvailability(state, playerId, teamId);
      if (!availability.canPlay) {
        continue;
      }
      const overall = playerOverall(player);
      healthyEffective.push(effectiveOverallAtPosition(overall, fit.fit));
    }

    healthyEffective.sort((a, b) => b - a);
    const h1 = healthyEffective[0] ?? 0;
    const h2 = healthyEffective[1] ?? 0;
    const h3 = healthyEffective[2] ?? 0;
    const healthyCount = healthyEffective.length;
    const depthScore = 0.5 * h1 + 0.3 * h2 + 0.2 * h3;

    const level = classifyNeedLevel(healthyCount, h1, depthScore);
    const topParts = [h1, h2, h3]
      .filter((value, index) => index < healthyCount)
      .map((value) => String(Math.round(value)));
    const topLabel =
      topParts.length > 0 ? topParts.join("/") : "—";

    return {
      position,
      level,
      score: depthScore,
      explanation: `${healthyCount} healthy · top ${topLabel} effective${
        eligibleCount > healthyCount
          ? ` (${eligibleCount - healthyCount} unavailable)`
          : ""
      }`,
    };
  });
}

function classifyNeedLevel(
  healthyCount: number,
  h1: number,
  depthScore: number,
): RosterNeedLevel {
  if (healthyCount === 0) {
    return "critical";
  }
  if (healthyCount === 1 && h1 < 75) {
    return "critical";
  }
  if (healthyCount === 1 && h1 >= 75) {
    return "weak";
  }
  if (healthyCount >= 2 && depthScore < 75) {
    return "weak";
  }
  if (depthScore >= 75 && depthScore < 80) {
    return "adequate";
  }
  if (depthScore >= 80 && healthyCount >= 3) {
    return "strong";
  }
  if (depthScore >= 80 && healthyCount < 3) {
    return "adequate";
  }
  return "adequate";
}

export function toDepthChartView(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): DepthChartView {
  const team = state.world.teams[teamId];
  const empty = Object.fromEntries(
    PLAYER_POSITIONS.map((position) => [position, [] as DepthChartEntryView[]]),
  ) as DepthChartView;

  if (team == null) {
    return empty;
  }

  const starterBySlot = new Map(
    team.rosterManagement.startingLineup.map((slot) => [
      slot.slot,
      slot.playerId,
    ]),
  );

  const result = { ...empty };

  for (const position of PLAYER_POSITIONS) {
    const entries: DepthChartEntryView[] = [];

    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (player == null) {
        continue;
      }
      const fit = fitAtPosition(player, position);
      if (fit == null) {
        continue;
      }
      const overall = playerOverall(player);
      const availability = getPlayerAvailability(state, playerId, teamId);
      const isStarterAtSlot = starterBySlot.get(position) === playerId;
      let label: DepthChartLabel;
      if (isStarterAtSlot) {
        label = "STARTER";
      } else if (fit.fit === "primary") {
        label = "PRIMARY";
      } else {
        label = "SECONDARY";
      }

      entries.push({
        playerId: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        overall,
        effectiveOverall: effectiveOverallAtPosition(overall, fit.fit),
        primaryPosition: player.position,
        depthPosition: position,
        fit: fit.fit,
        label,
        available: availability.available,
        canPlay: availability.canPlay,
        availabilityLabel: availability.label,
      });
    }

    entries.sort((a, b) => {
      if (b.effectiveOverall !== a.effectiveOverall) {
        return b.effectiveOverall - a.effectiveOverall;
      }
      if (a.fit !== b.fit) {
        return a.fit === "primary" ? -1 : 1;
      }
      const playerA = state.world.players[a.playerId as PlayerId];
      const playerB = state.world.players[b.playerId as PlayerId];
      return (playerA?.age ?? 99) - (playerB?.age ?? 99);
    });

    result[position] = entries;
  }

  return result;
}

export function toTradeBlockView(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): TradeBlockView {
  const block = getTradeBlock(state, teamId);
  const players: TradeBlockPlayerView[] = [];
  const picks: TradeBlockPickView[] = [];

  for (const asset of block.assets) {
    if (asset.kind === "player") {
      const player = state.world.players[asset.playerId];
      if (player == null) {
        continue;
      }
      players.push({
        playerId: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        overall: playerOverall(player),
        status: asset.status,
      });
    } else {
      const pick = state.world.draftPicks[asset.draftPickId];
      const label =
        pick != null
          ? `${pick.seasonYear} ${pick.round === 1 ? "1st" : "2nd"}`
          : asset.draftPickId;
      picks.push({
        draftPickId: asset.draftPickId,
        label,
        status: asset.status,
      });
    }
  }

  players.sort((a, b) => b.overall - a.overall);
  picks.sort((a, b) => a.label.localeCompare(b.label));

  return { players, picks };
}

function resolveRotationRole(
  playerId: PlayerId,
  management: GameState["world"]["teams"][string]["rosterManagement"],
): { rotationRole: RotationRole; isInactive: boolean; depthSlot?: PlayerPosition } {
  const isInactive = management.inactive.includes(playerId);
  const starterSlot = management.startingLineup.find(
    (slot) => slot.playerId === playerId,
  );
  const rotationEntry = management.rotation.find(
    (entry) => entry.playerId === playerId,
  );

  if (starterSlot != null) {
    return {
      rotationRole: "starter",
      isInactive: false,
      depthSlot: starterSlot.slot,
    };
  }

  if (rotationEntry != null) {
    return {
      rotationRole: rotationEntry.role,
      isInactive,
      depthSlot: undefined,
    };
  }

  if (isInactive) {
    return { rotationRole: "emergency", isInactive: true };
  }

  return { rotationRole: "bench", isInactive: false };
}

function enrichRosterPlayers(
  state: GameState,
  teamId: TeamId,
): RosterPagePlayerView[] {
  const team = state.world.teams[teamId];
  if (team == null) {
    return [];
  }
  const base = toRosterView(state);
  const block = getTradeBlock(state, teamId);
  const onBlock = new Map(
    block.assets
      .filter((asset) => asset.kind === "player")
      .map((asset) => [
        asset.playerId,
        asset.status,
      ] as const),
  );

  return base.map((row) => {
    const playerId = row.playerId as PlayerId;
    const resolved = resolveRotationRole(playerId, team.rosterManagement);
    const availability = getPlayerAvailability(state, playerId, teamId);
    const blockStatus = onBlock.get(playerId);

    return {
      ...row,
      primaryPosition: row.position as PlayerPosition,
      rotationRole: resolved.rotationRole,
      isInactive: resolved.isInactive,
      depthSlot: resolved.depthSlot,
      onTradeBlock: blockStatus != null,
      tradeBlockStatus: blockStatus,
      canPlay: availability.canPlay,
      availabilityLabel: availability.label,
      roleDisplayLabel: roleDisplayLabelFor(
        resolved.rotationRole,
        resolved.isInactive,
      ),
    };
  });
}

/**
 * Suggest outgoing player for Trade Finder tab default — pure, no search.
 * Prefer weakest need position; lowest healthy OVR; prefer deeper roles; skip on-block.
 */
export function suggestTradeFinderOutgoingPlayer(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
  needs: RosterNeed[] = evaluateRosterNeeds(state, teamId),
): string | null {
  const team = state.world.teams[teamId];
  if (team == null || team.roster.length === 0) {
    return null;
  }

  const block = getTradeBlock(state, teamId);
  const onBlock = new Set(
    block.assets
      .filter((asset) => asset.kind === "player")
      .map((asset) => asset.playerId),
  );

  const sortedNeeds = [...needs].sort(
    (a, b) => NEED_LEVEL_SEVERITY[a.level] - NEED_LEVEL_SEVERITY[b.level],
  );
  const weakest = sortedNeeds[0];
  if (weakest == null) {
    return null;
  }

  type Candidate = {
    playerId: PlayerId;
    overall: number;
    roleKey: number;
  };

  const candidates: Candidate[] = [];
  for (const playerId of team.roster) {
    if (onBlock.has(playerId)) {
      continue;
    }
    const player = state.world.players[playerId];
    if (player == null) {
      continue;
    }
    if (fitAtPosition(player, weakest.position) == null) {
      continue;
    }
    const availability = getPlayerAvailability(state, playerId, teamId);
    if (!availability.canPlay) {
      continue;
    }
    const resolved = resolveRotationRole(playerId, team.rosterManagement);
    candidates.push({
      playerId,
      overall: playerOverall(player),
      roleKey: rotationRoleSortKey(resolved.rotationRole),
    });
  }

  if (candidates.length === 0) {
    // Fallback: any healthy roster player not on block, lowest OVR
    for (const playerId of team.roster) {
      if (onBlock.has(playerId)) {
        continue;
      }
      const player = state.world.players[playerId];
      if (player == null) {
        continue;
      }
      const availability = getPlayerAvailability(state, playerId, teamId);
      if (!availability.canPlay) {
        continue;
      }
      const resolved = resolveRotationRole(playerId, team.rosterManagement);
      candidates.push({
        playerId,
        overall: playerOverall(player),
        roleKey: rotationRoleSortKey(resolved.rotationRole),
      });
    }
  }

  if (candidates.length === 0) {
    return team.roster[0] ?? null;
  }

  candidates.sort((a, b) => {
    if (a.overall !== b.overall) {
      return a.overall - b.overall;
    }
    return b.roleKey - a.roleKey;
  });

  return candidates[0]!.playerId;
}

function buildSummary(
  state: GameState,
  teamId: TeamId,
  roster: RosterPagePlayerView[],
  tradeBlock: TradeBlockView,
): RosterPageSummary {
  const finances = toFinancesView(state);
  const team = state.world.teams[teamId];
  const rotationPlayerCount =
    team?.rosterManagement.rotation.filter(
      (entry) =>
        entry.targetMinutes > 0 &&
        entry.rotationStatus !== "inactive" &&
        !team.rosterManagement.inactive.includes(entry.playerId),
    ).length ?? 0;

  const healthyCount = roster.filter((row) => row.canPlay).length;
  const injuredCount = roster.length - healthyCount;
  const rosterMax = DEFAULT_ROSTER_SIZE;

  return {
    rosterCount: roster.length,
    rosterMax,
    rotationPlayerCount,
    healthyCount,
    injuredCount,
    tradeBlockPlayerCount: tradeBlock.players.length,
    tradeBlockPickCount: tradeBlock.picks.length,
    payroll: finances.playerPayroll,
    capSpace: finances.capSpace,
    openSpots: Math.max(0, rosterMax - roster.length),
  };
}

export function toRosterPageView(state: GameState): RosterPageView {
  const saveId = state.meta.saveId;
  const team = getControlledTeam(state);
  const teamId = team.id;
  const roster = enrichRosterPlayers(state, teamId);
  const rosterNeeds = evaluateRosterNeeds(state, teamId);
  const depthChart = toDepthChartView(state, teamId);
  const freeAgents = toFreeAgentViews(state);
  const tradeBlock = toTradeBlockView(state, teamId);
  const summary = buildSummary(state, teamId, roster, tradeBlock);
  const freeAgencyActive = isInLeaguePhase(state, "offseason.free_agency");

  return {
    saveId,
    team: {
      teamId,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
      branding: toBrandingView(team.branding),
    },
    summary,
    roster,
    rosterNeeds,
    depthChart,
    freeAgents,
    freeAgencyActive,
    freeAgencyHubHref: `/dashboard/${saveId}/free-agency`,
    tradeBlock,
    tradeFinder: {
      suggestedOutgoingPlayerId: suggestTradeFinderOutgoingPlayer(
        state,
        teamId,
        rosterNeeds,
      ),
    },
    lineupHref: `/dashboard/${saveId}/team-management/lineups`,
    rotationsHref: `/dashboard/${saveId}/team-management/lineups`,
  };
}

function assetLabel(
  state: GameState,
  kind: "player" | "draftPick",
  id: string,
): string {
  if (kind === "player") {
    const player = state.world.players[id as PlayerId];
    if (player == null) {
      return id;
    }
    return `${player.firstName} ${player.lastName} (${playerOverall(player)} OVR)`;
  }
  const pick = state.world.draftPicks[id as DraftPickId];
  if (pick == null) {
    return id;
  }
  return `${pick.seasonYear} ${pick.round === 1 ? "1st" : "2nd"}`;
}

/**
 * Pure mapping of findTrades output → presentation rows.
 * Does not call ensureAiTradeBlocks or findTrades.
 */
export function toTradeFinderRowViews(
  state: GameState,
  candidates: TradeFinderCandidate[],
  saveId: string,
): TradeFinderRowView[] {
  const teamId = state.user.activeOwnerTeamId;

  return candidates.map((candidate) => {
    const counterparty = state.world.teams[candidate.counterpartyTeamId];
    const ourSide =
      candidate.proposal.sideA.teamId === teamId
        ? candidate.proposal.sideA
        : candidate.proposal.sideB;
    const theirSide =
      candidate.proposal.sideA.teamId === teamId
        ? candidate.proposal.sideB
        : candidate.proposal.sideA;

    const outgoingParts = [
      ...ourSide.playerIds.map((id) => assetLabel(state, "player", id)),
      ...ourSide.draftPickIds.map((id) => assetLabel(state, "draftPick", id)),
    ];
    const incomingParts = [
      ...theirSide.playerIds.map((id) => assetLabel(state, "player", id)),
      ...theirSide.draftPickIds.map((id) => assetLabel(state, "draftPick", id)),
    ];

    const outgoingPlayerId = ourSide.playerIds[0];
    const reviewHref =
      outgoingPlayerId != null
        ? `/dashboard/${saveId}/players/${outgoingPlayerId}`
        : `/dashboard/${saveId}/roster?tab=trade-finder`;

    return {
      counterpartyTeamId: candidate.counterpartyTeamId,
      counterpartyAbbreviation: counterparty?.abbreviation ?? "???",
      counterpartyName: counterparty
        ? `${counterparty.city} ${counterparty.name}`
        : candidate.counterpartyTeamId,
      outgoingSummary: outgoingParts.join(", ") || "—",
      incomingSummary: incomingParts.join(", ") || "—",
      acceptedByCounterparty: null,
      proposal: candidate.proposal,
      reviewHref,
    };
  });
}

// Re-export for consumers that need the domain role union
export type { RotationRole };
export { ROTATION_ROLES };
