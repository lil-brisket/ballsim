import { describe, expect, it } from "vitest";
import { deriveSeed } from "@/domain/rng";
import {
  buildGameModeSeedList,
  labGameSeed,
  labGameStreamName,
  labRosterSeed,
  labRosterStreamName,
  seedForStream,
} from "@/simulation/lab/lab-seeds";

describe("Lab per-game seeds", () => {
  it("derives a stable roster stream and independent game streams", () => {
    const master = 42;
    const scenarioId = "normal";
    const list = buildGameModeSeedList(master, scenarioId, 3);
    expect(list).toHaveLength(4);
    expect(list[0]?.stream).toBe(labRosterStreamName(scenarioId));
    expect(list[0]?.seed).toBe(labRosterSeed(master, scenarioId));
    expect(list[1]?.seed).toBe(labGameSeed(master, scenarioId, 0));
    expect(list[2]?.seed).toBe(labGameSeed(master, scenarioId, 1));
    expect(seedForStream(list, labGameStreamName(scenarioId, 2))).toBe(
      deriveSeed(master, "normal:game:2"),
    );
    expect(labGameSeed(master, scenarioId, 0)).not.toBe(
      labGameSeed(master, scenarioId, 1),
    );
    expect(labRosterSeed(master, scenarioId)).not.toBe(
      labGameSeed(master, scenarioId, 0),
    );
    expect(buildGameModeSeedList(master, scenarioId, 3)).toEqual(list);
  });

  it("throws when a required stream is missing", () => {
    expect(() => seedForStream([], "normal:game:0")).toThrow(/missing stream/);
  });
});
