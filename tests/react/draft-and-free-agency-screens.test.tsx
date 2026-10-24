/**
 * Smoke tests for the draft, lottery and free agency screens with REAL
 * fixture state: a real CBL league parked at every offseason phase, run
 * through the page selectors, rendered with the page's client components.
 * (The route pages are async server components and are not rendered.)
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/test",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/application/actions", () => ({
  addDraftBoardAction: vi.fn(),
  assignToDevelopmentLeagueAction: vi.fn(),
  draftProspectAction: vi.fn(),
  finishFreeAgencyAction: vi.fn(),
  makeFreeAgentOfferAction: vi.fn(),
  removeDraftBoardAction: vi.fn(),
  resolveDraftClassDecisionAction: vi.fn(),
  restrictedFreeAgencyAction: vi.fn(),
  signFreeAgentAction: vi.fn(),
  toggleDraftBoardPriorityAction: vi.fn(),
  withdrawFreeAgentOfferAction: vi.fn(),
}));

import {
  autoPickForUser,
  buildOffseasonFixture,
  OFFSEASON_FIXTURE_PHASES,
  type OffseasonFixturePhase,
} from "../offseason/driver";
import { DraftBoardPanel } from "@/components/draft/DraftBoardPanel";
import { DraftClassDecisionPanel } from "@/components/draft/DraftClassDecisionPanel";
import { DraftHeaderStrip } from "@/components/draft/DraftHeaderStrip";
import { DraftPickSummary } from "@/components/draft/DraftPickSummary";
import { LotteryNight } from "@/components/draft/LotteryNight";
import { PostDraftDevelopmentReview } from "@/components/draft/PostDraftDevelopmentReview";
import { ProspectCard } from "@/components/draft/ProspectCard";
import { FreeAgentInterest } from "@/components/free-agency/FreeAgentInterest";
import { TaxLineNote } from "@/components/finances/PayrollRulesPanel";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { IncomingOfferSheets } from "@/components/rfa/IncomingOfferSheets";
import { OutgoingOfferSheets } from "@/components/rfa/OutgoingOfferSheets";
import { RfaBadge } from "@/components/rfa/RfaBadge";
import { RfaOfferSheetAction } from "@/components/rfa/RfaOfferSheetAction";
import { draftClassIdFor } from "@/domain/entities/draft";
import { createSeededRng } from "@/domain/rng";
import { toDraftHubView } from "@/state/draft-hub-selectors";
import { toDraftLotteryView } from "@/state/draft-lottery-selectors";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import type { GameState } from "@/state/game-state";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import type { IncomingOfferSheetRow } from "@/state/rfa-selectors";
import { buildPostDraftDlRecommendations } from "@/systems/development-league/recommendations";
import {
  autoResolveGeneratedDraftClass,
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
} from "@/systems/draft";
import {
  canSignFreeAgents,
  checkFreeAgencyOffer,
  checkFreeAgencySigning,
  isFreeAgencyOpen,
} from "@/systems/league-rules/free-agency-rules";
import { getActivePhaseId } from "@/systems/phase-engine";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { toScoutingReportView } from "@/systems/scouting/scouting-reports";

const SEED = 42;
const SAVE_ID = "save_test";

const states = new Map<OffseasonFixturePhase, GameState>();
let preparationResolved: GameState;
let draftOnUserClock: GameState | null = null;
let draftOnOtherClock: GameState | null = null;

function draftOf(state: GameState) {
  return state.world.drafts[
    draftClassIdFor(draftYearForSeason(state.competition.season.year))
  ];
}

/** The page's "awaiting draft class decision" condition (draft/page.tsx). */
function awaitingClassDecision(state: GameState): boolean {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const phase = getActivePhaseId(state);
  return Boolean(
    !draftOf(state) &&
    (phase === "offseason.draft_preparation" || phase === "offseason.draft") &&
    state.user.pendingDraftClassDecisions[String(draftYear)]?.resolved !== true,
  );
}

