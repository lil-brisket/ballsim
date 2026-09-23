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

function kindForPosition(position: PlayerPosition): FanVoteCategoryKind {
  if (position === "PG" || position === "SG") return "guards";
  if (position === "SF" || position === "PF") return "forwards";
  return "centers";
}

/**
 * Build vote categories from league structure (conference × position group).
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
    kind: FanVoteCategoryKind,
  ): void => {
    const confKey = conferenceId ?? "league";
    const id = asFanVoteCategoryId(`${confKey}_${kind}`);
    const label =
      conferenceName != null
        ? `${conferenceName} — ${kindLabel(kind)}`
        : kindLabel(kind);
    categories[id] = {
      id,
      label,
      kind,
      conferenceId,
      candidates: {},
    };
  };

  const kinds: FanVoteCategoryKind[] = ["guards", "forwards", "centers"];

  if (conferences.length >= 2) {
    for (const conference of conferences) {
      for (const kind of kinds) {
        addCategory(conference.id, conference.name, kind);
      }
    }
  } else {
    for (const kind of kinds) {
      addCategory(null, null, kind);
    }
  }

  // Seed candidates from rostered players.
  for (const player of Object.values(state.world.players)) {
    if (player.retired || player.teamId == null) continue;
    const team = state.world.teams[player.teamId];
    if (!team) continue;

    const kind = kindForPosition(player.position);
    for (const category of Object.values(categories)) {
      if (category.kind !== kind) continue;
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

function kindLabel(kind: FanVoteCategoryKind): string {
  switch (kind) {
    case "guards":
      return "Guards";
    case "forwards":
      return "Forwards";
    case "centers":
      return "Centers";
    case "open":
      return "Players";
  }
}

export function positionsForKind(
  kind: FanVoteCategoryKind,
): readonly PlayerPosition[] {
  return KIND_POSITIONS[kind];
}
