import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  fantasyDraftPickAction: vi.fn(),
  continueAfterFantasyDraftAction: vi.fn(),
}));

import { DraftConfirmDialog } from "@/components/fantasy-draft/DraftConfirmDialog";
import { RecommendationsPanel } from "@/components/fantasy-draft/RecommendationsPanel";
import { FantasyDraftSummaryClient } from "@/components/fantasy-draft/summary/FantasyDraftSummaryClient";
import type { FantasyDraftTeamSummary } from "@/domain/entities/fantasy-draft";
import type { FantasyDraftSummaryView } from "@/state/selectors";

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

describe("fantasy draft summary position labels", () => {
  afterEach(cleanup);

  const highlight = (playerId: string, name: string, position: string) => ({
    playerId,
    playerName: name,
    pickNumber: 3,
    overall: 72,
    potential: 80,
    position,
  });

  function summaryView(
    secondaryPositionById?: Record<string, string>,
  ): FantasyDraftSummaryView {
    const team = {
      teamId: "t1",
      playerCount: 15,
      avgOvr: 60,
      avgPot: 70,
      avgAge: 24,
      positionCounts: [],
      positionBalance: [],
      archetypeCounts: [],
      positionalOverlap: [],
      bestPlayer: null,
      highestPotential: null,
      oldestPick: null,
      youngestPick: null,
      rosterStrength: 70,
      longTermStrength: 70,
      remainingWeaknesses: [],
      bestPick: highlight("p-best", "Ann Best", "SF"),
      biggestReach: null,
      bestValue: highlight("p-value", "Bo Value", "PG"),
      strongValuePickCount: 1,
      draftGrade: "B",
      draftGradeLabel: "Good",
      draftVerdict: "A solid draft.",
      strengths: [],
      concerns: [],
      teamOutlook: { shortTerm: "ok", longTerm: "ok", narrative: "ok" },
      recommendedNextSteps: [],
      pickBreakdown: [
        {
          pickNumber: 3,
          round: 1,
          playerId: "p-row",
          playerName: "Cy Row",
          position: "PF",
          overall: 70,
          potential: 75,
          age: 22,
          assessment: "Good",
          valueStars: 3,
        },
      ],
    } as unknown as FantasyDraftTeamSummary;
    return {
      status: "complete",
      totalPicks: 15,
      selectionsMade: 15,
      undraftedCount: 20,
      controlledTeamIds: ["t1"],
      teamSummaries: { t1: team },
      leagueRecap: null,
      teamNames: { t1: { name: "Test Team", abbreviation: "TST" } },
      secondaryPositionById,
    };
  }

  it("shows a drafted player's secondary in the highlight cards and the pick table", () => {
    render(
      <FantasyDraftSummaryClient
        saveId="s1"
        view={summaryView({
          "p-best": "PF",
          "p-row": "C",
        })}
      />,
    );
    expect(screen.getByText("SF/PF")).toBeTruthy(); // best pick card
    expect(screen.getByText("PF/C")).toBeTruthy(); // pick table row
    // No secondary: the plain position, exactly as before.
    expect(screen.getByText("PG")).toBeTruthy(); // best value card
    expect(screen.queryByText("PG/SG")).toBeNull();
  });

  it("falls back to the plain position when the view has no lookup", () => {
    render(<FantasyDraftSummaryClient saveId="s1" view={summaryView()} />);
    expect(screen.getByText("SF")).toBeTruthy();
    expect(screen.getByText("PF")).toBeTruthy();
  });
});
