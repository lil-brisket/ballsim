import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer: () => {},
    openTeam: () => {},
    openStaff: () => {},
    close: () => {},
  }),
}));

import { ProgressionPanel } from "@/components/development/ProgressionPanel";
import { DashboardMoments } from "@/components/moments/DashboardMoments";
import { ProgressionReveal } from "@/components/moments/ProgressionReveal";
import { resetMomentsForTests } from "@/components/moments/moment-seen";
import { resetSoundSettingsForTests } from "@/components/ui/sound/sound-settings";
import type { DashboardMomentsView } from "@/state/dashboard-moments";
import type {
  ProgressionPlayerRow,
  ProgressionRevealView,
} from "@/state/progression-reveal-selectors";

function row(
  id: string,
  name: string,
  before: number,
  after: number,
): ProgressionPlayerRow {
  return {
    playerId: id,
    name,
    position: "SG",
    age: 24,
    portrait: null,
    before,
    after,
    delta: after - before,
    topMoves:
      after === before
        ? []
        : [
            {
              key: "threePoint",
              label: "Three Point",
              before: 62,
              after: 68,
              delta: 6,
            },
          ],
  };
}

function makeView(
  overrides: Partial<ProgressionRevealView> = {},
): ProgressionRevealView {
  const changed = [
    row("p1", "Ann Able", 70, 73),
    row("p2", "Bob Best", 65, 66),
    row("p3", "Cy Cole", 60, 58),
  ];
  const unchangedPlayers = [row("p4", "Dee Dunn", 55, 55)];
  return {
    seasonYear: 2027,
    teamId: "team_1",
    teamName: "Test Team",
    improved: 2,
    declined: 1,
    unchanged: 1,
    averageBefore: 62.5,
    averageAfter: 63,
    averageDelta: 0.5,
    changed,
    unchangedPlayers,
    risers: [
      {
        playerId: "x1",
        name: "Riser One",
        teamId: "team_2",
        teamAbbreviation: "RSR",
        before: 50,
        after: 57,
        delta: 7,
      },
    ],
    fallers: [
      {
        playerId: "x2",
        name: "Faller One",
        teamId: "team_3",
        teamAbbreviation: "FLR",
        before: 70,
        after: 64,
        delta: -6,
      },
    ],
    isCurrent: true,
    ...overrides,
  };
}

function mockMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const heading = () => screen.getByRole("heading", { level: 2 });
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: /^Next/ }));

beforeEach(() => {
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
  mockMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
});

