/**
 * Read-only player view for the compare page. Active players only: draft
 * prospects are excluded so scouting-hidden attributes are never revealed.
 */

import { getControlledTeam } from "@/state/selectors";
import type { PlayerAttributes } from "@/domain/entities/player";
import { ARCHETYPE_LABELS } from "@/domain/entities/player-archetype";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";

export type PlayerCompareView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  heightInches: number;
  archetypeLabel: string;
  overall: number;
  teamAbbreviation: string | null;
  contract: { salary: number | null; yearsRemaining: number } | null;
  attributes: PlayerAttributes;
};

export function toPlayerCompareView(
  state: GameState,
  playerId: string | null | undefined,
): PlayerCompareView | null {
  if (!playerId) return null;
  const player = state.world.players[playerId];
  if (!player || player.retired === true) return null;
  const team = player.teamId ? state.world.teams[player.teamId] : undefined;
  const year = state.competition.season.year;
  // Same rule as the player drawer: contracts only for your own roster.
  const onControlledRoster = getControlledTeam(state).roster.includes(
    player.id,
  );
  const contract =
    onControlledRoster && player.contractId
      ? state.business.contracts[player.contractId]
      : undefined;
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    age: player.age,
    heightInches: player.heightInches,
    archetypeLabel: ARCHETYPE_LABELS[player.archetype] ?? player.archetype,
    overall: calculatePlayerOverall(player.position, player.attributes),
    teamAbbreviation: team?.abbreviation ?? null,
    contract: contract
      ? {
          salary: getContractSalaryForYear(contract, year) ?? null,
          yearsRemaining: Math.max(0, contract.endYear - year + 1),
        }
      : null,
    attributes: { ...player.attributes },
  };
}
