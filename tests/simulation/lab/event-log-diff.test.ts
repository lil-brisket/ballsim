import { describe, expect, it } from "vitest";
import {
  diffEventLogs,
  parseEventNdjson,
} from "@/simulation/lab/event-log-diff";
import { asPlayerId, asTeamId } from "@/domain/ids";
import type { GameEvent } from "@/domain/entities/game";

function event(sequence: number, type: GameEvent["type"]): GameEvent {
  return {
    sequence,
    type,
    playerId: asPlayerId("p1"),
    teamId: asTeamId("t1"),
  };
}

describe("diffEventLogs", () => {
  it("returns no diffs for identical logs", () => {
    const events = [event(0, "shot_made"), event(1, "foul")];
    expect(diffEventLogs(events, events)).toEqual([]);
    expect(
      parseEventNdjson(
        `${JSON.stringify(events[0])}\n${JSON.stringify(events[1])}\n`,
      ),
    ).toEqual(events);
  });

  it("reports index and both sides when logs diverge", () => {
    const stored = [event(0, "shot_made"), event(1, "foul")];
    const replayed = [event(0, "shot_made"), event(1, "steal")];
    const diffs = diffEventLogs(stored, replayed);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.index).toBe(1);
    expect(diffs[0]?.stored?.type).toBe("foul");
    expect(diffs[0]?.replayed?.type).toBe("steal");
  });
});
