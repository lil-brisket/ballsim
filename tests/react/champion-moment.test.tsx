import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("@/components/ui/sound/ui-sound", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/sound/ui-sound")>()),
  playUiSound: vi.fn(),
}));

vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer: () => {},
    openTeam: () => {},
    openStaff: () => {},
    close: () => {},
  }),
}));

import { ChampionMoment } from "@/components/moments/ChampionMoment";
import { DashboardMoments } from "@/components/moments/DashboardMoments";
import { resetMomentsForTests } from "@/components/moments/moment-seen";
import { ChampionReplay } from "@/components/playoffs/ChampionReplay";
import { playUiSound } from "@/components/ui/sound/ui-sound";
import { resetSoundSettingsForTests } from "@/components/ui/sound/sound-settings";
import type { ChampionMomentView } from "@/state/champion-moment-selectors";
import type { DashboardMomentsView } from "@/state/dashboard-moments";
import type { ProgressionRevealView } from "@/state/progression-reveal-selectors";

function champion(
  overrides: Partial<ChampionMomentView> = {},
): ChampionMomentView {
  return {
    seasonYear: 2027,
    championTeamId: "team_2",
    championName: "Boston Hounds",
    abbreviation: "BOS",
    branding: {
      primaryColor: "#112233",
      secondaryColor: "#445566",
      accentColor: "#778899",
      logoId: "shield",
    },
    finalsOpponentName: "Ottawa Owls",
    finalsWins: "4–2",
    userTeamIsChampion: false,
    isCurrent: true,
    ...overrides,
  };
}

function progression(): ProgressionRevealView {
  return {
    seasonYear: 2027,
    teamId: "team_1",
    teamName: "Test Team",
    improved: 1,
    declined: 0,
    unchanged: 0,
    averageBefore: 60,
    averageAfter: 61,
    averageDelta: 1,
    changed: [
      {
        playerId: "p1",
        name: "Ann Able",
        position: "SG",
        age: 24,
        portrait: null,
        before: 70,
        after: 73,
        delta: 3,
        topMoves: [],
      },
    ],
    unchangedPlayers: [],
    risers: [],
    fallers: [],
    isCurrent: true,
  };
}

function moments(
  overrides: Partial<DashboardMomentsView> = {},
): DashboardMomentsView {
  return {
    teamId: "team_1",
    awards: null,
    champion: champion(),
    progression: progression(),
    recap: null,
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
const stings = () =>
  vi.mocked(playUiSound).mock.calls.filter(([name]) => name === "sting");

beforeEach(() => {
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
  vi.mocked(playUiSound).mockClear();
  mockMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
});

describe("ChampionMoment", () => {
  it("announces another team's title with the Finals result", () => {
    render(<ChampionMoment view={champion()} open onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Championship" })).toBeTruthy();
    expect(screen.getByText("2027 Finals")).toBeTruthy();
    expect(heading().textContent).toContain("Boston Hounds win the title");
    expect(screen.getByText("Beat Ottawa Owls 4–2 in the Finals")).toBeTruthy();
    expect(stings()).toHaveLength(0);
  });

  it("celebrates the owner's own title with a sting", () => {
    render(
      <ChampionMoment
        view={champion({ userTeamIsChampion: true })}
        open
        onClose={() => {}}
      />,
    );
    expect(heading().textContent).toContain("Your Boston Hounds are champions");
    expect(stings()).toHaveLength(1);
  });

  it("has no opponent line when the Finals opponent is unknown", () => {
    render(
      <ChampionMoment
        view={champion({ finalsOpponentName: null })}
        open
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Won the Finals 4–2")).toBeTruthy();
  });

  it("shows the same facts on one static card under reduced motion", () => {
    mockMotion(true);
    const onClose = vi.fn();
    render(
      <ChampionMoment
        view={champion({ userTeamIsChampion: true })}
        open
        onClose={onClose}
      />,
    );
    expect(heading().textContent).toContain("Your Boston Hounds are champions");
    expect(screen.getByText("Beat Ottawa Owls 4–2 in the Finals")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Skip all/ })).toBeNull();
    expect(stings()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides the trophy and logo from assistive tech", () => {
    const { baseElement } = render(
      <ChampionMoment view={champion()} open onClose={() => {}} />,
    );
    const dialog = within(baseElement.querySelector("[role='dialog']")!);
    expect(dialog.queryAllByRole("img")).toHaveLength(0);
    expect(
      baseElement.querySelectorAll("svg[aria-hidden='true']").length,
    ).toBeGreaterThan(0);
  });
});

describe("DashboardMoments queue", () => {
  it("shows the champion first, then progression, never both", () => {
    render(<DashboardMoments saveId="save_1" moments={moments()} />);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Championship" })).toBeTruthy();
    expect(
      screen.queryByRole("dialog", { name: "Progression reveal" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "Progression reveal" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Championship" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens progression straight away when there is no champion moment", () => {
    render(
      <DashboardMoments
        saveId="save_1"
        moments={moments({ champion: null })}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Progression reveal" }),
    ).toBeTruthy();
  });

  it("does not reopen moments that were already shown", () => {
    const first = render(
      <DashboardMoments saveId="save_1" moments={moments()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    first.unmount();
    resetMomentsForTests();
    render(<DashboardMoments saveId="save_1" moments={moments()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives each owner their own seen state for the league-wide champion", () => {
    const first = render(
      <DashboardMoments saveId="save_1" moments={moments()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    first.unmount();
    cleanup();
    render(
      <DashboardMoments
        saveId="save_1"
        moments={moments({ teamId: "team_9", progression: null })}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Championship" })).toBeTruthy();
  });
});

describe("ChampionReplay", () => {
  it("opens only on demand and does not clash with the dashboard gate", () => {
    render(
      <ChampionReplay saveId="save_1" teamId="team_1" view={champion()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Replay championship/ }),
    );
    expect(screen.getByRole("dialog", { name: "Championship" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