/** Elements styled as the region's primary button. */
function primaryCount(root: ParentNode): number {
  return Array.from(root.querySelectorAll("[class]")).filter((el) => {
    const cls = el.getAttribute("class") ?? "";
    return (
      /(^|\s)bg-team(\s|$)/.test(cls) && /(^|\s)text-on-team(\s|$)/.test(cls)
    );
  }).length;
}

function boardEntriesFor(state: GameState) {
  const draft = draftOf(state)!;
  const teamState = draft.teamDraftState[state.user.activeOwnerTeamId];
  return (teamState?.board ?? []).map((entry) => {
    const prospect = draft.prospects[entry.prospectPlayerId];
    return {
      prospectPlayerId: entry.prospectPlayerId,
      name: prospect
        ? `${prospect.player.firstName} ${prospect.player.lastName}`
        : entry.prospectPlayerId,
      position: prospect?.player.position ?? "?",
      rank: entry.rank,
      priority: entry.priority,
      notes: entry.notes,
      scoutGrade: null,
    };
  });
}

beforeAll(() => {
  for (const phase of OFFSEASON_FIXTURE_PHASES) {
    states.set(
      phase,
      buildOffseasonFixture({ seed: SEED, phase, management: "manual" }).state,
    );
  }

  const preparation = states.get("offseason.draft_preparation")!;
  const rng = createSeededRng(preparation.meta.rngState);
  preparationResolved = autoResolveGeneratedDraftClass(preparation, rng).state;

  // Draft fixtures: the user on the clock (advancing the engine day by day if
  // the draft opens on another team), then the next team after the user pick.
  let current = states.get("offseason.draft")!;
  const drawRng = createSeededRng(current.meta.rngState);
  for (let day = 0; day < 4 && !isUserOnDraftClock(current); day += 1) {
    current = advanceSimulation(current, drawRng, {
      days: 1,
      gameFidelity: "box_score",
    }).state;
  }
  if (isUserOnDraftClock(current)) {
    draftOnUserClock = structuredClone(current);
    const afterPick = autoPickForUser(current).state;
    if (
      getActiveDraftOnClockSlot(afterPick) !== undefined &&
      !isUserOnDraftClock(afterPick)
    ) {
      draftOnOtherClock = afterPick;
    }
  }
});

afterEach(cleanup);
afterAll(() => {
  states.clear();
});

describe("fixture sanity", () => {
  it.each(OFFSEASON_FIXTURE_PHASES)("%s is parked in its phase", (phase) => {
    expect(getActivePhaseId(states.get(phase)!)).toBe(phase);
  });

  it("has a draft state with the user on the clock and one with another team", () => {
    expect(draftOnUserClock).not.toBeNull();
    expect(draftOnOtherClock).not.toBeNull();
    expect(isUserOnDraftClock(draftOnUserClock!)).toBe(true);
    expect(isUserOnDraftClock(draftOnOtherClock!)).toBe(false);
  });
});

