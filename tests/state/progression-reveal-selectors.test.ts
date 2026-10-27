import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerAttributes } from "@/domain/entities";
import type { GameState } from "@/state/game-state";
import { toDevelopmentHubView } from "@/state/development-hub-selectors";
import { toDashboardMomentsView } from "@/state/dashboard-moments";
import { toProgressionRevealView } from "@/state/progression-reveal-selectors";
import { createTestGameState } from "../factories/game-state";
import {
  playerSeason,
  seasonRecord,
  withFranchiseHistory,
} from "./history-fixtures";

const base = bootstrapWorld(
  createTestGameState({ saveId: "progression_reveal" }),
  createSeededRng("progression"),
).state;
const teamId = base.user.activeOwnerTeamId as string;
const rosterIds = base.world.teams[teamId]!.roster.map(String);

function currentOverall(state: GameState, playerId: string): number {
  const p = state.world.players[playerId]!;
  return calculatePlayerOverall(p.position, p.attributes);
}

function historyFor(
  state: GameState,
  playerId: string,
  year: number,
  overall: number,
  attributes: PlayerAttributes,
): GameState["business"]["playerHistory"][string] {
  return {
    playerId: state.world.players[playerId]!.id,
    trackingStartedSeasonYear: year,
    seasons: [{ ...playerSeason({ year, teamId }), overall, attributes }],
  };
}

type Setup = {
  /** OVR delta (after - before) per roster index; null = no record. */
  deltas: Array<number | null>;
  /** Overrides on the "before" attributes of a roster index. */
  attributes?: Record<number, Partial<PlayerAttributes>>;
  /** Year of the records, and of the state when finalized. */
  year?: number;
  finalized?: boolean;
  phase?: GameState["competition"]["season"]["phase"];
};

function setup(input: Setup): GameState {
  const year = input.year ?? 2027;
  const finalized = input.finalized ?? true;
  const playerHistory = { ...base.business.playerHistory };
  input.deltas.forEach((delta, index) => {
    if (delta === null) return;
    const id = rosterIds[index]!;
    const original = base.world.players[id]!;
    playerHistory[id] = historyFor(
      base,
      id,
      year,
      currentOverall(base, id) - delta,
      { ...original.attributes, ...(input.attributes?.[index] ?? {}) },
    );
  });
  const state: GameState = {
    ...base,
    business: { ...base.business, playerHistory },
    competition: {
      ...base.competition,
      season: {
        ...base.competition.season,
        year: finalized ? year : year + 1,
        phase: input.phase ?? "offseason",
      },
    },
  };
  return withFranchiseHistory(
    state,
    finalized
      ? {
          [teamId]: [
            {
              ...seasonRecord({ year }),
              seasonId: state.competition.season.id,
            },
          ],
        }
      : {},
  );
}

