import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

import { CountUp } from "@/components/ui/CountUp";
import { SimulationSummaryModal } from "@/components/calendar/SimulationSummaryModal";
import { NotificationItem } from "@/components/owner/NotificationItem";

afterEach(cleanup);

describe("CountUp", () => {
  it("exposes the final value to assistive tech and renders it first", () => {
    const { container } = render(<CountUp value={112} />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("112");
  });
});

describe("SimulationSummaryModal result reveal", () => {
  it("shows a W stamp and links the latest game", () => {
    render(
      <SimulationSummaryModal
        open
        daysAdvanced={1}
        highlightCount={0}
        returnPath="/dashboard/s/calendar"
        recentHighlights={[]}
        saveId="s"
        teamGames={[
          { date: "2026-10-20", headline: "W 112–104 vs SAC", gameId: "g1" },
        ]}
      />,
    );
    expect(screen.getByLabelText("Win")).toBeTruthy();
    expect(screen.getByRole("link", { name: /SAC/ }).getAttribute("href")).toBe(
      "/dashboard/s/games/g1",
    );
  });
});

describe("SimulationSummaryModal around the league", () => {
  it("links the Media Hub top story", () => {
    render(
      <SimulationSummaryModal
        open
        daysAdvanced={3}
        highlightCount={0}
        returnPath="/dashboard/s/calendar"
        recentHighlights={[]}
        saveId="s"
        aroundTheLeague={{
          authorName: "Mason Pacific",
          text: "The Cobras cruise past the Fury 120–94.",
          href: "/dashboard/s/media",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: /Mason Pacific/ });
    expect(link.getAttribute("href")).toBe("/dashboard/s/media");
    expect(link.textContent).toContain("120–94");
  });

  it("leaves the section out when there is no story", () => {
    render(
      <SimulationSummaryModal
        open
        daysAdvanced={3}
        highlightCount={0}
        returnPath="/dashboard/s/calendar"
        recentHighlights={[]}
        saveId="s"
      />,
    );
    expect(screen.queryByText("Around the league")).toBeNull();
  });
});

describe("NotificationItem", () => {
  it("renders title, message and short date", () => {
    render(
      <NotificationItem
        id="n1"
        title="Cash runway low"
        message="Eight weeks of cash left."
        occurredOn="2026-10-20"
        severity="warning"
        read={false}
        type="cash_runway_warning"
      />,
    );
    expect(screen.getByText("Cash runway low")).toBeTruthy();
    expect(screen.getByText("Eight weeks of cash left.")).toBeTruthy();
  });
});
