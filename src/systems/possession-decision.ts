import type { Foul } from "@/domain/entities/foul";
import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import {
  SHOT_TYPES,
  type ShotType,
} from "@/systems/shot-resolution-config";

export type PossessionDecision =
  | {
      action: "shot";
      shooterId: PlayerId;
      defenderId: PlayerId;
      shotType: ShotType;
    }
  | {
      action: "pass";
      passerId: PlayerId;
      receiverId: PlayerId;
      defenderId: PlayerId;
    }
  | {
      action: "turnover";
      playerId: PlayerId;
    }
  | {
      action: "foul";
      foul: Foul;
      shotType?: ShotType;
    }
  | {
      action: "free_throw";
      shooterId: PlayerId;
      awarded: number;
    };

export type PossessionDecisionContext = {
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
  offensivePlayers: readonly Player[];
  defensivePlayers: readonly Player[];
};

export type ResolvedPossessionDecision = {
  decision: PossessionDecision;
  /** True when the fouler is on the offensive team. Only set for foul decisions. */
  isOffensiveFoul: boolean | null;
  shooter: Player | null;
  defender: Player | null;
  passer: Player | null;
  receiver: Player | null;
  fouler: Player | null;
  fouled: Player | null;
  turnoverPlayer: Player | null;
  freeThrowShooter: Player | null;
};

/**
 * Validates decision actors against possession lineups/teams.
 * Does not run specialized resolver validation (ratings, fatigue, etc.).
 */
export function resolvePossessionDecision(
  decision: PossessionDecision,
  context: PossessionDecisionContext,
): ResolvedPossessionDecision {
  if (decision == null || typeof decision !== "object") {
    throw new Error("Possession decision is required.");
  }

  switch (decision.action) {
    case "shot":
      return resolveShotDecision(decision, context);
    case "pass":
      return resolvePassDecision(decision, context);
    case "turnover":
      return resolveTurnoverDecision(decision, context);
    case "foul":
      return resolveFoulDecision(decision, context);
    case "free_throw":
      return resolveFreeThrowDecision(decision, context);
    default: {
      const exhaustive: never = decision;
      throw new Error(
        `Possession decision action is not supported: ${String(
          (exhaustive as { action?: string }).action,
        )}.`,
      );
    }
  }
}

function resolveShotDecision(
  decision: Extract<PossessionDecision, { action: "shot" }>,
  context: PossessionDecisionContext,
): ResolvedPossessionDecision {
  assertShotType(decision.shotType);
  const shooter = requireOffensivePlayer(
    decision.shooterId,
    context,
    "shooterId",
  );
  const defender = requireDefensivePlayer(
    decision.defenderId,
    context,
    "defenderId",
  );
  return emptyResolved(decision, {
    shooter,
    defender,
  });
}

function resolvePassDecision(
  decision: Extract<PossessionDecision, { action: "pass" }>,
  context: PossessionDecisionContext,
): ResolvedPossessionDecision {
  const passer = requireOffensivePlayer(
    decision.passerId,
    context,
    "passerId",
  );
  const receiver = requireOffensivePlayer(
    decision.receiverId,
    context,
    "receiverId",
  );
  if (decision.passerId === decision.receiverId) {
    throw new Error(
      "Possession pass passerId and receiverId must be different.",
    );
  }
  const defender = requireDefensivePlayer(
    decision.defenderId,
    context,
    "defenderId",
  );
  return emptyResolved(decision, {
    passer,
    receiver,
    defender,
  });
}

function resolveTurnoverDecision(
  decision: Extract<PossessionDecision, { action: "turnover" }>,
  context: PossessionDecisionContext,
): ResolvedPossessionDecision {
  const turnoverPlayer = requireOffensivePlayer(
    decision.playerId,
    context,
    "playerId",
  );
  return emptyResolved(decision, { turnoverPlayer });
}

