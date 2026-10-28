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

import { SeasonRecapPanel } from "@/components/franchise/SeasonRecapPanel";
import { DashboardMoments } from "@/components/moments/DashboardMoments";
import { SeasonRecap } from "@/components/moments/SeasonRecap";
import { resetMomentsForTests } from "@/components/moments/moment-seen";
import {
  resetSoundSettingsForTests,
  updateSoundSettings,
} from "@/components/ui/sound/sound-settings";
import {
  playUiSound,
  setAudioContextFactory,
} from "@/components/ui/sound/ui-sound";
import type { AwardsNightView } from "@/state/awards-night-selectors";
import type { ChampionMomentView } from "@/state/champion-moment-selectors";
import type { DashboardMomentsView } from "@/state/dashboard-moments";
import type { ProgressionRevealView } from "@/state/progression-reveal-selectors";
import type { SeasonRecapView } from "@/state/season-recap-selectors";

function recapView(overrides: Partial<SeasonRecapView> = {}): SeasonRecapView {
  return {
    seasonYear: 2027,
    teamId: "team_1",
    teamName: "Test Team",
    wins: 50,
    losses: 32,
    leagueRank: 3,
    seed: 4,
    playoffResult: "second_round",
    playoffLabel: "Lost in the second round",
    championship: false,
    bestGames: [
      {
        gameId: "g1",
        date: "2026-11-03",
        playoff: true,
        home: false,
        opponentAbbreviation: "SAO",
        opponentName: "Sao Hounds",
        teamScore: 112,
        opponentScore: 98,
        margin: 14,
        overtimes: 2,
      },
      {
        gameId: "g2",
        date: "2026-12-10",
        playoff: false,
        home: true,
        opponentAbbreviation: "BOS",
        opponentName: "Boston Hounds",
        teamScore: 101,
        opponentScore: 100,
        margin: 1,
        overtimes: 0,
      },
    ],
    awardWinners: [
      { awardName: "Most Valuable Player", winnerName: "Ann Able" },
    ],
    bestPlayer: {
      playerId: "p1",
      name: "Ann Able",
      position: "SG",
      portrait: null,
      games: 70,
      points: 24.1,
      rebounds: 7.2,
      assists: 5,
    },
    finances: {
      netIncome: {
        value: 12_000_000,
        prior: 10_800_000,
        delta: 1_200_000,
        deltaPct: 11,
      },
      endingCash: {
        value: 20_000_000,
        prior: 21_000_000,
        delta: -1_000_000,
        deltaPct: -5,
      },
    },
    trajectory: { competitive: "up", financial: "flat", brand: "down" },
    isCurrent: true,
    ...overrides,
  };
}

const firstSeason = (): Partial<SeasonRecapView> => ({
  finances: {
    netIncome: { value: 5_000_000, prior: null, delta: null, deltaPct: null },
    endingCash: { value: 9_000_000, prior: null, delta: null, deltaPct: null },
  },
});

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
const live = () =>
  document.querySelector('[aria-live="polite"]')!.textContent ?? "";

function walk(steps: number): string[] {
  const seen = [live()];
  for (let i = 1; i < steps; i += 1) {
    next();
    seen.push(live());
  }
  return seen;
}

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

