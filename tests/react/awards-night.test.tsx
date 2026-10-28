import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("@/components/ui/sound/ui-sound", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ui/sound/ui-sound")>();
  return { ...actual, playUiSound: vi.fn(actual.playUiSound) };
});

vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer: () => {},
    openTeam: () => {},
    openStaff: () => {},
    close: () => {},
  }),
}));

import { AwardsNightReplay } from "@/components/history/AwardsNightReplay";
import { AwardsNight } from "@/components/moments/AwardsNight";
import { DashboardMoments } from "@/components/moments/DashboardMoments";
import { resetMomentsForTests } from "@/components/moments/moment-seen";
import {
  resetSoundSettingsForTests,
  updateSoundSettings,
} from "@/components/ui/sound/sound-settings";
import {
  playUiSound,
  setAudioContextFactory,
} from "@/components/ui/sound/ui-sound";
import type {
  AwardsNightAward,
  AwardsNightFinalist,
  AwardsNightView,
} from "@/state/awards-night-selectors";
import type { ChampionMomentView } from "@/state/champion-moment-selectors";
import type { DashboardMomentsView } from "@/state/dashboard-moments";
import type { ProgressionRevealView } from "@/state/progression-reveal-selectors";

function finalist(
  id: string,
  rankLabel: string,
  overrides: Partial<AwardsNightFinalist> = {},
): AwardsNightFinalist {
  return {
    subjectId: id,
    subjectType: "player",
    name: `Player ${id}`,
    teamId: "team_2",
    teamAbbreviation: "BOS",
    rankLabel,
    isUserTeam: false,
    ...overrides,
  };
}

function award(
  awardId: string,
  displayName: string,
  options: {
    userWon?: boolean;
    tieBreak?: boolean;
    coach?: boolean;
    statLine?: string;
  } = {},
): AwardsNightAward {
  const subjectType = options.coach ? "coach" : "player";
  const userWon = options.userWon ?? false;
  const winner = finalist(`${awardId}_1`, "1", {
    subjectType,
    name: `Winner ${displayName}`,
    teamId: userWon ? "team_1" : "team_2",
    teamAbbreviation: userWon ? "TST" : "BOS",
    isUserTeam: userWon,
  });
  return {
    awardId,
    displayName,
    subjectType,
    finalists: [
      winner,
      finalist(`${awardId}_2`, "T-2"),
      finalist(`${awardId}_3`, "T-2"),
    ],
    winner: {
      ...winner,
      portrait: null,
      teamName: userWon ? "Test Team" : "Boston Hounds",
      statLine: options.statLine ?? "70 GP · 24.1 PTS · 7.2 REB · 5.0 AST",
      tieBreak: options.tieBreak ?? false,
    },
    userWon,
  };
}

function view(
  awards: AwardsNightAward[] = [
    award("coach_of_year", "Coach of the Year", {
      coach: true,
      statLine: "52–30",
    }),
    award("mvp", "Most Valuable Player", { userWon: true, tieBreak: true }),
  ],
  isCurrent = true,
): AwardsNightView {
  return {
    seasonYear: 2027,
    awards,
    userWinners: awards.filter((a) => a.userWon).length,
    isCurrent,
  };
}

function champion(): ChampionMomentView {
  return {
    seasonYear: 2027,
    championTeamId: "team_2",
    championName: "Boston Hounds",
    abbreviation: "BOS",
    branding: null,
    finalsOpponentName: "Ottawa Owls",
    finalsWins: "4–2",
    userTeamIsChampion: false,
    isCurrent: true,
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
    awards: view(),
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

let audioContexts = 0;
function installFakeAudio() {
  audioContexts = 0;
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    type: "",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    start: vi.fn(),
    stop: vi.fn(),
  });
  setAudioContextFactory(() => {
    audioContexts += 1;
    return {
      currentTime: 0,
      state: "running",
      destination: {},
      createOscillator: vi.fn(node),
      createGain: vi.fn(node),
      createBiquadFilter: vi.fn(node),
      resume: vi.fn(() => Promise.resolve()),
    } as unknown as AudioContext;
  });
}

const heading = () => screen.getByRole("heading", { level: 2 });
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
const stings = () =>
  vi.mocked(playUiSound).mock.calls.filter(([name]) => name === "sting");

beforeEach(() => {
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
  installFakeAudio();
  vi.mocked(playUiSound).mockClear();
  mockMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setAudioContextFactory(null);
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
});

