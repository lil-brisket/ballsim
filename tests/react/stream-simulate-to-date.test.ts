import { describe, expect, it, vi, afterEach } from "vitest";
import { streamSimulateToDate } from "@/components/calendar/stream-simulate-to-date";
import type { SimulateToDateStreamEvent } from "@/application/simulate-to-date-stream";

describe("streamSimulateToDate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses NDJSON progress and done events", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              type: "progress",
              daysRequested: 2,
              daysAdvanced: 1,
              currentDate: "2026-10-02",
              completedDate: "2026-10-01",
              phase: "regular",
              offseasonStage: "in_season",
              seasonYear: 2026,
              gamesSimulated: 8,
              percentComplete: 50,
              teamGame: {
                opponentAbbreviation: "RIV",
                resultLabel: "W 101-99",
                home: true,
              },
            })}\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              type: "done",
              ok: true,
              daysAdvanced: 1,
              highlightCount: 2,
              fromDate: "2026-10-01",
              toDate: "2026-10-02",
              currentDate: "2026-10-02",
              requestedTargetDate: "2026-10-05",
              stopReason: "user_team_game",
            })}\n`,
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      }),
    );

    const events: SimulateToDateStreamEvent[] = [];
    await streamSimulateToDate("save_cal", "2026-10-05", (event) => {
      events.push(event);
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("progress");
    expect(events[1]).toMatchObject({
      type: "done",
      fromDate: "2026-10-01",
      stopReason: "user_team_game",
    });
  });
});
