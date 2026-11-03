import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  fantasyDraftPickAction: vi.fn(),
}));

import { DraftConfirmDialog } from "@/components/fantasy-draft/DraftConfirmDialog";
import { RecommendationsPanel } from "@/components/fantasy-draft/RecommendationsPanel";

describe("fantasy draft position labels", () => {
  afterEach(cleanup);

  it("confirm dialog shows PG/SG with a secondary and PG without", () => {
    const base = {
      playerId: "p1",
      name: "Ann Mine",
      overall: 70,
      potential: 80,
    };
    const { rerender } = render(
      <DraftConfirmDialog
        saveId="s1"
        player={{ ...base, position: "PG", secondaryPosition: "SG" }}
        pending={false}
        onCancel={vi.fn()}
        onSubmitStart={vi.fn()}
      />,
    );
    expect(screen.getByText("PG/SG")).toBeTruthy();
    rerender(
      <DraftConfirmDialog
        saveId="s1"
        player={{ ...base, position: "PG" }}
        pending={false}
        onCancel={vi.fn()}
        onSubmitStart={vi.fn()}
      />,
    );
    expect(screen.getByText("PG")).toBeTruthy();
    expect(screen.queryByText("PG/SG")).toBeNull();
  });

  it("best-available card shows the secondary position", () => {
    render(
      <RecommendationsPanel
        draft={
          {
            bestAvailable: {
              playerId: "p1",
              firstName: "Ann",
              lastName: "Mine",
              position: "SF",
              secondaryPosition: "PF",
              overall: 70,
              potential: 80,
              tier: "starter",
            },
            bestFit: null,
          } as never
        }
      />,
    );
    expect(screen.getByText("SF/PF")).toBeTruthy();
  });
});