describe("draft screen", () => {
  describe.each(OFFSEASON_FIXTURE_PHASES)("%s", (phase) => {
    it("header strip renders and matches the hub", () => {
      const hub = toDraftHubView(states.get(phase)!);
      const { container } = render(<DraftHeaderStrip view={hub} />);
      const strip = screen.getByLabelText("Draft summary");
      expect(strip.textContent).toContain("Draft year");
      expect(strip.textContent).toContain(String(hub.draftYear));
      expect(strip.textContent).toContain("Your picks");
      expect(strip.textContent?.includes("On the clock")).toBe(hub.userOnClock);
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    });

    it("class decision panel only while the class is unresolved", () => {
      const state = states.get(phase)!;
      const awaiting = awaitingClassDecision(state);
      expect(awaiting).toBe(phase === "offseason.draft_preparation");
      if (!awaiting) return;
      const { container } = render(
        <DraftClassDecisionPanel
          saveId={SAVE_ID}
          draftYear={draftYearForSeason(state.competition.season.year)}
          seasonYear={state.competition.season.year}
          returnPath={`/dashboard/${SAVE_ID}/draft`}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Use Generated Class" }),
      ).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "Import Custom Class" })
          .hasAttribute("disabled"),
      ).toBe(true);
      expect(primaryCount(container)).toBe(1);
    });

    it("pick summary shows the real order only while the board is open", () => {
      const state = states.get(phase)!;
      const hub = toDraftHubView(state);
      const { container } = render(
        <DraftPickSummary saveId={SAVE_ID} picks={hub.picks} />,
      );
      if (phase === "offseason.draft") {
        expect(hub.active).toBe(true);
        expect(hub.picks.length).toBeGreaterThan(0);
        expect(hub.picks).toHaveLength(draftOf(state)!.order.length);
        expect(container.querySelectorAll("tbody tr")).toHaveLength(
          hub.picks.length,
        );
        expect(hub.picks.filter((p) => p.isUserPick).length).toBeGreaterThan(0);
        expect(container.textContent).toContain("(you)");
      } else {
        expect(hub.active).toBe(false);
        expect(hub.picks).toHaveLength(0);
        expect(container.textContent).toContain(
          "No draft picks in the current order.",
        );
        expect(hub.inactiveReason).toBeTruthy();
      }
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    });

    it("prospect cards render real scouting data without true overall", () => {
      const state = states.get(phase)!;
      const hub = toDraftHubView(state);
      expect(hub.prospects.length > 0).toBe(phase === "offseason.draft");
      const draft = draftOf(state);
      for (const prospect of hub.prospects.slice(0, 5)) {
        const full = draft!.prospects[prospect.playerId];
        const { container, unmount } = render(
          <ProspectCard
            saveId={SAVE_ID}
            playerId={prospect.playerId}
            portrait={selectPlayerPortrait(state, prospect.playerId)}
            firstName={prospect.firstName}
            lastName={prospect.lastName}
            position={prospect.position}
            age={full?.player.age}
            nationality={full?.player.nationality}
            scoutGrade={prospect.scoutGrade}
            estimatedOverallMin={prospect.estimatedOverallMin}
            estimatedOverallMax={prospect.estimatedOverallMax}
            confidence={prospect.confidence}
            strengths={toScoutingReportView(
              draft!.teamDraftState[
                state.user.activeOwnerTeamId
              ]?.scouting.find((s) => s.prospectPlayerId === prospect.playerId),
            ).strengths.map((s) => s.label)}
            weaknesses={[]}
            onBoard={false}
          />,
        );
        expect(container.textContent).toContain(prospect.lastName);
        expect(primaryCount(container)).toBeLessThanOrEqual(1);
        unmount();
      }
    });

    it("board panel renders the team's board", () => {
      const state = states.get(phase)!;
      const entries = draftOf(state) ? boardEntriesFor(state) : [];
      const { container } = render(
        <DraftBoardPanel
          saveId={SAVE_ID}
          entries={entries}
          removeAction={vi.fn()}
          togglePriorityAction={vi.fn()}
        />,
      );
      if (entries.length === 0) {
        expect(container.textContent).toContain("No prospects on your board");
      } else {
        expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(
          entries.length,
        );
      }
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    });

    it("only offers a pick when this is the draft and the user is on the clock", () => {
      const hub = toDraftHubView(states.get(phase)!);
      // The Draft button on the page is gated by board.userOnClock.
      expect(hub.canSelect).toBe(hub.board?.userOnClock === true);
      if (phase !== "offseason.draft") {
        expect(hub.canSelect).toBe(false);
        expect(hub.userOnClock).toBe(false);
      }
    });
  });

  describe("class decision resolved", () => {
    it("is no longer awaited once the generated class exists", () => {
      expect(
        awaitingClassDecision(states.get("offseason.draft_preparation")!),
      ).toBe(true);
      expect(awaitingClassDecision(preparationResolved)).toBe(false);
      expect(draftOf(preparationResolved)).toBeDefined();
    });
  });

  describe("on the clock", () => {
    it("user on the clock: hub allows selecting and says so", () => {
      const state = draftOnUserClock!;
      const hub = toDraftHubView(state);
      expect(hub.canSelect).toBe(true);
      expect(hub.userOnClock).toBe(true);
      expect(hub.onClockOverall).not.toBeNull();
      const { container } = render(<DraftHeaderStrip view={hub} />);
      expect(screen.getByLabelText("Draft summary").textContent).toContain(
        `Pick #${hub.onClockOverall}`,
      );
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
      const picks = render(
        <DraftPickSummary saveId={SAVE_ID} picks={hub.picks} />,
      );
      expect(
        hub.picks.find((p) => p.overallPick === hub.onClockOverall)?.isUserPick,
      ).toBe(true);
      expect(primaryCount(picks.container)).toBeLessThanOrEqual(1);
    });

    it("another team on the clock: selecting is not offered", () => {
      const state = draftOnOtherClock!;
      const hub = toDraftHubView(state);
      expect(hub.canSelect).toBe(false);
      expect(hub.userOnClock).toBe(false);
      render(<DraftHeaderStrip view={hub} />);
      expect(screen.getByLabelText("Draft summary").textContent).not.toContain(
        "On the clock",
      );
    });
  });

  describe("after the draft", () => {
    it("post-draft review renders the user's real picks with at most one primary", () => {
      const state = states.get("offseason.free_agency")!;
      const draft = draftOf(state)!;
      expect(draft.status).toBe("complete");
      const teamId = state.user.activeOwnerTeamId;
      const review = buildPostDraftDlRecommendations(
        state,
        teamId,
        draft.pickResults
          .filter((p) => p.teamId === teamId)
          .map((p) => p.playerId),
      );
      const { container } = render(
        <PostDraftDevelopmentReview
          saveId={SAVE_ID}
          returnPath={`/dashboard/${SAVE_ID}/draft`}
          review={review}
        />,
      );
      if (review.totalDrafted === 0) {
        expect(container.textContent).toBe("");
      } else {
        expect(container.textContent).toContain(
          `You drafted ${review.totalDrafted}`,
        );
        expect(container.querySelectorAll("li").length).toBe(
          review.players.length,
        );
      }
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    });
  });
});

