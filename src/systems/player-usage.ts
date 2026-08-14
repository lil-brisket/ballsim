import type { OffensiveRole } from "@/domain/entities/offensive-role";
import type { Player } from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import {
  PLAYER_USAGE_CONFIG,
  type PlayerUsageConfig,
} from "@/systems/player-usage-config";

export type PlayerUsageProfile = {
  playerId: PlayerId;
  player: Player;
  scoring: number;
  creation: number;
  usageScore: number;
  role: OffensiveRole;
  /** Raw shot weight before team normalization. */
  shotWeight: number;
  /** Raw pass weight before team normalization. */
  passWeight: number;
  /** usageScore * roleMult — general involvement (primary actor). */
  involvementWeight: number;
};

export type NormalizedUsageShares = {
  profiles: readonly PlayerUsageProfile[];
  /** Positive shares summing to 1, keyed by playerId. */
  shotShares: ReadonlyMap<string, number>;
  passShares: ReadonlyMap<string, number>;
  involvementShares: ReadonlyMap<string, number>;
};

/**
 * Mean of finishing, midRange, threePoint.
 */
export function scoringAbility(player: Player): number {
  const { finishing, midRange, threePoint } = player.attributes;
  return (finishing + midRange + threePoint) / 3;
}

/**
 * Mean of passing, ballHandling.
 */
export function creationAbility(player: Player): number {
  const { passing, ballHandling } = player.attributes;
  return (passing + ballHandling) / 2;
}

/**
 * General offensive-involvement score. Not a shot or pass percentage.
 */
export function calculateUsageScore(
  player: Player,
  config: PlayerUsageConfig = PLAYER_USAGE_CONFIG,
): number {
  const scoring = scoringAbility(player);
  const creation = creationAbility(player);
  const mix = config.usageScoreMix;
  const rawScore =
    mix.scoring * scoring +
    mix.creation * creation +
    mix.ballHandling * player.attributes.ballHandling +
    mix.offensiveIq * player.attributes.offensiveIq;
  return Math.max(rawScore, config.usageScoreFloor);
}

export function roleMultiplier(
  role: OffensiveRole,
  config: PlayerUsageConfig = PLAYER_USAGE_CONFIG,
): number {
  return config.roleMultipliers[role];
}

/**
 * Shot weight from usageScore, role, and scoring ability.
 * Not a fixed percentage; normalize across teammates before selection.
 */
export function computeShotWeight(
  usageScore: number,
  role: OffensiveRole,
  scoring: number,
  config: PlayerUsageConfig = PLAYER_USAGE_CONFIG,
): number {
  return usageScore * roleMultiplier(role, config) * scoring;
}

/**
 * Pass weight from usageScore, role, and creation ability.
 */
export function computePassWeight(
  usageScore: number,
  role: OffensiveRole,
  creation: number,
  config: PlayerUsageConfig = PLAYER_USAGE_CONFIG,
): number {
  return usageScore * roleMultiplier(role, config) * creation;
}

export function computeInvolvementWeight(
  usageScore: number,
  role: OffensiveRole,
  config: PlayerUsageConfig = PLAYER_USAGE_CONFIG,
): number {
  return usageScore * roleMultiplier(role, config);
}

/**
 * Assign derived roles among the eligible pool by usageScore descending.
 * Players outside the pool are not ranked here (use role "bench" separately).
 */
