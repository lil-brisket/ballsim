import {
  PLAYER_POSITIONS,
  RATING_MAX,
  RATING_MIN,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import {
  POSITION_REBOUND_MODIFIERS,
  REBOUND_RESOLUTION_CONFIG,
} from "@/systems/rebound-resolution-config";

export type ReboundType = "offensive" | "defensive";

export type ResolveReboundInput = {
  offensivePlayers: readonly Player[];
  defensivePlayers: readonly Player[];
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
};

export type ReboundCandidateScore = {
  playerId: PlayerId;
  teamId: TeamId;
  side: ReboundType;
  /** Effective strength after bounded variance (not base strength). */
  strength: number;
};

export type ReboundResult = {
  type: ReboundType;
  playerId: PlayerId;
  teamId: TeamId;
  offensiveReboundProbability: number;
  candidateScores: ReboundCandidateScore[];
};

/**
 * RNG-free base rebound strength:
 *   rebounding + POSITION_REBOUND_MODIFIERS[position]
 */
export function playerReboundBaseStrength(player: Player): number {
  assertPlayerPosition(player.position);
  assertRating(player.attributes.rebounding, "attributes.rebounding");
  return (
    player.attributes.rebounding +
    POSITION_REBOUND_MODIFIERS[player.position]
  );
}

/**
 * Resolves a rebound after a missed field goal.
 *
 * RNG call order:
 *   1. rng.next() once per offensive player (variance), input order
 *   2. rng.next() once per defensive player (variance), input order
 *   3. rng.chance(offensiveReboundProbability) — team contest
 *   4. rng.next() once — weighted individual selection
 *
 * Does not mutate input. Does not use Math.random().
 */
export function resolveRebound(
  input: ResolveReboundInput,
  rng: Rng,
): ReboundResult {
  validateResolveReboundInput(input, rng);

  const offensiveScores: ReboundCandidateScore[] = [];
  let offensiveTeamStrength = 0;
  for (const player of input.offensivePlayers) {
    const strength = effectiveStrength(player, rng);
    offensiveScores.push({
      playerId: player.id,
      teamId: input.offensiveTeamId,
      side: "offensive",
      strength,
    });
    offensiveTeamStrength += strength;
  }

  const defensiveScores: ReboundCandidateScore[] = [];
  let defensiveRawStrength = 0;
  for (const player of input.defensivePlayers) {
    const strength = effectiveStrength(player, rng);
    defensiveScores.push({
      playerId: player.id,
      teamId: input.defensiveTeamId,
      side: "defensive",
      strength,
    });
    defensiveRawStrength += strength;
  }

  const defensiveTeamStrength =
    defensiveRawStrength *
    REBOUND_RESOLUTION_CONFIG.defensivePositioningMultiplier;

  const offensiveReboundProbability =
    offensiveTeamStrength /
    (offensiveTeamStrength + defensiveTeamStrength);

  const offenseWins = rng.chance(offensiveReboundProbability);
  const winningScores = offenseWins ? offensiveScores : defensiveScores;
  const winner = pickWeighted(winningScores, rng);

  return {
    type: offenseWins ? "offensive" : "defensive",
    playerId: winner.playerId,
    teamId: winner.teamId,
    offensiveReboundProbability,
    candidateScores: [...offensiveScores, ...defensiveScores],
  };
}

function effectiveStrength(player: Player, rng: Rng): number {
  const base = playerReboundBaseStrength(player);
  const variance =
    (rng.next() * 2 - 1) * REBOUND_RESOLUTION_CONFIG.varianceAmplitude;
  return Math.max(
    REBOUND_RESOLUTION_CONFIG.minStrength,
    base + variance,
  );
}

/**
 * Local weighted selection by effective strength. Consumes one rng.next().
 */
function pickWeighted(
  candidates: readonly ReboundCandidateScore[],
  rng: Rng,
): ReboundCandidateScore {
  let totalWeight = 0;
  for (const candidate of candidates) {
    totalWeight += candidate.strength;
  }

  let roll = rng.next() * totalWeight;
  for (const candidate of candidates) {
    roll -= candidate.strength;
    if (roll < 0) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1]!;
}

function validateResolveReboundInput(
  input: ResolveReboundInput,
  rng: Rng,
): void {
  if (rng == null) {
    throw new Error("Rebound resolution requires an RNG.");
  }

  if (input.offensivePlayers == null || input.offensivePlayers.length === 0) {
    throw new Error("Rebound resolution requires a non-empty offensive pool.");
  }
  if (input.defensivePlayers == null || input.defensivePlayers.length === 0) {
    throw new Error("Rebound resolution requires a non-empty defensive pool.");
  }

  assertNonEmptyTeamId(input.offensiveTeamId, "offensiveTeamId");
  assertNonEmptyTeamId(input.defensiveTeamId, "defensiveTeamId");
  if (input.offensiveTeamId === input.defensiveTeamId) {
    throw new Error(
      "Rebound offensiveTeamId and defensiveTeamId must be different.",
    );
  }

  const offensiveIds = new Set<PlayerId>();
  for (let index = 0; index < input.offensivePlayers.length; index += 1) {
    const player = input.offensivePlayers[index];
    assertValidPlayer(player, `offensivePlayers[${index}]`);
    if (player.teamId !== input.offensiveTeamId) {
      throw new Error(
        `Rebound offensivePlayers[${index}] teamId must equal offensiveTeamId.`,
      );
    }
    if (offensiveIds.has(player.id)) {
      throw new Error(
        "Rebound offensive pool must not contain duplicate player IDs.",
      );
    }
    offensiveIds.add(player.id);
    assertRating(player.attributes.rebounding, "attributes.rebounding");
    assertPlayerPosition(player.position);
  }

  const defensiveIds = new Set<PlayerId>();
  for (let index = 0; index < input.defensivePlayers.length; index += 1) {
    const player = input.defensivePlayers[index];
    assertValidPlayer(player, `defensivePlayers[${index}]`);
    if (player.teamId !== input.defensiveTeamId) {
      throw new Error(
        `Rebound defensivePlayers[${index}] teamId must equal defensiveTeamId.`,
      );
    }
    if (defensiveIds.has(player.id)) {
      throw new Error(
        "Rebound defensive pool must not contain duplicate player IDs.",
      );
    }
    if (offensiveIds.has(player.id)) {
      throw new Error(
        "Rebound candidate pools must not share player IDs.",
      );
    }
    defensiveIds.add(player.id);
    assertRating(player.attributes.rebounding, "attributes.rebounding");
    assertPlayerPosition(player.position);
  }
}

function assertValidPlayer(player: Player | null | undefined, field: string): asserts player is Player {
  if (player == null) {
    throw new Error(`Rebound ${field} must be a valid player.`);
  }
}

function assertNonEmptyTeamId(value: TeamId, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Rebound ${field} must be a non-empty string.`);
  }
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Rebound ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}

function assertPlayerPosition(value: string): void {
  if (!PLAYER_POSITIONS.includes(value as PlayerPosition)) {
    throw new Error(
      `Rebound position must be one of ${PLAYER_POSITIONS.join(", ")}.`,
    );
  }
}
