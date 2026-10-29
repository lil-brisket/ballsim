import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { asPlayerId } from "@/domain/ids";
import type { PlayerSeasonStatLine } from "@/domain/entities/player-history";
import type { GameState } from "@/state/game-state";
import { toPlayerDrawerView } from "@/state/entity-drawer-selectors";
import { toRosterPageView } from "@/state/roster-page-selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { playerSeason, withPlayerHistory } from "./history-fixtures";

const base = bootstrapWorld(
  createTestGameState({ saveId: "roster_sheet" }),
  createSeededRng("roster-sheet"),
).state;
const teamId = base.user.activeOwnerTeamId as string;
const rosterIds = base.world.teams[teamId]!.roster.map(String);

function withCurrentLine(
  state: GameState,
  playerId: string,
  line: Partial<PlayerSeasonStatLine>,
): GameState {
  const record = playerSeason({
    year: state.competition.season.year,
    teamId,
  });
  const combined = { ...record.competition.combined, ...line };
  return withPlayerHistory(state, {
    [playerId]: [
      {
        ...record,
        seasonId: state.competition.season.id,
        competition: { ...record.competition, combined, regular: combined },
      },
    ],
  });
}

describe("roster sheet fields on RosterPagePlayerView", () => {
  it("carry the same values as the player card", () => {
    const state = withCurrentLine(base, rosterIds[0]!, {
      games: 10,
      minutes: 300,
      points: 155,
      rebounds: 52,
      assists: 41,
      steals: 12,
      blocks: 7,
      fgMade: 60,
      fgAttempted: 120,
      threeMade: 18,
      threeAttempted: 50,
      ftMade: 17,
      ftAttempted: 20,
    });
    const view = toRosterPageView(state);
    expect(view.roster.length).toBe(rosterIds.length);
    for (const row of view.roster) {
      const drawer = toPlayerDrawerView(
        state,
        asPlayerId(row.playerId),
        view.saveId,
      )!;
      expect(row.attributes).toEqual(drawer.ratings.attributes);
      expect(row.potential).toBe(drawer.identity.potential);
      expect(row.heightInches).toBe(drawer.identity.heightInches);
      expect(row.weightPounds).toBe(drawer.identity.weightPounds);
      expect(row.archetypeLabel).toBe(drawer.identity.archetypeLabel);
      expect(row.overall).toBe(drawer.identity.overall);
      expect(row.performance).toEqual(drawer.performance);
    }
  });

  it("computes averages and shooting percentages from the season line", () => {
    const state = withCurrentLine(base, rosterIds[0]!, {
      games: 10,
      minutes: 300,
      points: 155,
      rebounds: 52,
      assists: 41,
      steals: 12,
      blocks: 7,
      fgMade: 60,
      fgAttempted: 120,
      threeMade: 18,
      threeAttempted: 50,
      ftMade: 17,
      ftAttempted: 20,
    });
    const row = toRosterPageView(state).roster.find(
      (r) => r.playerId === rosterIds[0],
    )!;
    expect(row.performance).toEqual({
      games: 10,
      mpg: 30,
      ppg: 15.5,
      rpg: 5.2,
      apg: 4.1,
      spg: 1.2,
      bpg: 0.7,
      fgPct: 50,
      threePct: 36,
      ftPct: 85,
    });
  });

  it("has no games: averages and percentages are null, never zero", () => {
    const row = toRosterPageView(base).roster[0]!;
    expect(row.performance).toEqual({
      games: 0,
      mpg: null,
      ppg: null,
      rpg: null,
      apg: null,
      spg: null,
      bpg: null,
      fgPct: null,
      threePct: null,
      ftPct: null,
    });
  });

  it("keeps a stable set of sheet keys", () => {
    const row = toRosterPageView(base).roster[0]!;
    expect(Object.keys(row.attributes).sort()).toHaveLength(19);
    expect(Object.keys(row.performance).sort()).toEqual([
      "apg",
      "bpg",
      "fgPct",
      "ftPct",
      "games",
      "mpg",
      "ppg",
      "rpg",
      "spg",
      "threePct",
    ]);
    const sheetKeys = [
      "attributes",
      "potential",
      "heightInches",
      "weightPounds",
      "archetypeLabel",
      "performance",
    ];
    for (const key of sheetKeys) {
      expect(Object.keys(row)).toContain(key);
    }
  });
});