describe("ProgressionReveal", () => {
  it("steps through headline, players in order, unchanged and league", () => {
    render(<ProgressionReveal view={makeView()} open onClose={() => {}} />);
    expect(
      screen.getByRole("dialog", { name: "Progression reveal" }),
    ).toBeTruthy();
    expect(heading().textContent).toContain("Player progression");
    expect(screen.getByText("2027 offseason")).toBeTruthy();
    expect(
      screen.getByText("2 improved · 1 declined · 1 unchanged"),
    ).toBeTruthy();
    expect(
      screen.getByText((_, el) =>
        /^Team Avg OVR 62\.5 → 63 \(\+0\.5\)$/.test(el?.textContent ?? ""),
      ),
    ).toBeTruthy();

    next();
    expect(heading().textContent).toContain("Ann Able");
    expect(screen.getByText("Biggest jump")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("Age 24 · SG")).toBeTruthy();
    expect(screen.getByText(/Three Point 62 → 68 \(\+6\)/)).toBeTruthy();
    expect(screen.getByText("Overall 73")).toBeTruthy();

    next();
    expect(heading().textContent).toContain("Bob Best");
    expect(screen.getByText("Improved")).toBeTruthy();

    next();
    expect(heading().textContent).toContain("Cy Cole");
    expect(screen.getByText("Declined")).toBeTruthy();
    const drop = screen.getByText("−2");
    expect(drop.className).toContain("text-loss");

    next();
    expect(heading().textContent).toContain("No change");
    expect(screen.getByText("Dee Dunn")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Overall 55" })).toBeTruthy();

    next();
    expect(heading().textContent).toContain("Top risers and fallers");
    expect(screen.getByText("Around the league")).toBeTruthy();
    expect(screen.getByText(/Riser One \(RSR\) 50 → 57 \(\+7\)/)).toBeTruthy();
    expect(screen.getByText(/Faller One \(FLR\) 70 → 64 \(−6\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Done/ })).toBeTruthy();
  });

  it("colours a rise with text-win", () => {
    render(<ProgressionReveal view={makeView()} open onClose={() => {}} />);
    next();
    expect(screen.getByText("+3").className).toContain("text-win");
  });

  it("shows only the summary under reduced motion", () => {
    mockMotion(true);
    render(<ProgressionReveal view={makeView()} open onClose={() => {}} />);
    expect(heading().textContent).toContain("Player progression");
    expect(screen.queryByRole("button", { name: /^Next/ })).toBeNull();
    expect(screen.getByText(/Ann Able 70 → 73 \(\+3\)/)).toBeTruthy();
    expect(screen.getByText(/Cy Cole 60 → 58 \(−2\)/)).toBeTruthy();
  });

  it("renders a team with no changes", () => {
    const view = makeView({
      changed: [],
      improved: 0,
      declined: 0,
      unchanged: 1,
      averageDelta: 0,
      risers: [],
      fallers: [],
    });
    render(<ProgressionReveal view={view} open onClose={() => {}} />);
    expect(heading().textContent).toContain("Player progression");
    next();
    expect(heading().textContent).toContain("No change");
    expect(screen.getByRole("button", { name: /^Done/ })).toBeTruthy();
  });

  it("omits the league step when both lists are empty", () => {
    const view = makeView({ risers: [], fallers: [] });
    render(<ProgressionReveal view={view} open onClose={() => {}} />);
    expect(screen.getByText("1 / 5")).toBeTruthy();
  });
});

describe("ProgressionPanel", () => {
  it("shows an empty state without a view", () => {
    render(<ProgressionPanel saveId="save_1" view={null} />);
    expect(screen.getByText(/after the first offseason/)).toBeTruthy();
  });

  function names(): string[] {
    const table = screen.getByRole("table", { name: "Progression" });
    return within(table)
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[0]!.textContent ?? "");
  }

  it("sorts by Change desc by default and toggles on click", () => {
    render(<ProgressionPanel saveId="save_1" view={makeView()} />);
    expect(names()).toEqual(["Ann Able", "Bob Best", "Dee Dunn", "Cy Cole"]);

    const change = screen.getByRole("button", { name: /Change/ });
    fireEvent.click(change);
    expect(names()).toEqual(["Cy Cole", "Dee Dunn", "Bob Best", "Ann Able"]);
    fireEvent.click(change);
    expect(names()).toEqual(["Ann Able", "Bob Best", "Dee Dunn", "Cy Cole"]);

    fireEvent.click(screen.getByRole("button", { name: /Player/ }));
    expect(names()).toEqual(["Ann Able", "Bob Best", "Cy Cole", "Dee Dunn"]);
    fireEvent.click(screen.getByRole("button", { name: /Player/ }));
    expect(names()).toEqual(["Dee Dunn", "Cy Cole", "Bob Best", "Ann Able"]);
  });

  it("prints signed changes and opens the replay on demand", () => {
    render(<ProgressionPanel saveId="save_1" view={makeView()} />);
    expect(screen.getByText("−2")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Replay progression/ }));
    expect(
      screen.getByRole("dialog", { name: "Progression reveal" }),
    ).toBeTruthy();
  });
});

describe("DashboardMoments", () => {
  function moments(
    progression: ProgressionRevealView | null,
  ): DashboardMomentsView {
    return { teamId: "team_1", progression };
  }

  it("auto-opens when current, and not again after closing", () => {
    const first = render(
      <DashboardMoments saveId="save_1" moments={moments(makeView())} />,
    );
    expect(
      screen.getByRole("dialog", { name: "Progression reveal" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    render(<DashboardMoments saveId="save_1" moments={moments(makeView())} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open when progression is not current or missing", () => {
    render(
      <DashboardMoments
        saveId="save_1"
        moments={moments(makeView({ isCurrent: false }))}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    render(<DashboardMoments saveId="save_1" moments={moments(null)} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    render(<DashboardMoments saveId="save_1" moments={undefined} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