describe("AwardsNight", () => {
  it("opens with an intro that counts awards and the user's winners", () => {
    render(<AwardsNight view={view()} open onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Awards night" })).toBeTruthy();
    expect(screen.getByText("2027 season")).toBeTruthy();
    expect(heading().textContent).toContain("Awards night");
    expect(screen.getByText("2 awards")).toBeTruthy();
    expect(screen.getByText("1 for your team")).toBeTruthy();
  });

  it("omits the team line when the user won nothing", () => {
    render(
      <AwardsNight
        view={view([award("mvp", "Most Valuable Player")])}
        open
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("1 awards")).toBeTruthy();
    expect(screen.queryByText(/for your team/)).toBeNull();
  });

  it("steps intro, then finalists and winner per award, MVP last", () => {
    const onClose = vi.fn();
    render(<AwardsNight view={view()} open onClose={onClose} />);
    const live = document.querySelector('[aria-live="polite"]')!;
    const seen: string[] = [live.textContent ?? ""];
    for (let i = 0; i < 4; i += 1) {
      next();
      seen.push(live.textContent ?? "");
    }
    expect(seen).toEqual([
      "Step 1 of 5: Awards night",
      "Step 2 of 5: The finalists",
      "Step 3 of 5: Winner Coach of the Year",
      "Step 4 of 5: The finalists",
      "Step 5 of 5: Winner Most Valuable Player",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lists finalists with rank, name and team, marking the user's team in text", () => {
    const mvp = award("mvp", "Most Valuable Player", { userWon: true });
    render(<AwardsNight view={view([mvp])} open onClose={() => {}} />);
    next();
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]!.textContent).toContain(
      "1 · Winner Most Valuable Player · TST",
    );
    expect(items[0]!.textContent).toContain("Your team");
    expect(items[1]!.textContent).toContain("T-2 · Player mvp_2 · BOS");
    expect(items[1]!.textContent).not.toContain("Your team");
  });

  it("shows the winner's team, stat line, tie-break and user badge", () => {
    const mvp = award("mvp", "Most Valuable Player", {
      userWon: true,
      tieBreak: true,
    });
    render(<AwardsNight view={view([mvp])} open onClose={() => {}} />);
    next();
    next();
    expect(screen.getByText("Test Team")).toBeTruthy();
    expect(
      screen.getByText("70 GP · 24.1 PTS · 7.2 REB · 5.0 AST"),
    ).toBeTruthy();
    expect(screen.getByText("Won on tie-break")).toBeTruthy();
    expect(screen.getByText("Your team")).toBeTruthy();
  });

  it("shows a coach winner without a portrait", () => {
    const coach = award("coach_of_year", "Coach of the Year", {
      coach: true,
      statLine: "52–30",
    });
    render(<AwardsNight view={view([coach])} open onClose={() => {}} />);
    next();
    next();
    expect(screen.getByText("52–30")).toBeTruthy();
    expect(screen.queryByText("Won on tie-break")).toBeNull();
    expect(screen.queryByText("Your team")).toBeNull();
  });

  it("plays the sting on the user's winner step only, and only with sound on", () => {
    const run = () => {
      render(<AwardsNight view={view()} open onClose={() => {}} />);
      next(); // coach finalists
      next(); // coach winner (not the user's)
      expect(stings()).toHaveLength(0);
      next(); // mvp finalists
      next(); // mvp winner (user's)
    };
    run();
    // Sound is off by default: the sting is requested but no audio is created.
    expect(stings()).toHaveLength(1);
    expect(audioContexts).toBe(0);
    cleanup();
    vi.mocked(playUiSound).mockClear();

    updateSoundSettings({ enabled: true });
    run();
    expect(stings()).toHaveLength(1);
    expect(audioContexts).toBeGreaterThan(0);
  });

  it("lists every award on one static card under reduced motion", () => {
    mockMotion(true);
    const onClose = vi.fn();
    render(<AwardsNight view={view()} open onClose={onClose} />);
    expect(heading().textContent).toContain("Awards night");
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Coach of the Year: Winner Coach of the Year (BOS)",
      "Most Valuable Player: Winner Most Valuable Player (TST)Your team",
    ]);
    expect(screen.queryByRole("button", { name: /^Skip all/ })).toBeNull();
    expect(stings()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without awards", () => {
    render(<AwardsNight view={view([])} open onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("AwardsNightReplay", () => {
  it("opens only on demand and does not clash with the dashboard gate", () => {
    render(<AwardsNightReplay saveId="save_1" teamId="team_1" view={view()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Replay 2027 awards night/ }),
    );
    expect(screen.getByRole("dialog", { name: "Awards night" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DashboardMoments queue with awards", () => {
  it("shows awards, then the champion, then progression", () => {
    render(<DashboardMoments saveId="save_1" moments={moments()} />);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Awards night" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Championship" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "Progression reveal" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("skips awards when they are not current", () => {
    render(
      <DashboardMoments saveId="save_1" moments={moments({ awards: null })} />,
    );
    expect(screen.getByRole("dialog", { name: "Championship" })).toBeTruthy();
  });
});
