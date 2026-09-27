import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  assignToDevelopmentLeagueAction: vi.fn(),
  recallFromDevelopmentLeagueAction: vi.fn(),
  loadPlayerDrawerAction: vi.fn(),
  loadTeamDrawerAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/s1/development-league",
  useSearchParams: () => new URLSearchParams(),
}));

import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import {
  ChangeDelta,
  DlEligibleCard,
  DlProspectCard,
} from "@/components/development-league/DlProspectCard";
import type { DlProspectRowView } from "@/state/development-league-selectors";

afterEach(() => {
  cleanup();
});

function wrap(ui: React.ReactNode) {
  return <EntityDrawerProvider saveId="s1">{ui}</EntityDrawerProvider>;
}

function prospect(
  overrides: Partial<DlProspectRowView> = {},
): DlProspectRowView {
  return {
    playerId: "p1",
    name: "Alex Prospect",
    overall: 72,
    potential: 84,
    potentialHeadroom: 12,
    age: 21,
    dlSeason: 2,
    seasonsRemaining: 1,
    role: "starter",
    mpg: 28,
    ppg: 14.2,
    rpg: 5.1,
    apg: 3.4,
    readiness: "ready",
    whyBullets: ["Current OVR: 72 (potential 84)"],
    changeDelta: 3,
    changeLabel: "69 → 72",
    ...overrides,
  };
}

describe("DlProspectCard", () => {
  it("renders name, Ready badge, tenure, and Recall on a ready prospect", () => {
    render(
      wrap(
        <DlProspectCard
          saveId="s1"
          row={prospect()}
          returnPath="/dashboard/s1/development-league"
        />,
      ),
    );
    expect(screen.getByText("Alex Prospect")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText(/Season 2 of 3/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recall" })).toBeTruthy();
    expect(
      screen.getByRole("progressbar", {
        name: "Development League tenure: 2 of 3 seasons",
      }),
    ).toBeTruthy();
  });

  it("renders a muted dash with history aria-label when changeDelta is null", () => {
    render(
      wrap(
        <DlProspectCard
          saveId="s1"
          row={prospect({ changeDelta: null, changeLabel: null })}
          returnPath="/dashboard/s1/development-league"
        />,
      ),
    );
    expect(screen.getByLabelText("No season-over-season history")).toBeTruthy();
  });

  it("renders a positive emerald delta", () => {
    render(<ChangeDelta delta={3} />);
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("+3").className).toContain("text-emerald-300");
  });
});

describe("DlEligibleCard", () => {
  it("keeps Assign available", () => {
    render(
      wrap(
        <DlEligibleCard
          saveId="s1"
          row={{
            playerId: "p2",
            name: "Casey Eligible",
            overall: 64,
            potential: 82,
            projectedMpg: 8,
            strongCandidate: true,
          }}
          returnPath="/dashboard/s1/development-league"
        />,
      ),
    );
    expect(screen.getByText("Casey Eligible")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assign" })).toBeTruthy();
  });
});
