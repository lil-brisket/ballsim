import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/state/standings-selectors", () => ({
  toCalendarLeagueContext: () => null,
}));

const progressAfterDisconnect = vi.fn();
let releaseAdvance: () => void = () => {};

vi.mock("@/application/game-service", () => ({
  advanceOwnerTime: vi.fn(
    async (
      _saveId: string,
      options: { onProgress?: (progress: object, state: object) => void },
    ) => {
      // Wait until the test has cancelled the stream, then keep reporting.
      await new Promise<void>((resolve) => {
        releaseAdvance = resolve;
      });
      options.onProgress?.({ daysAdvanced: 1 }, {});
      progressAfterDisconnect();
      return {
        ok: true,
        highlights: [],
        summary: null,
        simulation: {
          daysAdvanced: 2,
          currentDate: "2026-10-03",
          stopReason: undefined,
        },
      };
    },
  ),
}));

import { POST } from "@/app/api/saves/[saveId]/simulate-to-date/route";
import { advanceOwnerTime } from "@/application/game-service";

describe("simulate-to-date stream route", () => {
  it("keeps simulating and resolves when the client disconnects", async () => {
    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ targetDate: "2026-10-03" }),
      }),
      { params: Promise.resolve({ saveId: "route_disconnect" }) },
    );

    await response.body!.cancel();
    releaseAdvance();
    const run = vi.mocked(advanceOwnerTime).mock.results[0]!.value;
    await expect(run).resolves.toMatchObject({ ok: true });
    expect(progressAfterDisconnect).toHaveBeenCalledTimes(1);
  });
});