describe("SeasonRecap", () => {
  it("steps record, games, awards, player, books, trajectory", () => {
    render(<SeasonRecap view={recapView()} open onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Season recap" })).toBeTruthy();
    expect(screen.getByText("2027 season")).toBeTruthy();
    expect(heading().textContent).toContain("50–32");
    expect(screen.getByText("3rd in the league")).toBeTruthy();
    expect(screen.getByText("No. 4 seed")).toBeTruthy();
    expect(screen.getByText("Lost in the second round")).toBeTruthy();
    expect(screen.queryByText("Champions")).toBeNull();
    expect(walk(6)).toEqual([
      "Step 1 of 6: 50–32",
      "Step 2 of 6: Best games",
      "Step 3 of 6: Your award winners",
      "Step 4 of 6: Ann Able",
      "Step 5 of 6: The books",
      "Step 6 of 6: Where the franchise is heading",
    ]);
  });

  it("lists best games with OT labels, venue and date", () => {
    render(<SeasonRecap view={recapView()} open onClose={() => {}} />);
    next();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "W 112–98 @ SAO · Nov 3 · Playoffs · 2OT",
      "W 101–100 vs BOS · Dec 10",
    ]);
  });

  it("shows the award winners and the best player's line", () => {
    render(<SeasonRecap view={recapView()} open onClose={() => {}} />);
    next();
    next();
    expect(screen.getByText("Most Valuable Player: Ann Able")).toBeTruthy();
    next();
    expect(screen.getByText("Best player")).toBeTruthy();
    expect(
      screen.getByText("70 GP · 24.1 PTS · 7.2 REB · 5.0 AST"),
    ).toBeTruthy();
    expect(screen.getByText("SG")).toBeTruthy();
  });

  it("skips steps whose data is empty", () => {
    render(
      <SeasonRecap
        view={recapView({ bestGames: [], awardWinners: [], bestPlayer: null })}
        open
        onClose={() => {}}
      />,
    );
    expect(walk(3)).toEqual([
      "Step 1 of 3: 50–32",
      "Step 2 of 3: The books",
      "Step 3 of 3: Where the franchise is heading",
    ]);
  });

  it("omits rank and seed lines when unknown", () => {
    render(
      <SeasonRecap
        view={recapView({ leagueRank: null, seed: null })}
        open
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/in the league/)).toBeNull();
    expect(screen.queryByText(/seed/)).toBeNull();
  });

  it("plays the sting on a title season only, and only with sound on", () => {
    const title = recapView({
      championship: true,
      playoffResult: "champion",
      playoffLabel: "Won the title",
    });
    render(<SeasonRecap view={title} open onClose={() => {}} />);
    expect(screen.getByText("Champions")).toBeTruthy();
    expect(stings()).toHaveLength(1);
    expect(audioContexts).toBe(0);
    cleanup();
    vi.mocked(playUiSound).mockClear();

    updateSoundSettings({ enabled: true });
    render(<SeasonRecap view={title} open onClose={() => {}} />);
    expect(stings()).toHaveLength(1);
    expect(audioContexts).toBeGreaterThan(0);
    cleanup();
    vi.mocked(playUiSound).mockClear();

    render(<SeasonRecap view={recapView()} open onClose={() => {}} />);
    expect(stings()).toHaveLength(0);
  });

  it("shows the trajectory as words as well as arrows", () => {
    render(<SeasonRecap view={recapView()} open onClose={() => {}} />);
    walk(6);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "▲CompetitiveUp",
      "▶FinancialFlat",
      "▼BrandDown",
    ]);
  });

  it("compares finances with last year only when a prior exists", () => {
    const { unmount } = render(
      <SeasonRecap view={recapView()} open onClose={() => {}} />,
    );
    walk(5);
    expect(screen.getByText("$12.0M")).toBeTruthy();
    expect(screen.getByText("+$1.2M vs last year")).toBeTruthy();
    expect(screen.getByText("−$1.0M vs last year")).toBeTruthy();
    unmount();

    render(
      <SeasonRecap view={recapView(firstSeason())} open onClose={() => {}} />,
    );
    walk(5);
    expect(screen.getByText("$5.0M")).toBeTruthy();
    expect(screen.queryByText(/vs last year/)).toBeNull();
  });

  it("is one static summary card under reduced motion", () => {
    mockMotion(true);
    const onClose = vi.fn();
    render(<SeasonRecap view={recapView()} open onClose={onClose} />);
    expect(heading().textContent).toContain("Season recap");
    expect(screen.getByText("2027 season")).toBeTruthy();
    const body = screen.getByRole("dialog").textContent ?? "";
    expect(body).toContain("50–32 · Lost in the second round");
    expect(body).toContain("Best player: Ann Able");
    expect(body).toContain("Net income $12.0M (+$1.2M vs last year)");
    expect(body).toContain("Competitive Up · Financial Flat · Brand Down");
    expect(screen.queryByRole("button", { name: /^Skip all/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SeasonRecapPanel", () => {
  it("shows the facts and opens the recap only on replay", () => {
    render(<SeasonRecapPanel saveId="save_1" view={recapView()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Most Valuable Player: Ann Able")).toBeTruthy();
    expect(
      screen.getByText("W 112–98 @ SAO · Nov 3 · Playoffs · 2OT"),
    ).toBeTruthy();
    expect(screen.getByText("▲")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Replay 2027 recap/ }));
    expect(screen.getByRole("dialog", { name: "Season recap" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not auto-open", () => {
    render(<SeasonRecapPanel saveId="save_1" view={recapView()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DashboardMoments queue with the recap", () => {
  const awards = {
    seasonYear: 2027,
    awards: [
      {
        awardId: "mvp",
        displayName: "Most Valuable Player",
        subjectType: "coach",
        finalists: [],
        winner: {
          subjectId: "c1",
          subjectType: "coach",
          name: "Coach One",
          teamId: "team_2",
          teamAbbreviation: "BOS",
          rankLabel: "1",
          isUserTeam: false,
          portrait: null,
          teamName: "Boston Hounds",
          statLine: "",
          tieBreak: false,
        },
        userWon: false,
      },
    ],
    userWinners: 0,
    isCurrent: true,
  } as unknown as AwardsNightView;
  const champion: ChampionMomentView = {
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
  const progression: ProgressionRevealView = {
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
  const moments: DashboardMomentsView = {
    teamId: "team_1",
    awards,
    champion,
    progression,
    recap: recapView(),
  };

  it("shows awards, champion, recap, then progression", () => {
    render(<DashboardMoments saveId="save_1" moments={moments} />);
    const order = [
      "Awards night",
      "Championship",
      "Season recap",
      "Progression reveal",
    ];
    for (const name of order) {
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.getByRole("dialog", { name })).toBeTruthy();
      const button = screen.queryByRole("button", { name: /^Skip all/ });
      fireEvent.click(button ?? screen.getByRole("button", { name: /^Done/ }));
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the recap first when it is the only moment, once", () => {
    const only = {
      ...moments,
      awards: null,
      champion: null,
      progression: null,
    };
    const first = render(<DashboardMoments saveId="save_1" moments={only} />);
    expect(screen.getByRole("dialog", { name: "Season recap" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    first.unmount();
    render(<DashboardMoments saveId="save_1" moments={only} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets progression open when there is no recap", () => {
    render(
      <DashboardMoments
        saveId="save_1"
        moments={{ ...moments, awards: null, champion: null, recap: null }}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Progression reveal" }),
    ).toBeTruthy();
  });
});
