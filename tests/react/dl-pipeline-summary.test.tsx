import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DlAssignSection,
  DlPipelineSection,
  DlPipelineSummary,
} from "@/components/development-league/DlPipelineSummary";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";

afterEach(() => {
  cleanup();
});

describe("DlPipelineSummary", () => {
  it("renders summary counts and Ready label", () => {
    render(
      <DlPipelineSummary
        record={{ wins: 8, losses: 4 }}
        assignedCount={6}
        ready={2}
        nearReady={1}
        developing={3}
      />,
    );
    expect(screen.getByText("8–4")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("renders an em dash when record is null", () => {
    render(
      <DlPipelineSummary
        record={null}
        assignedCount={0}
        ready={0}
        nearReady={0}
        developing={0}
      />,
    );
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders parent identity when branding is null", () => {
    render(
      <TeamIdentityInline
        city="Boston"
        name="Wolves"
        abbreviation="BOS"
        branding={null}
      />,
    );
    expect(screen.getByText("BOS")).toBeTruthy();
    expect(screen.getByText(/Boston Wolves/)).toBeTruthy();
  });
});

describe("DL hub section chrome", () => {
  it("exposes pipeline and assign test ids with muted assign class", () => {
    render(
      <>
        <DlPipelineSection>
          <p>Pipeline</p>
        </DlPipelineSection>
        <DlAssignSection>
          <button type="button">Assign</button>
        </DlAssignSection>
      </>,
    );
    const pipeline = screen.getByTestId("dl-pipeline");
    const assign = screen.getByTestId("dl-assign");
    expect(pipeline).toBeTruthy();
    expect(assign.className).toContain("text-zinc-500");
    expect(screen.getByText("Assign")).toBeTruthy();
  });
});
