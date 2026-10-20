import type { ConferenceId } from "@/domain/ids";
import { asFanVoteCategoryId } from "@/domain/ids";
import type {
  FanVoteCategory,
  FanVoteCategoryKind,
} from "@/domain/entities/season-events";
import type { GameState } from "@/state/game-state";
import type { PlayerPosition } from "@/domain/entities/player";

const KIND_POSITIONS: Record<FanVoteCategoryKind, readonly PlayerPosition[]> = {
  guards: ["PG", "SG"],
  forwards: ["SF", "PF"],
  centers: ["C"],
  open: ["PG", "SG", "SF", "PF", "C"],
};

/**
 * Build vote categories from league structure: one all-positions ballot per
 * conference (a single league-wide ballot without conferences).
 * Extensible — not hardcoded to East/West labels only.
 */
export function buildFanVoteCategories(
  state: GameState,
): Record<string, FanVoteCategory> {
  const conferences = Object.values(state.world.conferences).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const categories: Record<string, FanVoteCategory> = {};

  const addCategory = (
    conferenceId: ConferenceId | null,
    conferenceName: string | null,
  ): void => {
    const confKey = conferenceId ?? "league";
    const id = asFanVoteCategoryId(`${confKey}_open`);
    categories[id] = {
      id,
      label: conferenceName != null ? `${conferenceName} Conference` : "League",
      kind: "open",
      conferenceId,
      candidates: {},
    };
  };

  if (conferences.length >= 2) {
    for (const conference of conferences) {
      addCategory(conference.id, conference.name);
    }
  } else {
    addCategory(null, null);
  }

  // Seed candidates from rostered players.
  for (const player of Object.values(state.world.players)) {
    if (player.retired || player.teamId == null) continue;
    const team = state.world.teams[player.teamId];
    if (!team) continue;

    for (const category of Object.values(categories)) {
      if (
        category.conferenceId != null &&
        team.conferenceId !== category.conferenceId
      ) {
        continue;
      }
      category.candidates[player.id] = {
        playerId: player.id,
        teamId: player.teamId,
        voteTotal: 0,
        voteShare: 0,
        rank: 0,
        previousRank: null,
      };
    }
  }

  return categories;
}

export function positionsForKind(
  kind: FanVoteCategoryKind,
): readonly PlayerPosition[] {
  return KIND_POSITIONS[kind];
}