export function assignOffensiveRoles(
  players: readonly Player[],
  config: PlayerUsageConfig = PLAYER_USAGE_CONFIG,
): Map<string, OffensiveRole> {
  const ranked = [...players].sort((a, b) => {
    const scoreDiff =
      calculateUsageScore(b, config) - calculateUsageScore(a, config);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const roles = new Map<string, OffensiveRole>();
  for (let index = 0; index < ranked.length; index += 1) {
    const player = ranked[index]!;
    const scoring = scoringAbility(player);
    const creation = creationAbility(player);
    roles.set(player.id, roleForRank(index, scoring, creation));
  }
  return roles;
}

function roleForRank(
  zeroBasedRank: number,
  scoring: number,
  creation: number,
): OffensiveRole {
  if (zeroBasedRank === 0) {
    return "primary_creator";
  }
  if (zeroBasedRank === 1) {
    return creation >= scoring ? "secondary_creator" : "scorer";
  }
  if (zeroBasedRank === 2) {
    return scoring > creation ? "scorer" : "role_player";
  }
  if (zeroBasedRank === 3) {
    return "role_player";
  }
  return "low_usage";
}

/**
 * Build usage profiles for the eligible on-court offensive pool.
 * Roles are derived from rank within this pool only.
 */
export function buildOffensiveUsageProfiles(
  players: readonly Player[],
  config: PlayerUsageConfig = PLAYER_USAGE_CONFIG,
): PlayerUsageProfile[] {
  if (players.length === 0) {
    return [];
  }
  const roles = assignOffensiveRoles(players, config);
  return players.map((player) => {
    const scoring = scoringAbility(player);
    const creation = creationAbility(player);
    const usageScore = calculateUsageScore(player, config);
    const role = roles.get(player.id)!;
    return {
      playerId: player.id,
      player,
      scoring,
      creation,
      usageScore,
      role,
      shotWeight: computeShotWeight(usageScore, role, scoring, config),
      passWeight: computePassWeight(usageScore, role, creation, config),
      involvementWeight: computeInvolvementWeight(usageScore, role, config),
    };
  });
}

/**
 * Normalize a family of positive weights into shares that sum to 1.
 */
export function normalizeShares(
  entries: readonly { playerId: PlayerId; weight: number }[],
): Map<string, number> {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    throw new Error("normalizeShares requires a positive total weight.");
  }
  const shares = new Map<string, number>();
  for (const entry of entries) {
    shares.set(entry.playerId, entry.weight / total);
  }
  return shares;
}

export function normalizeUsageProfiles(
  profiles: readonly PlayerUsageProfile[],
): NormalizedUsageShares {
  if (profiles.length === 0) {
    throw new Error("normalizeUsageProfiles requires at least one profile.");
  }
  return {
    profiles,
    shotShares: normalizeShares(
      profiles.map((profile) => ({
        playerId: profile.playerId,
        weight: profile.shotWeight,
      })),
    ),
    passShares: normalizeShares(
      profiles.map((profile) => ({
        playerId: profile.playerId,
        weight: profile.passWeight,
      })),
    ),
    involvementShares: normalizeShares(
      profiles.map((profile) => ({
        playerId: profile.playerId,
        weight: profile.involvementWeight,
      })),
    ),
  };
}

/**
 * Canonical weighted pick: rng.next() * total, subtract until negative,
 * last-item fallback. Same semantics as prior possession-decision-selection helper.
 */
export function pickByWeight<T extends { weight: number }>(
  items: readonly T[],
  rng: Rng,
): T {
  if (items.length === 0) {
    throw new Error("pickByWeight requires a non-empty items list.");
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    throw new Error("Weighted pick requires a positive total weight.");
  }
  let roll = rng.next() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) {
      return item;
    }
  }
  return items[items.length - 1]!;
}

export function pickWeightedPlayer(
  profiles: readonly PlayerUsageProfile[],
  weightKey: "shotWeight" | "passWeight" | "involvementWeight",
  rng: Rng,
  excludePlayerId?: PlayerId,
): Player {
  const eligible = excludePlayerId
    ? profiles.filter((profile) => profile.playerId !== excludePlayerId)
    : profiles;
  if (eligible.length === 0) {
    throw new Error("pickWeightedPlayer requires at least one eligible player.");
  }
  const picked = pickByWeight(
    eligible.map((profile) => ({
      profile,
      weight: profile[weightKey],
    })),
    rng,
  );
  return picked.profile.player;
}
