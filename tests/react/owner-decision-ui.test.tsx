import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("@/application/actions", () => ({
  acceptOwnerDecisionAction: vi.fn(),
  declineOwnerDecisionAction: vi.fn(),
  askAiOwnerDecisionAction: vi.fn(),
}));

import { AiAssistanceHelpPanel } from "@/components/owner/ai-management/AiAssistanceHelpPanel";
import { DelegationSummary } from "@/components/owner/ai-management/DelegationSummary";
import { PendingOwnerDecisionPanel } from "@/components/owner/dashboard/PendingOwnerDecisionPanel";
import { applyPreset } from "@/domain/ai-management-presets";

describe("AI co-control copy", () => {
  it("explains delegation does not lock manual control", () => {
    render(<AiAssistanceHelpPanel />);
    expect(
      screen.getByText(/does not lock what you can do manually/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/pauses only for meaningful owner decisions/i),
    ).toBeTruthy();
  });

  it("shows override language when all visible areas are delegated", () => {
    render(
      <DelegationSummary assistance={applyPreset("full_management")} />,
    );
    expect(
      screen.getByText(/you can still override any AI move manually/i),
    ).toBeTruthy();
  });
});

describe("PendingOwnerDecisionPanel", () => {
  it("renders Accept, Decline, and Ask AI with deal details", () => {
    render(
      <PendingOwnerDecisionPanel
        saveId="save_1"
        returnPath="/dashboard/save_1"
        offer={{
          decisionId: "od_1",
          offeringTeamName: "Boston Breakers",
          offeringTeamBranding: null,
          youReceive: ["Alex Johnson"],
          theyReceive: ["John Smith"],
        }}
      />,
    );
    expect(screen.getByText(/Simulation paused/i)).toBeTruthy();
    expect(
      screen.getByText(/Trade offer requires your decision/i),
    ).toBeTruthy();
    expect(screen.getByText("Alex Johnson")).toBeTruthy();
    expect(screen.getByText("John Smith")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask AI" })).toBeTruthy();
  });
});
