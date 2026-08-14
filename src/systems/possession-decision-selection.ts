import { createFoul } from "@/domain/entities/foul";
import type { Player } from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import type { PossessionDecision } from "@/systems/possession-decision";
import type { GameSimulationConfig } from "@/systems/game-simulation-config";
import type { ShotType } from "@/systems/shot-resolution-config";
import {
  buildOffensiveUsageProfiles,
  pickByWeight,
  pickWeightedPlayer,
  type PlayerUsageProfile,
} from "@/systems/player-usage";

export type ChoosePossessionDecisionInput = {
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
  offensivePlayers: readonly Player[];
  defensivePlayers: readonly Player[];
  config: GameSimulationConfig;
};

/**
 * Selects a PossessionDecision for the current possession.
 * Does not resolve make/miss/rebound/foul consequences.
 * Who is selected uses usage/role-weighted distributions; what happens still
 * uses attribute-driven action and shot-type weights.
 */
export function choosePossessionDecision(
  input: ChoosePossessionDecisionInput,
  rng: Rng,
): PossessionDecision {
  if (input.offensivePlayers.length === 0) {
    throw new Error("choosePossessionDecision requires offensive players.");
  }
  if (input.defensivePlayers.length === 0) {
    throw new Error("choosePossessionDecision requires defensive players.");
  }

  const profiles = buildOffensiveUsageProfiles(input.offensivePlayers);
  const primary = pickWeightedPlayer(profiles, "involvementWeight", rng);
  const action = pickWeightedAction(primary, input.config, rng);

  switch (action) {
    case "shot": {
      const shooter = pickWeightedPlayer(profiles, "shotWeight", rng);
      const defender = rng.pick(input.defensivePlayers);
      return {
        action: "shot",
        shooterId: shooter.id,
        defenderId: defender.id,
        shotType: chooseShotType(shooter, rng),
      };
    }
    case "pass": {
      const passer = pickWeightedPlayer(profiles, "passWeight", rng);
      const receiver = pickWeightedPlayer(
        profiles,
        "shotWeight",
        rng,
        passer.id,
      );
      const defender = rng.pick(input.defensivePlayers);
      return {
        action: "pass",
        passerId: passer.id,
        receiverId: receiver.id,
        defenderId: defender.id,
      };
    }
    case "turnover":
      return {
        action: "turnover",
        playerId: primary.id,
      };
    case "foul":
      return chooseFoulDecision(input, primary, profiles, rng);
    default: {
      const exhaustive: never = action;
      throw new Error(`Unsupported possession action: ${String(exhaustive)}`);
    }
  }
}

type ActionKind = "shot" | "pass" | "turnover" | "foul";

function pickWeightedAction(
  player: Player,
  config: GameSimulationConfig,
  rng: Rng,
): ActionKind {
  const shootingRating =
    (player.attributes.finishing +
      player.attributes.midRange +
      player.attributes.threePoint) /
    3;
  const shotMod = attributeModifier(
    shootingRating,
    config.attributeModifierScale,
  );
  const passMod = attributeModifier(
    player.attributes.passing,
    config.attributeModifierScale,
  );
  const turnoverMod = attributeModifier(
    100 - player.attributes.ballHandling,
    config.attributeModifierScale,
  );

  const weights: Array<{ action: ActionKind; weight: number }> = [
    {
      action: "shot",
      weight: clampWeight(
        config.actionBaseWeights.shot * shotMod,
        config,
      ),
    },
    {
      action: "pass",
      weight: clampWeight(
        config.actionBaseWeights.pass * passMod,
        config,
      ),
    },
    {
      action: "turnover",
      weight: clampWeight(
        config.actionBaseWeights.turnover * turnoverMod,
        config,
      ),
    },
    {
      action: "foul",
      weight: clampWeight(config.actionBaseWeights.foul, config),
    },
  ];

  return pickByWeight(weights, rng).action;
}

function chooseShotType(shooter: Player, rng: Rng): ShotType {
  const location = pickByWeight(
    [
      { kind: "three" as const, weight: Math.max(1, shooter.attributes.threePoint) },
      { kind: "mid" as const, weight: Math.max(1, shooter.attributes.midRange) },
      {
        kind: "finish" as const,
        weight: Math.max(1, shooter.attributes.finishing),
      },
    ],
    rng,
  ).kind;
  return location === "three" ? "three_point" : "two_point";
}

function chooseFoulDecision(
  input: ChoosePossessionDecisionInput,
  primaryOffense: Player,
  profiles: readonly PlayerUsageProfile[],
  rng: Rng,
): PossessionDecision {
  const subtype = pickByWeight(
    [
      {
        kind: "defensiveNonShooting" as const,
        weight: input.config.foulSubtypeWeights.defensiveNonShooting,
      },
      {
        kind: "defensiveShooting" as const,
        weight: input.config.foulSubtypeWeights.defensiveShooting,
      },
      {
        kind: "offensive" as const,
        weight: input.config.foulSubtypeWeights.offensive,
      },
    ],
    rng,
  ).kind;

  if (subtype === "offensive") {
    const fouled = rng.pick(input.defensivePlayers);
    return {
      action: "foul",
      foul: createFoul({
        foulingPlayerId: primaryOffense.id,
        fouledPlayerId: fouled.id,
        foulType: "non-shooting",
      }),
    };
  }

  const fouler = rng.pick(input.defensivePlayers);
  // Shooting-foul victim is independent of primary; biased toward scoring threats.
  // Non-shooting defensive foul keeps uniform offense pick.
  const fouled =
    subtype === "defensiveShooting"
      ? pickWeightedPlayer(profiles, "shotWeight", rng)
      : rng.pick(input.offensivePlayers);
  if (subtype === "defensiveShooting") {
    return {
      action: "foul",
      foul: createFoul({
        foulingPlayerId: fouler.id,
        fouledPlayerId: fouled.id,
        foulType: "shooting",
      }),
      shotType: chooseShotType(fouled, rng),
    };
  }

  return {
    action: "foul",
    foul: createFoul({
      foulingPlayerId: fouler.id,
      fouledPlayerId: fouled.id,
      foulType: "non-shooting",
    }),
  };
}

function attributeModifier(rating: number, scale: number): number {
  return 1 + ((rating - 50) / 100) * scale;
}

function clampWeight(value: number, config: GameSimulationConfig): number {
  return Math.min(
    config.actionWeightMax,
    Math.max(config.actionWeightMin, value),
  );
}