function resolveFoulDecision(
  decision: Extract<PossessionDecision, { action: "foul" }>,
  context: PossessionDecisionContext,
): ResolvedPossessionDecision {
  if (decision.foul == null || typeof decision.foul !== "object") {
    throw new Error("Possession foul decision requires a foul.");
  }

  const fouler = findInPools(decision.foul.foulingPlayerId, context);
  if (fouler == null) {
    throw new Error(
      "Possession foul foulingPlayerId must be in the supplied player pools.",
    );
  }
  const fouled = findInPools(decision.foul.fouledPlayerId, context);
  if (fouled == null) {
    throw new Error(
      "Possession foul fouledPlayerId must be in the supplied player pools.",
    );
  }

  const foulerIsOffense = fouler.player.teamId === context.offensiveTeamId;
  const foulerIsDefense = fouler.player.teamId === context.defensiveTeamId;
  const fouledIsOffense = fouled.player.teamId === context.offensiveTeamId;
  const fouledIsDefense = fouled.player.teamId === context.defensiveTeamId;

  if (foulerIsOffense && fouledIsDefense) {
    // Offensive foul path — does not call resolveFoul; shotType unused.
    if (decision.foul.foulType === "shooting") {
      throw new Error(
        "Possession offensive fouls must use foulType \"non-shooting\".",
      );
    }
    if (decision.shotType !== undefined) {
      throw new Error(
        "Possession foul decision must not include shotType for non-shooting fouls.",
      );
    }
    return emptyResolved(decision, {
      isOffensiveFoul: true,
      fouler: fouler.player,
      fouled: fouled.player,
    });
  }

  if (foulerIsDefense && fouledIsOffense) {
    if (decision.foul.foulType === "shooting") {
      if (decision.shotType === undefined) {
        throw new Error(
          "Possession foul decision requires shotType for shooting fouls.",
        );
      }
      assertShotType(decision.shotType);
    } else if (decision.shotType !== undefined) {
      throw new Error(
        "Possession foul decision must not include shotType for non-shooting fouls.",
      );
    }
    return emptyResolved(decision, {
      isOffensiveFoul: false,
      fouler: fouler.player,
      fouled: fouled.player,
    });
  }

  throw new Error(
    "Possession foul players must be on opposing teams matching foul ownership.",
  );
}

function resolveFreeThrowDecision(
  decision: Extract<PossessionDecision, { action: "free_throw" }>,
  context: PossessionDecisionContext,
): ResolvedPossessionDecision {
  if (!Number.isInteger(decision.awarded) || decision.awarded < 1) {
    throw new Error(
      "Possession free_throw awarded must be a positive integer.",
    );
  }
  const freeThrowShooter = requireOffensivePlayer(
    decision.shooterId,
    context,
    "shooterId",
  );
  return emptyResolved(decision, { freeThrowShooter });
}

function emptyResolved(
  decision: PossessionDecision,
  overrides: Partial<ResolvedPossessionDecision> = {},
): ResolvedPossessionDecision {
  return {
    decision,
    isOffensiveFoul: null,
    shooter: null,
    defender: null,
    passer: null,
    receiver: null,
    fouler: null,
    fouled: null,
    turnoverPlayer: null,
    freeThrowShooter: null,
    ...overrides,
  };
}

function requireOffensivePlayer(
  playerId: PlayerId,
  context: PossessionDecisionContext,
  field: string,
): Player {
  const player = findPlayer(playerId, context.offensivePlayers);
  if (player == null) {
    throw new Error(
      `Possession decision ${field} must be an offensive player in the supplied pool.`,
    );
  }
  if (player.teamId !== context.offensiveTeamId) {
    throw new Error(
      `Possession decision ${field} must belong to the offensive team.`,
    );
  }
  return player;
}

function requireDefensivePlayer(
  playerId: PlayerId,
  context: PossessionDecisionContext,
  field: string,
): Player {
  const player = findPlayer(playerId, context.defensivePlayers);
  if (player == null) {
    throw new Error(
      `Possession decision ${field} must be a defensive player in the supplied pool.`,
    );
  }
  if (player.teamId !== context.defensiveTeamId) {
    throw new Error(
      `Possession decision ${field} must belong to the defensive team.`,
    );
  }
  return player;
}

function findPlayer(
  playerId: PlayerId,
  players: readonly Player[],
): Player | null {
  for (const player of players) {
    if (player.id === playerId) {
      return player;
    }
  }
  return null;
}

function findInPools(
  playerId: PlayerId,
  context: PossessionDecisionContext,
): { player: Player; side: "offense" | "defense" } | null {
  const offensive = findPlayer(playerId, context.offensivePlayers);
  if (offensive != null) {
    return { player: offensive, side: "offense" };
  }
  const defensive = findPlayer(playerId, context.defensivePlayers);
  if (defensive != null) {
    return { player: defensive, side: "defense" };
  }
  return null;
}

function assertShotType(value: ShotType): void {
  if (!SHOT_TYPES.includes(value)) {
    throw new Error(
      `Possession decision shotType must be one of ${SHOT_TYPES.join(", ")}.`,
    );
  }
}
