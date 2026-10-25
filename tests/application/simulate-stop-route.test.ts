import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const canAccess = vi.fn<(saveId: string) => Promise<boolean>>();
vi.mock("@/application/game-service", () => ({
  canAccessOwnerSave: (saveId: string) => canAccess(saveId),
}));

import { POST } from "@/app/api/saves/[saveId]/simulate-to-date/stop/route";
import { runWithSimulationDedupe } from "@/application/simulation-guard";
import {
  clearSimulationStopRequest,
  isSimulationStopRequested,
} from "@/application/simulation-stop-requests";

const SAVE_ID = "save_running";

function stop(saveId: string) {
  return POST(new Request("http://localhost/api", { method: "POST" }), {
    params: Promise.resolve({ saveId }),
  });
}

describe("simulate-to-date stop route", () => {
  it("only lets a caller who can open the save stop its simulation", async () => {
    let finish: () => void = () => {};
    const running = runWithSimulationDedupe(
      SAVE_ID,
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    canAccess.mockResolvedValue(false);
    const refused = await stop(SAVE_ID);
    expect(refused.status).toBe(404);
    expect(isSimulationStopRequested(SAVE_ID)).toBe(false);

    canAccess.mockResolvedValue(true);
    const accepted = await stop(SAVE_ID);
    expect(await accepted.json()).toEqual({ ok: true, stopping: true });
    expect(isSimulationStopRequested(SAVE_ID)).toBe(true);

    finish();
    await running;
    clearSimulationStopRequest(SAVE_ID);
  });
});
