import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  sortDevelopmentRows,
  toDevelopmentHubView,
  type DevelopmentHubRow,
} from "@/state/development-hub-selectors";
import { toRosterView } from "@/state/selectors";

describe("development-hub-selectors", () => {
  it("builds change-first hub matching roster size", () => {
    let state = createTestGameState({ saveId: "dev_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toDevelopmentHubView(state);
    const roster = toRosterView(state);
    expect(hub.rows.length).toBe(roster.length);
    expect(
      hub.stageCounts.developing +
        hub.stageCounts.prime +
        hub.stageCounts.declining,
    ).toBe(hub.rows.length);
  });

  it("sorts by change delta before overall", () => {
    const rows: DevelopmentHubRow[] = [
      {
        playerId: "a",
        playerName: "High OVR",
        position: "C",
        age: 28,
        stage: "prime",
        overall: 90,
        changeDelta: 0,
        changeLabel: "90 → 90",
        potential: 90,
        onDevelopmentLeague: false,
      },
      {
        playerId: "b",
        playerName: "Improver",
        position: "PG",
        age: 21,
        stage: "developing",
        overall: 70,
        changeDelta: 3,
        changeLabel: "67 → 70",
        potential: 85,
        onDevelopmentLeague: false,
      },
    ];
    const sorted = sortDevelopmentRows(rows);
    expect(sorted[0]!.playerId).toBe("b");
  });

  it("exposes staff context without inventing causal influence fields", () => {
    let state = createTestGameState({ saveId: "dev_hub_staff" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const hub = toDevelopmentHubView(state);
    expect(hub.staffContext).toHaveProperty("trainerName");
    expect(hub.staffContext).toHaveProperty("trainerOverall");
  });
});
