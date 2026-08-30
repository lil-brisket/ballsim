import type { Player } from "@/domain/entities/player";
import {
  createPlayer,
  RATING_MAX,
  RATING_MIN,
  type PlayerAttributes,
} from "@/domain/entities/player";
import { asPlayerId, asTeamId, type TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";

const OFFENSE_KEYS: readonly (keyof PlayerAttributes)[] = [
  "finishing",
  "midRange",
  "threePoint",
  "freeThrow",
  "ballHandling",
  "passing",
  "offensiveIq",
];

const DEFENSE_KEYS: readonly (keyof PlayerAttributes)[] = [
  "perimeterDefense",
  "interiorDefense",
  "steal",
  "block",
  "defensiveIq",
];

function clampRating(value: number): number {
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(value)));
}

/**
 * Deep-copies a player with attribute overrides. Used only for the secondary
 * matchup diagnostic — never mutates the primary roster.
 */
export function copyPlayerWithAttributes(
  source: Player,
  attributes: PlayerAttributes,
  id: string,
  teamId: TeamId,
): Player {
  return createPlayer({
    id: asPlayerId(id),
    teamId,
    firstName: source.firstName,
    lastName: source.lastName,
    nationality: source.nationality,
    age: source.age,
    heightInches: source.heightInches,
    weightPounds: source.weightPounds,
    position: source.position,
    archetype: source.archetype,
    attributes: { ...attributes },
    potential: { ...source.potential },
    personality: { ...source.personality },
    contractId: null,
    availability: source.availability,
    injury:
      source.injury == null
        ? null
        : {
            ...source.injury,
            gamesRemaining:
              source.injury.gamesRemaining == null
                ? null
                : { ...source.injury.gamesRemaining },
          },
    suspension:
      source.suspension == null ? null : { ...source.suspension },
    development: { ...source.development },
  });
}

function clampAttrs(
  base: PlayerAttributes,
  keys: readonly (keyof PlayerAttributes)[],
  value: number,
): PlayerAttributes {
  const next: PlayerAttributes = { ...base };
  for (const key of keys) {
    next[key] = clampRating(value);
  }
  return next;
}

export type MatchupRosters = {
  strongOffense: Player[];
  weakOffense: Player[];
  strongDefense: Player[];
  weakDefense: Player[];
  strongOffenseOverall: number;
  weakOffenseOverall: number;
  strongDefenseOverall: number;
  weakDefenseOverall: number;
};

/**
 * Builds constructed strong/weak offense and defense rosters from a template
 * roster. Copies only — does not mutate the template.
 */
export function buildMatchupRosters(
  template: readonly Player[],
  strongTeamId: TeamId = asTeamId("team_matchup_strong"),
  weakTeamId: TeamId = asTeamId("team_matchup_weak"),
): MatchupRosters {
  if (template.length === 0) {
    throw new Error("buildMatchupRosters requires a non-empty template.");
  }

  const strongOffense = template.map((player, index) =>
    copyPlayerWithAttributes(
      player,
      clampAttrs(player.attributes, OFFENSE_KEYS, 90),
      `matchup_so_${index}`,
      strongTeamId,
    ),
  );
  const weakOffense = template.map((player, index) =>
    copyPlayerWithAttributes(
      player,
      clampAttrs(player.attributes, OFFENSE_KEYS, 40),
      `matchup_wo_${index}`,
      weakTeamId,
    ),
  );
  const strongDefense = template.map((player, index) =>
    copyPlayerWithAttributes(
      player,
      clampAttrs(player.attributes, DEFENSE_KEYS, 90),
      `matchup_sd_${index}`,
      strongTeamId,
    ),
  );
  const weakDefense = template.map((player, index) =>
    copyPlayerWithAttributes(
      player,
      clampAttrs(player.attributes, DEFENSE_KEYS, 40),
      `matchup_wd_${index}`,
      weakTeamId,
    ),
  );

  const meanOverall = (players: readonly Player[]) =>
    players.reduce(
      (sum, player) =>
        sum + calculatePlayerOverall(player.position, player.attributes),
      0,
    ) / players.length;

  return {
    strongOffense,
    weakOffense,
    strongDefense,
    weakDefense,
    strongOffenseOverall: meanOverall(strongOffense),
    weakOffenseOverall: meanOverall(weakOffense),
    strongDefenseOverall: meanOverall(strongDefense),
    weakDefenseOverall: meanOverall(weakDefense),
  };
}