describe("toProgressionRevealView", () => {
  it("orders biggest jump first and biggest drop last with signed values", () => {
    const state = setup({ deltas: [2, -3, 5, 0, 1] });
    const view = toProgressionRevealView(state)!;
    expect(view.changed.map((r) => r.delta)).toEqual([5, 2, 1, -3]);
    const top = view.changed[0]!;
    expect(top.playerId).toBe(rosterIds[2]);
    expect(top.after).toBe(currentOverall(state, rosterIds[2]!));
    expect(top.before).toBe(top.after - 5);
    expect(view.improved).toBe(3);
    expect(view.declined).toBe(1);
    expect(view.unchanged).toBe(1);
    expect(view.unchangedPlayers.map((r) => r.playerId)).toEqual([
      rosterIds[3],
    ]);
    expect(view.seasonYear).toBe(2027);
    expect(view.teamId).toBe(teamId);
  });

  it("averages to one decimal from the unrounded means", () => {
    const state = setup({ deltas: [1, 0, 0] });
    const view = toProgressionRevealView(state)!;
    const rows = [...view.changed, ...view.unchangedPlayers];
    const meanBefore = rows.reduce((s, r) => s + r.before, 0) / rows.length;
    const meanAfter = rows.reduce((s, r) => s + r.after, 0) / rows.length;
    expect(view.averageBefore).toBe(Math.round(meanBefore * 10) / 10);
    expect(view.averageAfter).toBe(Math.round(meanAfter * 10) / 10);
    expect(view.averageDelta).toBe(
      Math.round((meanAfter - meanBefore) * 10) / 10,
    );
    expect(view.averageDelta).toBe(0.3);
  });

  it("still returns a view when nobody changed", () => {
    const view = toProgressionRevealView(setup({ deltas: [0, 0] }))!;
    expect(view.changed).toEqual([]);
    expect(view.unchangedPlayers).toHaveLength(2);
    expect(view.improved + view.declined).toBe(0);
    expect(view.averageDelta).toBe(0);
  });

  it("is null without records for the season, or for a missing team", () => {
    expect(toProgressionRevealView(setup({ deltas: [] }))).toBeNull();
    expect(toProgressionRevealView(setup({ deltas: [null, null] }))).toBeNull();
    expect(toProgressionRevealView(setup({ deltas: [1] }), "nope")).toBeNull();
  });

  it("leaves out players without a record", () => {
    const view = toProgressionRevealView(setup({ deltas: [1, null, 2] }))!;
    const ids = [...view.changed, ...view.unchangedPlayers].map(
      (r) => r.playerId,
    );
    expect(ids.sort()).toEqual([rosterIds[0], rosterIds[2]].sort());
  });

  it("reports the top three attribute moves, largest first, zeros excluded", () => {
    const original = base.world.players[rosterIds[0]!]!.attributes;
    const state = setup({
      deltas: [4],
      attributes: {
        0: {
          threePoint: original.threePoint - 6,
          midRange: original.midRange - 2,
          speed: original.speed + 2,
          strength: original.strength - 1,
          basketballIq: original.basketballIq,
        },
      },
    });
    const moves = toProgressionRevealView(state)!.changed[0]!.topMoves;
    expect(moves).toHaveLength(3);
    expect(moves.map((m) => m.key)).toEqual([
      "threePoint",
      "midRange",
      "speed",
    ]);
    expect(moves[0]).toEqual({
      key: "threePoint",
      label: "Three Point",
      before: original.threePoint - 6,
      after: original.threePoint,
      delta: 6,
    });
    expect(moves.every((m) => m.delta !== 0)).toBe(true);
  });

  it("builds league risers and fallers, five each, in order", () => {
    const ids = Object.keys(base.world.players).filter(
      (id) => base.world.players[id]!.teamId,
    );
    const deltas: Record<string, number> = {};
    ids.slice(0, 7).forEach((id, i) => (deltas[id] = i + 1));
    ids.slice(7, 14).forEach((id, i) => (deltas[id] = -(i + 1)));
    // The owner roster needs at least one record for a view.
    const ownerId = rosterIds[0]!;
    deltas[ownerId] ??= 0;
    const playerHistory = { ...base.business.playerHistory };
    for (const [id, delta] of Object.entries(deltas)) {
      playerHistory[id] = historyFor(
        base,
        id,
        2027,
        currentOverall(base, id) - delta,
        base.world.players[id]!.attributes,
      );
    }
    const state = withFranchiseHistory(
      {
        ...base,
        business: { ...base.business, playerHistory },
        competition: {
          ...base.competition,
          season: {
            ...base.competition.season,
            year: 2027,
            phase: "offseason",
          },
        },
      },
      {
        [teamId]: [
          {
            ...seasonRecord({ year: 2027 }),
            seasonId: base.competition.season.id,
          },
        ],
      },
    );
    const view = toProgressionRevealView(state)!;
    expect(view.risers).toHaveLength(5);
    expect(view.fallers).toHaveLength(5);
    expect(view.risers.map((r) => r.delta)).toEqual([7, 6, 5, 4, 3]);
    expect(view.fallers.map((r) => r.delta)).toEqual([-7, -6, -5, -4, -3]);
    const riser = view.risers[0]!;
    expect(riser.teamAbbreviation).toBe(
      base.world.teams[riser.teamId]!.abbreviation,
    );
  });

  it("isCurrent only in the offseason with the season finalized", () => {
    expect(toProgressionRevealView(setup({ deltas: [1] }))!.isCurrent).toBe(
      true,
    );
    expect(
      toProgressionRevealView(setup({ deltas: [1], phase: "regular" }))!
        .isCurrent,
    ).toBe(false);
    expect(
      toProgressionRevealView(setup({ deltas: [1], finalized: false }))!
        .isCurrent,
    ).toBe(false);
  });

  it("compares against the previous year when not finalized", () => {
    const state = setup({ deltas: [3], year: 2027, finalized: false });
    expect(state.competition.season.year).toBe(2028);
    expect(toProgressionRevealView(state)!.seasonYear).toBe(2027);
  });

  it("is pure: same input gives equal output and state is untouched", () => {
    const state = setup({ deltas: [2, -1, 0] });
    const before = JSON.stringify(state);
    const a = toProgressionRevealView(state);
    const b = toProgressionRevealView(state);
    expect(a).toEqual(b);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("progression in composed views", () => {
  it("is on the development hub view", () => {
    const state = setup({ deltas: [2, -1] });
    expect(toDevelopmentHubView(state).progression?.seasonYear).toBe(2027);
  });

  it("dashboard moments carry progression only while current", () => {
    expect(
      toDashboardMomentsView(setup({ deltas: [2] })).progression?.isCurrent,
    ).toBe(true);
    expect(
      toDashboardMomentsView(setup({ deltas: [2], phase: "regular" }))
        .progression,
    ).toBeNull();
  });
});