describe("lottery night", () => {
  function mockReducedMotion() {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  it.each(OFFSEASON_FIXTURE_PHASES)(
    "%s: the view matches the stored draw and renders",
    (phase) => {
      mockReducedMotion();
      const state = states.get(phase)!;
      const view = toDraftLotteryView(state);
      const lottery = draftOf(state)?.lottery;
      if (!lottery) {
        expect(view).toBeNull();
        return;
      }
      expect(state.settings.draftLottery?.enabled).toBe(true);
      expect(view).not.toBeNull();
      expect(view!.slots.map((s) => s.teamId)).toEqual(lottery.finalOrder);
      expect(view!.slots.map((s) => s.slot)).toEqual(
        lottery.finalOrder.map((_, i) => i + 1),
      );
      expect(new Set(view!.slots.map((s) => s.teamId)).size).toBe(
        view!.slots.length,
      );
      const { container } = render(<LotteryNight view={view!} />);
      // Reduced motion reveals the whole order immediately.
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(view!.slots.length);
      for (const slot of view!.slots) {
        expect(container.textContent).toContain(slot.teamName);
      }
      expect(
        items.filter((li) => li.getAttribute("data-user-team")).length,
      ).toBe(view!.slots.filter((s) => s.isUserTeam).length);
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    },
  );

  it("the lottery ran for the first draft of a new league", () => {
    const view = toDraftLotteryView(states.get("offseason.draft")!);
    expect(view).not.toBeNull();
    const state = states.get("offseason.draft")!;
    const teamIds = new Set(Object.keys(state.world.teams));
    expect(view!.slots.length).toBeGreaterThan(0);
    for (const slot of view!.slots) {
      expect(teamIds.has(slot.teamId)).toBe(true);
    }
    // Round one of the draft follows the lottery order.
    const round1 = draftOf(state)!.order.filter((s) => s.round === 1);
    expect(round1.map((s) => s.overallPick)).toEqual(
      round1.map((_, i) => i + 1),
    );
  });
});

describe("free agency screen", () => {
  const FA_PHASE: OffseasonFixturePhase = "offseason.free_agency";
  const IN_SEASON: readonly OffseasonFixturePhase[] = [
    "preseason.preparation",
    "regular",
  ];

  describe.each(OFFSEASON_FIXTURE_PHASES)("%s", (phase) => {
    const expectedActive = phase === FA_PHASE || IN_SEASON.includes(phase);

    it("hub is active only where signing is allowed", () => {
      const state = states.get(phase)!;
      const hub = toFreeAgencyHubView(state);
      expect(hub.active).toBe(expectedActive);
      expect(hub.inSeason).toBe(IN_SEASON.includes(phase));
      expect(canSignFreeAgents(state)).toBe(expectedActive);
      expect(isFreeAgencyOpen(state)).toBe(phase === FA_PHASE);
      if (expectedActive) {
        expect(hub.inactiveReason).toBeNull();
        expect(hub.market.length).toBeGreaterThan(0);
      } else {
        expect(hub.inactiveReason).toBeTruthy();
      }
    });

    it("rules agree with what the page offers (Sign / Offer / offer sheets)", () => {
      const state = states.get(phase)!;
      const hub = toFreeAgencyHubView(state);
      const agent = hub.market[0];
      // Postseason: the market is empty until contracts expire.
      if (agent === undefined) {
        expect(hub.active).toBe(false);
        return;
      }
      const sign = checkFreeAgencySigning(state, agent.playerId as never);
      const offer = checkFreeAgencyOffer(state, agent.playerId as never);
      const phaseLocked = (v: { violations: { code: string }[] }) =>
        v.violations.some((x) => x.code === "FA_NOT_OPEN");
      // "Sign" is shown by the page when the hub is active.
      expect(phaseLocked(sign)).toBe(!hub.active);
      // "Offer" is shown only when active and not in season.
      expect(phaseLocked(offer)).toBe(!(hub.active && !hub.inSeason));
      // Offer sheets: only in offseason free agency.
      if (hub.active && hub.rfa.enabled && phase !== FA_PHASE) {
        expect(Object.keys(hub.rfaTags)).toHaveLength(0);
      }
    });

    it("tax line note and summary figures render", () => {
      const hub = toFreeAgencyHubView(states.get(phase)!);
      const { container } = render(<TaxLineNote rules={hub.payrollRules} />);
      if (hub.payrollRules.luxuryTaxEnabled && hub.payrollRules.threshold) {
        expect(container.textContent).toContain("Tax line");
      } else {
        expect(container.textContent).toBe("");
      }
      expect(Number.isFinite(hub.playerPayroll)).toBe(true);
      expect(Number.isFinite(hub.capSpace)).toBe(true);
      expect(hub.availableCount).toBe(hub.market.length);
    });

    it("decision panel renders the hub's decisions", () => {
      const hub = toFreeAgencyHubView(states.get(phase)!);
      const { container } = render(
        <ManagementDecisionPanel
          title="Free Agency Decisions"
          items={hub.decisions}
          saveId={SAVE_ID}
          currentDate={hub.currentDate}
        />,
      );
      expect(container.textContent).toContain("Free Agency Decisions");
      expect(container.querySelectorAll("li").length).toBe(
        hub.decisions.length,
      );
      for (const item of hub.decisions) {
        expect(container.textContent).toContain(item.title);
      }
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    });

    it("interest panels render real market data", () => {
      const hub = toFreeAgencyHubView(states.get(phase)!);
      const entries = Object.entries(hub.interest).slice(0, 5);
      if (expectedActive) expect(entries.length).toBeGreaterThan(0);
      for (const [, interest] of entries) {
        const { container, unmount } = render(
          <FreeAgentInterest {...interest} />,
        );
        expect(screen.getByText("Interest")).toBeTruthy();
        expect(container.textContent).toMatch(
          /Would sign for about|Not interested in your team/,
        );
        expect(primaryCount(container)).toBe(0);
        unmount();
      }
    });

    it("RFA components render for the real offer sheets and tags", () => {
      const hub = toFreeAgencyHubView(states.get(phase)!);
      const incoming = render(
        <IncomingOfferSheets
          sheets={hub.rfa.incomingSheets}
          saveId={SAVE_ID}
          returnPath="/x"
        />,
      );
      expect(incoming.container.querySelectorAll("li").length).toBe(
        hub.rfa.incomingSheets.length,
      );
      expect(primaryCount(incoming.container)).toBeLessThanOrEqual(
        hub.rfa.incomingSheets.length,
      );
      incoming.unmount();
      const outgoing = render(
        <OutgoingOfferSheets sheets={hub.rfa.outgoingSheets} />,
      );
      expect(outgoing.container.querySelectorAll("li").length).toBe(
        hub.rfa.outgoingSheets.length,
      );
      outgoing.unmount();
      for (const [playerId, tag] of Object.entries(hub.rfaTags).slice(0, 3)) {
        const badge = render(<RfaBadge tag={tag} />);
        expect(badge.container.textContent).toBe("RFA");
        badge.unmount();
        const action = render(
          <RfaOfferSheetAction
            saveId={SAVE_ID}
            playerId={playerId}
            playerName="Test Player"
            returnPath="/x"
            tag={tag}
          />,
        );
        expect(primaryCount(action.container)).toBe(0);
        action.unmount();
      }
    });
  });

  it("a real free agency fixture has a market with signing allowed", () => {
    const hub = toFreeAgencyHubView(states.get(FA_PHASE)!);
    expect(hub.active).toBe(true);
    expect(hub.inSeason).toBe(false);
    expect(hub.teamName.length).toBeGreaterThan(0);
  });

  it("offer sheet dialog has one primary and opens only on request", () => {
    const tag = {
      originalTeamId: "t1",
      originalTeamName: "Boston Owls",
      qualifyingOfferSalary: 3_000_000,
      pendingMatch: false,
    };
    const { container } = render(
      <RfaOfferSheetAction
        saveId={SAVE_ID}
        playerId="p1"
        playerName="Ada Hill"
        returnPath="/x"
        tag={tag}
      />,
    );
    expect(primaryCount(container)).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Offer sheet" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(primaryCount(document.body)).toBe(1);
  });

  it("a pending sheet replaces the offer sheet button", () => {
    render(
      <RfaOfferSheetAction
        saveId={SAVE_ID}
        playerId="p1"
        playerName="Ada Hill"
        returnPath="/x"
        tag={{
          originalTeamId: "t1",
          originalTeamName: "Boston Owls",
          qualifyingOfferSalary: 3_000_000,
          pendingMatch: true,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Offer sheet" })).toBeNull();
    expect(screen.getByText(/Waiting on Boston Owls/)).toBeTruthy();
  });

  it("incoming sheet: Match is the one primary and is disabled when blocked", () => {
    const sheet: IncomingOfferSheetRow = {
      playerId: "p1",
      playerName: "Ada Hill",
      offeringTeamId: "t2",
      offeringTeamName: "Boston Owls",
      salary: 9_000_000,
      years: 3,
      matchDeadlineDate: "2026-07-10",
      payrollIfMatched: 90_000_000,
      salaryCap: 100_000_000,
      matchBlockedReason: "Roster is full.",
    };
    const { container } = render(
      <IncomingOfferSheets sheets={[sheet]} saveId={SAVE_ID} returnPath="/x" />,
    );
    expect(primaryCount(container)).toBe(1);
    expect(
      screen.getByRole("button", { name: "Match" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Roster is full.");
  });

  it("withdraw offer confirmation has no primary button", () => {
    const { container } = render(
      <ConfirmDialog
        title="Withdraw offer"
        description="Withdraw the open offer."
        confirmLabel="Withdraw"
      >
        <button type="submit" className="bg-red-700">
          Confirm withdraw
        </button>
      </ConfirmDialog>,
    );
    expect(primaryCount(container)).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(primaryCount(document.body)).toBeLessThanOrEqual(1);
  });
});
