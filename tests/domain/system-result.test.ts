import { describe, expect, it } from "vitest";
import { createDomainEvent } from "@/domain/events";
import { systemResult } from "@/domain/system-result";
import { createInitialGameState } from "@/state/create-initial-state";

describe("SystemResult", () => {
  it("packages state with domain events without mutation helpers pretending to simulate", () => {
    const state = createInitialGameState({
      saveId: "save_events",
      nowIso: "2026-08-13T12:00:00.000Z",
    });

    const event = createDomainEvent({
      type: "ContractSigned",
      occurredOn: state.world.calendar.currentDate,
      payload: { note: "architecture smoke" },
    });

    const result = systemResult(state, [event]);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe("ContractSigned");
  });
});
