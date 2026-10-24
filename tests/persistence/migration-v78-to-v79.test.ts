import { describe, expect, it } from "vitest";
import { asDraftClassId, asPlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { migrateV78ToV79 } from "@/persistence/mappers/game-state-migrations/v66-v75";
import { createTestGameState } from "../factories/game-state";
import { createPlayer } from "../factories/player";

function withDraftedPlayers(): GameState {
  const base = createTestGameState({ saveId: "migration_v79" });
  const unrecorded = createPlayer({ id: "player_unrecorded" });
  const redrafted = createPlayer({ id: "player_redrafted" });
  const created = createPlayer({ id: "player_recorded" });
  const recorded = {
    ...created,
    developmentLeague: { ...created.developmentLeague, draftSeasonYear: 2025 },
  };
  const draft = (year: number, playerIds: string[]) => ({
    id: asDraftClassId(`draft_${year}`),
    seasonYear: year,
    status: "complete",
    prospects: {},
    order: [],
    scouting: [],
    selections: [],
    pickResults: playerIds.map((playerId, index) => ({
      playerId: asPlayerId(playerId),
      seasonYear: year,
      overallPick: index + 1,
    })),
  });
  return {
    ...base,
    meta: { ...base.meta, schemaVersion: 78 },
    world: {
      ...base.world,
      players: {
        ...base.world.players,
        [unrecorded.id]: unrecorded,
        [redrafted.id]: redrafted,
        [recorded.id]: recorded,
      },
      drafts: {
        draft_2024: draft(2024, ["player_redrafted", "player_recorded"]),
        draft_2026: draft(2026, ["player_unrecorded", "player_redrafted"]),
      } as unknown as GameState["world"]["drafts"],
    },
  };
}

describe("migrateV78ToV79", () => {
  it("records the draft year of players drafted before it was stored on the player", () => {
    const migrated = migrateV78ToV79(withDraftedPlayers());
    const year = (id: string) =>
      migrated.world.players[id]!.developmentLeague.draftSeasonYear;
    expect(migrated.meta.schemaVersion).toBe(79);
    expect(year("player_unrecorded")).toBe(2026);
    // The latest draft wins, as in findPlayerDraftSeasonYear.
    expect(year("player_redrafted")).toBe(2026);
    // A recorded year is kept.
    expect(year("player_recorded")).toBe(2025);
  });

  it("leaves undrafted players alone and does not mutate its input", () => {
    const state = withDraftedPlayers();
    const before = structuredClone(state);
    const migrated = migrateV78ToV79(state);
    expect(state).toEqual(before);
    for (const [id, player] of Object.entries(migrated.world.players)) {
      if (!id.startsWith("player_unrecorded") && !id.startsWith("player_re")) {
        expect(player.developmentLeague.draftSeasonYear).toBe(
          state.world.players[id]!.developmentLeague.draftSeasonYear,
        );
      }
    }
  });
});
