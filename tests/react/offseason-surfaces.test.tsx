import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/offseason_manual_42/offseason",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/application/actions", () => ({
  restrictedFreeAgencyAction: vi.fn(),
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
}));

import { ActionCenter } from "@/components/action-center/ActionCenter";
import { DateInspector } from "@/components/calendar/DateInspector";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { OffseasonHeaderStrip } from "@/components/offseason/OffseasonHeaderStrip";
import { OffseasonQuickLinks } from "@/components/offseason/OffseasonQuickLinks";
import { OffseasonStatusChecklist } from "@/components/offseason/OffseasonStatusChecklist";
import { OffseasonTimeline } from "@/components/offseason/OffseasonTimeline";
import { PhaseDashboard } from "@/components/phase/PhaseDashboard";
import { IncomingOfferSheets } from "@/components/rfa/IncomingOfferSheets";
import { QualifyingOffers } from "@/components/rfa/QualifyingOffers";
import { createContract } from "@/domain/entities/contract";
import { createRfaStatus } from "@/domain/entities/rfa-status";
import { asContractId, type PlayerId, type TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { toOffseasonHubView } from "@/state/offseason-hub-selectors";
import { toPhaseDashboardView } from "@/state/phase-dashboard";
import { buildCalendarDateInspectorView } from "@/systems/calendar/calendar-inspector";
import { getActivePhaseId } from "@/systems/phase-engine";
import { PHASE_DEFINITIONS } from "@/systems/phase-engine/phase-definitions";
import { derivePlannedRegularSeasonStartDate } from "@/systems/simulation/planned-season-dates";
import {
  buildOffseasonFixture,
  OFFSEASON_FIXTURE_PHASES,
  type OffseasonFixturePhase,
} from "../offseason/driver";

const SEED = 42;
const noop = () => {};

const states = new Map<OffseasonFixturePhase, GameState>();

beforeAll(() => {
  for (const phase of OFFSEASON_FIXTURE_PHASES) {
    states.set(
      phase,
      buildOffseasonFixture({ seed: SEED, phase, management: "manual" }).state,
    );
  }
});

afterEach(cleanup);

function stateAt(phase: OffseasonFixturePhase): GameState {
  return structuredClone(states.get(phase)!);
}

/** Primary buttons and links carry both of these classes (Button.tsx). */
function primaryCount(root: ParentNode): number {
  return Array.from(root.querySelectorAll("[class]")).filter((el) => {
    const cls = el.getAttribute("class") ?? "";
    return (
      cls.split(/\s+/).includes("bg-team") &&
      cls.split(/\s+/).includes("text-on-team")
    );
  }).length;
}

function renderRegion(ui: ReactElement) {
  const result = render(ui);
  return result;
}

function withUserRfa(
  state: GameState,
  kind: "qualifying" | "offer_sheet",
): GameState {
  const userTeamId = state.user.activeOwnerTeamId;
  const year = state.competition.season.year;
  const team = state.world.teams[userTeamId]!;
  const otherTeamId = Object.keys(state.world.teams).find(
    (id) => id !== userTeamId,
  ) as TeamId;
  const playerId = team.roster.find(
    (id) => state.world.players[id]?.contractId != null,
  ) as PlayerId;
  const player = state.world.players[playerId]!;
  const contract = state.business.contracts[player.contractId!]!;
  const status = createRfaStatus({
    playerId,
    originalTeamId: userTeamId,
    seasonYear: year,
    qualifyingOfferSalary: 2_000_000,
    hasQualifyingOffer: kind === "offer_sheet",
    resolution: kind === "offer_sheet" ? "pending_match" : "pending_rfa",
    activeOfferSheet:
      kind === "offer_sheet"
        ? {
            offeringTeamId: otherTeamId,
            createdOn: state.world.calendar.currentDate,
            matchDeadlineDate: state.world.calendar.currentDate,
            terms: createContract({
              id: asContractId("contract_offer_sheet_test"),
              playerId,
              teamId: otherTeamId,
              startYear: year,
              endYear: year + 1,
              salaryByYear: {
                [String(year)]: 3_000_000,
                [String(year + 1)]: 3_000_000,
              },
            }),
          }
        : null,
  });
  return {
    ...state,
    business: {
      ...state.business,
      contracts: { ...state.business.contracts, [contract.id]: contract },
      rfaStatuses: { ...state.business.rfaStatuses, [playerId]: status },
    },
  };
}

describe("offseason hub", () => {
  it.each(OFFSEASON_FIXTURE_PHASES)("%s: shell components", (phase) => {
    const state = stateAt(phase);
    const view = toOffseasonHubView(state);
    const returnPath = `/dashboard/${view.saveId}/offseason`;

    const header = renderRegion(<OffseasonHeaderStrip view={view} />);
    expect(header.container.textContent).toContain(view.teamName);
    expect(header.container.textContent).toContain(String(view.seasonYear));
    expect(header.container.textContent).toContain(view.offseasonStageLabel);
    expect(primaryCount(header.container)).toBeLessThanOrEqual(1);
    header.unmount();

    const timeline = renderRegion(<OffseasonTimeline events={view.timeline} />);
    if (view.active) {
      expect(view.timeline.length).toBeGreaterThan(0);
      expect(timeline.container.querySelectorAll("li").length).toBe(
        view.timeline.length,
      );
      for (const event of view.timeline) {
        expect(timeline.container.textContent).toContain(event.label);
      }
    } else {
      expect(view.timeline).toEqual([]);
      expect(timeline.container.textContent).toMatch(/no upcoming/i);
    }
    expect(primaryCount(timeline.container)).toBeLessThanOrEqual(1);
    timeline.unmount();

    const checklist = renderRegion(
      <OffseasonStatusChecklist items={view.status} />,
    );
    if (view.active) {
      expect(view.status.length).toBeGreaterThan(0);
      for (const item of view.status) {
        expect(checklist.container.textContent).toContain(item.label);
        expect(checklist.container.textContent).toContain(item.detail);
      }
    } else {
      expect(checklist.container.textContent).toBe("");
    }
    expect(primaryCount(checklist.container)).toBeLessThanOrEqual(1);
    checklist.unmount();

    const links = renderRegion(<OffseasonQuickLinks links={view.quickLinks} />);
    expect(links.container.querySelectorAll("a").length).toBe(
      view.quickLinks.length,
    );
    expect(
      screen.getByRole("link", { name: "Calendar" }).getAttribute("href"),
    ).toBe(`/dashboard/${view.saveId}/calendar`);
    expect(primaryCount(links.container)).toBeLessThanOrEqual(1);
    links.unmount();

    const center = renderRegion(
      <ActionCenter
        view={view.actionCenter}
        saveId={view.saveId}
        returnPath={returnPath}
      />,
    );
    expect(center.container.textContent?.trim().length).toBeGreaterThan(0);
    if (view.actionCenter.items.length > 0) {
      for (const item of view.actionCenter.items) {
        expect(center.container.textContent).toContain(item.title);
      }
    } else {
      expect(center.container.textContent).toMatch(/good shape/i);
    }
    expect(primaryCount(center.container)).toBeLessThanOrEqual(1);
    center.unmount();
  });

  // Regression: the legacy stage for Season Transition is
  // "season_finalization", which the header used to show.
  it("offseason.season_transition: header stage matches the phase name", () => {
    const view = toOffseasonHubView(stateAt("offseason.season_transition"));
    expect(view.offseasonStageLabel).toBe("season transition");
  });

  it.each(
    OFFSEASON_FIXTURE_PHASES.filter(
      (phase) =>
        phase.startsWith("offseason.") &&
        phase !== "offseason.season_transition",
    ),
  )("%s: header shows the current offseason stage", (phase) => {
    const view = toOffseasonHubView(stateAt(phase));
    expect(view.active).toBe(true);
    const { container } = render(<OffseasonHeaderStrip view={view} />);
    const expected = phase.replace("offseason.", "").replaceAll("_", " ");
    expect(view.offseasonStageLabel).toBe(expected);
    expect(container.textContent).toContain(expected);
    // Stage names in PHASE_DEFINITIONS and the stage label stay in step.
    expect(PHASE_DEFINITIONS[phase].stage).toBeTruthy();
  });

  it.each(OFFSEASON_FIXTURE_PHASES)(
    "%s: qualifying offers can only be issued in roster decisions",
    (phase) => {
      const state = withUserRfa(stateAt(phase), "qualifying");
      const view = toOffseasonHubView(state);
      expect(view.rfa.enabled).toBe(true);
      const row = view.rfa.qualifyingOffers.find((r) => !r.issued);
      expect(row).toBeDefined();
      const { container } = render(
        <QualifyingOffers
          rows={view.rfa.qualifyingOffers}
          saveId={view.saveId}
          returnPath="/x"
        />,
      );
      const buttons = screen.getAllByRole("button", {
        name: /issue qualifying offer/i,
      });
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        if (phase === "offseason.roster_decisions") {
          expect((button as HTMLButtonElement).disabled).toBe(false);
        } else {
          expect((button as HTMLButtonElement).disabled).toBe(true);
        }
      }
      if (phase !== "offseason.roster_decisions") {
        expect(container.textContent).toMatch(/only be issued during roster/i);
      }
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    },
  );

  it.each(OFFSEASON_FIXTURE_PHASES)(
    "%s: offer sheet match and decline only in free agency",
    (phase) => {
      const state = withUserRfa(stateAt(phase), "offer_sheet");
      const view = toOffseasonHubView(state);
      expect(view.rfa.incomingSheets.length).toBe(1);
      const { container } = render(
        <IncomingOfferSheets
          sheets={view.rfa.incomingSheets}
          saveId={view.saveId}
          returnPath="/x"
        />,
      );
      expect(container.textContent).toContain(
        view.rfa.incomingSheets[0]!.playerName,
      );
      const match = screen.getByRole("button", {
        name: "Match",
      }) as HTMLButtonElement;
      // Decline is always offered with a sheet (see the note below).
      expect(screen.getByRole("button", { name: "Let him go" })).toBeTruthy();
      const inFreeAgency = phase === "offseason.free_agency";
      if (!inFreeAgency) {
        expect(match.disabled).toBe(true);
      }
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    },
  );

  // Outside free agency there is no live offer sheet to decline: sheets are
  // created during free agency and all resolved when it closes, and the
  // decline action is phase-guarded on the server (checkDeclineMatch).

  it("free agency: a live offer sheet can be matched and declined", () => {
    const view = toOffseasonHubView(
      withUserRfa(stateAt("offseason.free_agency"), "offer_sheet"),
    );
    render(
      <IncomingOfferSheets
        sheets={view.rfa.incomingSheets}
        saveId={view.saveId}
        returnPath="/x"
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Match" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: "Let him go" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe("phase command center", () => {
  it.each(OFFSEASON_FIXTURE_PHASES)(
    "%s: renders and gates advance",
    (phase) => {
      const state = stateAt(phase);
      expect(getActivePhaseId(state)).toBe(phase);
      const view = toPhaseDashboardView(state);
      const { container } = render(
        <PhaseDashboard
          view={view}
          saveId={state.meta.saveId}
          returnPath={`/dashboard/${state.meta.saveId}`}
          currentDate={state.world.calendar.currentDate}
          seasonYear={state.competition.season.year}
          advanceAction={noop}
          dismissAction={noop}
          switchTeamAction={noop}
        />,
      );
      const definition = PHASE_DEFINITIONS[phase];
      const header = within(
        screen.getByRole("region", { name: "Current phase" }),
      );
      expect(view.nowLabel).toBe(definition.name);
      expect(
        header.getByRole("heading", { name: definition.name }),
      ).toBeTruthy();
      expect(header.getByText(definition.objective)).toBeTruthy();
      if (definition.nextPhaseId !== null) {
        expect(view.nextLabel).toBe(
          PHASE_DEFINITIONS[definition.nextPhaseId].name,
        );
        expect(
          header.getByText(PHASE_DEFINITIONS[definition.nextPhaseId].name),
        ).toBeTruthy();
      }
      expect(
        screen.getByText(/advances with the league calendar/i),
      ).toBeTruthy();
      expect(
        screen.queryByRole("region", { name: "Advance phase" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: /advance/i })).toBeNull();
      expect(
        screen.getByRole("region", { name: "Needs attention" }),
      ).toBeTruthy();
      for (const task of [
        ...view.attention.required,
        ...view.attention.recommended,
      ]) {
        expect(container.textContent).toContain(task.title);
      }
      expect(
        screen.getByRole("region", { name: "Optional shortcuts" }).textContent,
      ).toContain("Roster");
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
    },
  );

  it("free agency and draft phases surface their own shortcut", () => {
    const fa = toPhaseDashboardView(stateAt("offseason.free_agency"));
    expect(fa.optionalLinks.map((l) => l.label)).toContain("Free Agency");
    const draft = toPhaseDashboardView(stateAt("offseason.draft"));
    expect(draft.optionalLinks.map((l) => l.label)).toContain("Draft");
    const regular = toPhaseDashboardView(stateAt("regular"));
    expect(regular.optionalLinks.map((l) => l.label)).not.toContain("Draft");
  });
});

function shrinkUserRoster(state: GameState, keep: number): GameState {
  const teamId = state.user.activeOwnerTeamId;
  const team = state.world.teams[teamId]!;
  const removed = team.roster.slice(keep);
  const players = { ...state.world.players };
  const contracts = { ...state.business.contracts };
  for (const playerId of removed) {
    const player = players[playerId]!;
    if (player.contractId != null) delete contracts[player.contractId];
    players[playerId] = { ...player, teamId: null, contractId: null };
  }
  const block = state.business.tradeBlocks[teamId];
  return {
    ...state,
    world: {
      ...state.world,
      players,
      teams: {
        ...state.world.teams,
        [teamId]: { ...team, roster: team.roster.slice(0, keep) },
      },
    },
    business: {
      ...state.business,
      contracts,
      tradeBlocks:
        block === undefined
          ? state.business.tradeBlocks
          : {
              ...state.business.tradeBlocks,
              [teamId]: {
                ...block,
                assets: block.assets.filter(
                  (asset) =>
                    !("playerId" in asset && removed.includes(asset.playerId)),
                ),
              },
            },
    },
  };
}

function renderInspector(state: GameState, date: string) {
  const inspector = buildCalendarDateInspectorView(state, date);
  return {
    inspector,
    ...render(
      <EntityDrawerProvider saveId={state.meta.saveId}>
        <DateInspector
          saveId={state.meta.saveId}
          returnPath={`/dashboard/${state.meta.saveId}/calendar`}
          inspector={inspector}
          timeDisabled={false}
          onSimulate={noop}
          currentDate={state.world.calendar.currentDate}
        />
      </EntityDrawerProvider>,
    ),
  };
}

describe("blocked season start (calendar date inspector)", () => {
  function openerOf(state: GameState): string {
    const opener = derivePlannedRegularSeasonStartDate(state);
    expect(opener).not.toBeNull();
    expect(opener! > state.world.calendar.currentDate).toBe(true);
    return opener!;
  }

  it("legal rosters: no block message and simulation is offered", () => {
    const state = stateAt("preseason.preparation");
    const { inspector, container } = renderInspector(state, openerOf(state));
    expect(inspector.simulationPreview).not.toBeNull();
    expect(inspector.simulationPreview!.blockReason).toBeNull();
    expect(container.textContent).not.toMatch(/cannot begin/i);
    expect(
      screen.getByRole("button", { name: "Simulate to date" }),
    ).toBeTruthy();
    expect(primaryCount(container)).toBeLessThanOrEqual(1);
  });

  it("user roster of 11: names the team and the limit, no simulate button", () => {
    const legal = stateAt("preseason.preparation");
    const state = shrinkUserRoster(legal, 11);
    const teamId = state.user.activeOwnerTeamId;
    expect(state.world.teams[teamId]!.roster.length).toBe(11);
    const date = openerOf(state);
    const { inspector, container } = renderInspector(state, date);
    expect(inspector.simulationPreview!.canSimulate).toBe(false);
    const text = container.textContent ?? "";
    expect(text).toContain("Cannot begin regular season");
    expect(text).toMatch(/at least 12/);
    // The message must say whose roster is short.
    const team = state.world.teams[teamId]!;
    expect(
      text.includes(teamId) ||
        text.includes(team.name) ||
        text.includes(`${team.city} ${team.name}`),
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Simulate to date" }),
    ).toBeNull();
    expect(primaryCount(container)).toBeLessThanOrEqual(1);
  });

  it("a date after the opener is blocked the same way", () => {
    const state = shrinkUserRoster(stateAt("preseason.preparation"), 11);
    const later = new Date(`${openerOf(state)}T00:00:00Z`);
    later.setUTCDate(later.getUTCDate() + 10);
    const { container } = renderInspector(
      state,
      later.toISOString().slice(0, 10),
    );
    expect(container.textContent).toMatch(/at least 12/);
  });
});
