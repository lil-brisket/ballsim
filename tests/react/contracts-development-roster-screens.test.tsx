import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/team/contracts",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/application/actions", () => ({
  releasePlayerAction: vi.fn(),
  offerContractExtensionAction: vi.fn(),
  exerciseTeamOptionAction: vi.fn(),
  declineTeamOptionAction: vi.fn(),
  setDevelopmentFocusesAction: vi.fn(),
  toggleTradeBlockAction: vi.fn(),
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
  acceptOwnerDecisionAction: vi.fn(),
  askAiOwnerDecisionAction: vi.fn(),
  declineOwnerDecisionAction: vi.fn(),
  acknowledgeNarrativeSituationAction: vi.fn(),
  resolveNarrativeSituationAction: vi.fn(),
}));

import {
  buildOffseasonFixture,
  OFFSEASON_FIXTURE_PHASES,
  type OffseasonFixturePhase,
} from "../offseason/driver";
import { rosterBoundsForPhase } from "../offseason/invariants";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { ContractHubHeader } from "@/components/contracts/ContractHubHeader";
import { ContractOverview } from "@/components/contracts/ContractOverview";
import { ContractRow } from "@/components/contracts/ContractRow";
import { ExpiringDeals } from "@/components/contracts/ExpiringDeals";
import { SkillRatingsTable } from "@/components/development/SkillRatingsTable";
import { TrainingCamps } from "@/components/development/TrainingCamps";
import { RosterPage } from "@/components/roster/RosterPage";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { toContractHubView } from "@/state/contract-hub-selectors";
import { toDevelopmentHubView } from "@/state/development-hub-selectors";
import { toRosterPageView } from "@/state/roster-page-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import type { GameState } from "@/state/game-state";
import { checkContractExtensionWindow } from "@/systems/league-rules/contract-rules";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import {
  getContractSigningYear,
  getTeamCapSpace,
  getTeamPayroll,
} from "@/systems/salary-cap";
import type { SkillRatingsRow } from "@/state/development-plan-selectors";

const EXTENSION_PHASES: ReadonlySet<string> = new Set([
  "offseason.roster_decisions",
  "preseason.preparation",
  "regular",
]);

const states = new Map<OffseasonFixturePhase, GameState>();

beforeAll(() => {
  for (const phase of OFFSEASON_FIXTURE_PHASES) {
    states.set(
      phase,
      buildOffseasonFixture({ seed: 42, phase, management: "manual" }).state,
    );
  }
});

afterEach(cleanup);
afterAll(() => states.clear());

function stateAt(phase: OffseasonFixturePhase): GameState {
  return states.get(phase)!;
}

/**
 * Elements styled as a primary button. Selected segmented-control pills
 * (aria-pressed) show state rather than act, so they are left out unless
 * `includeToggles` is set.
 */
function primaryCount(root: ParentNode, includeToggles = false): number {
  return Array.from(root.querySelectorAll<HTMLElement>("[class]")).filter(
    (el) => {
      const cls = el.getAttribute("class") ?? "";
      if (!includeToggles && el.hasAttribute("aria-pressed")) return false;
      return (
        /(^|\s)bg-team(\s|$)/.test(cls) && /(^|\s)text-on-team(\s|$)/.test(cls)
      );
    },
  ).length;
}

function tickerValue(root: HTMLElement, label: string): string {
  const dt = within(root).getByText(label, { selector: "dt" });
  return dt.parentElement!.querySelector("dd")!.textContent ?? "";
}

function inTable(node: React.ReactNode) {
  return (
    <EntityDrawerProvider saveId="save_test">
      <table>
        <tbody>{node}</tbody>
      </table>
    </EntityDrawerProvider>
  );
}

function withDrawer(node: React.ReactNode) {
  return <EntityDrawerProvider saveId="save_test">{node}</EntityDrawerProvider>;
}

const phases = [...OFFSEASON_FIXTURE_PHASES];

describe("contracts screen", () => {
  it.each(phases)("%s: header, overview and rows render", (phase) => {
    const state = stateAt(phase);
    const view = toContractHubView(state);
    expect(view.rows.length).toBeGreaterThan(0);

    const header = render(withDrawer(<ContractHubHeader view={view} />));
    expect(header.container.textContent).toContain(view.teamName);
    expect(header.container.textContent).toContain(`Season ${view.seasonYear}`);
    expect(primaryCount(header.container)).toBeLessThanOrEqual(1);
    header.unmount();

    const overview = render(
      withDrawer(
        <ContractOverview saveId="save_test" overview={view.overview} />,
      ),
    );
    expect(overview.container.textContent).toContain("Players under contract");
    expect(overview.container.textContent).toContain(
      formatMoney(view.overview.totalPayroll),
    );
    expect(primaryCount(overview.container)).toBeLessThanOrEqual(1);
    overview.unmount();

    for (const row of view.rows) {
      const { container, unmount } = render(
        inTable(<ContractRow saveId="save_test" row={row} returnPath="/x" />),
      );
      expect(container.textContent).toContain(row.playerName);
      expect(container.textContent).toContain(`${row.expirationYear}`);
      expect(primaryCount(container)).toBeLessThanOrEqual(1);
      unmount();
    }
  });

  it.each(phases)("%s: ExpiringDeals lists extendable rows", (phase) => {
    const view = toContractHubView(stateAt(phase));
    const expected = view.rows.filter(
      (r) => r.extension !== null && r.extension.seasonsLeft <= 1,
    );
    const { container } = render(
      withDrawer(
        <ExpiringDeals saveId="save_test" rows={view.rows} returnPath="/x" />,
      ),
    );
    if (expected.length === 0) {
      expect(container.textContent).toBe("");
    } else {
      expect(container.textContent).toContain("Expiring deals");
      for (const r of expected) {
        expect(container.textContent).toContain(r.playerName);
      }
      expect(screen.getAllByRole("button", { name: "Extend" })).toHaveLength(
        expected.length,
      );
    }
    expect(primaryCount(container)).toBeLessThanOrEqual(1);
  });

  it.each(phases)("%s: extension gate follows the window", (phase) => {
    const state = stateAt(phase);
    const view = toContractHubView(state);
    const teamId = getActiveOwnerTeamId(state);
    const windowOpen = EXTENSION_PHASES.has(phase);
    // The rule itself agrees with the documented phases.
    const rule = checkContractExtensionWindow(
      state,
      view.rows[0]!.playerId as never,
      teamId,
    );
    expect(rule.allowed).toBe(windowOpen);

    const withExtension = view.rows.filter((r) => r.extension !== null);
    for (const row of withExtension) {
      const ext = row.extension!;
      if (!windowOpen) {
        expect(
          ext.blockedReason,
          `${row.playerName} in ${phase}`,
        ).not.toBeNull();
      } else {
        expect(ext.blockedReason ?? "").not.toMatch(
          /postseason|window|open in/i,
        );
      }
    }
    if (phase === "offseason.roster_decisions") {
      expect(withExtension.length).toBeGreaterThan(0);
    }

    const row = withExtension[0];
    if (row === undefined) return;
    const { container } = render(
      inTable(<ContractRow saveId="save_test" row={row} returnPath="/x" />),
    );
    fireEvent.click(screen.getByRole("button", { name: "Extend" }));
    const submit = screen.getByRole("button", {
      name: "Offer extension",
    }) as HTMLButtonElement;
    if (row.extension!.blockedReason !== null) {
      expect(submit.disabled).toBe(true);
      expect(screen.getByRole("alert").textContent).toBe(
        row.extension!.blockedReason,
      );
    } else {
      expect(submit.disabled).toBe(false);
    }
    expect(primaryCount(document.body)).toBeLessThanOrEqual(1);
    expect(container).toBeTruthy();
  });

  it.each(phases)("%s: release gate follows the window", (phase) => {
    const view = toContractHubView(stateAt(phase));
    const releasable = view.rows.filter((r) => r.release !== null);
    expect(releasable.length).toBeGreaterThan(0);
    const closed = phase === "offseason.season_transition";
    for (const row of releasable) {
      if (closed) {
        expect(row.release!.blockedReason, row.playerName).not.toBeNull();
      } else {
        expect(row.release!.blockedReason, row.playerName).toBeNull();
      }
    }
    const row = releasable[0]!;
    render(
      inTable(<ContractRow saveId="save_test" row={row} returnPath="/x" />),
    );
    fireEvent.click(screen.getByRole("button", { name: /^(Release|Waive)/ }));
    const submit = screen
      .getAllByRole("button")
      .filter((b) => (b as HTMLButtonElement).type === "submit");
    expect(submit.length).toBeGreaterThan(0);
    for (const b of submit) {
      expect((b as HTMLButtonElement).disabled).toBe(closed);
    }
    expect(primaryCount(document.body)).toBeLessThanOrEqual(1);
  });
});

function syntheticRating(
  overrides: Partial<SkillRatingsRow> & { playerId: string },
): SkillRatingsRow {
  return {
    portrait: null,
    playerName: "Test Player",
    position: "PG",
    age: 24,
    overall: 70,
    overallDelta: null,
    potential: 75,
    onDevelopmentLeague: false,
    focus: "balanced",
    injury: null,
    skills: [
      { focus: "shooting", label: "Shooting", rating: 70, delta: 3 },
      { focus: "finishing", label: "Finishing", rating: 65, delta: -2 },
    ],
    ...overrides,
  };
}

describe("development screen", () => {
  it.each(phases)("%s: training camps render", (phase) => {
    const state = stateAt(phase);
    const view = toDevelopmentHubView(state);
    const roster = state.world.teams[getActiveOwnerTeamId(state)]!.roster;
    // Camps cover the whole roster; there is no age cap.
    expect(view.plans.rows.length).toBe(roster.length);

    const camps = render(
      withDrawer(
        <TrainingCamps saveId="save_test" returnPath="/x" plans={view.plans} />,
      ),
    );
    expect(camps.container.textContent).toContain("Training camps");
    expect(camps.container.textContent).toContain(
      `${view.plans.booked} / ${view.plans.slots}`,
    );
    for (const camp of view.plans.camps) {
      expect(camps.container.textContent).toContain(camp.label);
    }
    expect(screen.getAllByRole("combobox")).toHaveLength(
      view.plans.rows.length,
    );
    for (const row of view.plans.rows) {
      const select = camps.container.querySelector(
        `select[name="camp:${row.playerId}"]`,
      );
      expect(select).not.toBeNull();
    }
    expect(screen.getAllByRole("button", { name: "Save camps" })).toHaveLength(
      1,
    );
    expect(primaryCount(camps.container)).toBeLessThanOrEqual(1);
  });

  it.each(phases)("%s: skill ratings render", (phase) => {
    const view = toDevelopmentHubView(stateAt(phase));
    expect(view.ratings.length).toBe(view.plans.rows.length);
    const { container } = render(
      withDrawer(<SkillRatingsTable saveId="save_test" rows={view.ratings} />),
    );
    for (const header of ["Shooting", "Basketball IQ", "POT"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeTruthy();
    }
    for (const row of view.ratings) {
      expect(container.textContent).toContain(row.playerName);
    }
    expect(primaryCount(container)).toBeLessThanOrEqual(1);
  });

  it("colours improved, declined and injured ratings", () => {
    const rows = [
      syntheticRating({ playerId: "p_healthy", playerName: "Healthy Guy" }),
      syntheticRating({
        playerId: "p_hurt",
        playerName: "Hurt Guy",
        injury: { label: "Sprained Ankle" },
      }),
    ];
    render(withDrawer(<SkillRatingsTable saveId="save_test" rows={rows} />));
    const [healthy, hurt] = screen.getAllByRole("row").slice(1);
    const gain = within(healthy!).getByText("+3");
    expect(gain.className).toContain("text-emerald-300");
    const drop = within(healthy!).getByText("−2");
    expect(drop.className).toContain("text-rose-300");
    expect(within(hurt!).getByText("−2").className).toContain(
      "text-orange-300",
    );
    expect(within(hurt!).getByText("+3").className).toContain(
      "text-emerald-300",
    );
    expect(within(hurt!).getByText("Injured · Sprained Ankle")).toBeTruthy();
  });
});

describe("roster screen", () => {
  it.each(phases)("%s: renders with roster count and bounds", (phase) => {
    const state = stateAt(phase);
    const teamId = getActiveOwnerTeamId(state);
    const view = toRosterPageView(state);
    const { container } = render(withDrawer(<RosterPage view={view} />));
    expect(container.textContent).toContain("Roster Management");
    expect(container.textContent).toContain(view.team.name);
    expect(primaryCount(container)).toBeLessThanOrEqual(1);

    const summary = screen.getByLabelText("Roster summary", {
      selector: "dl",
    });
    const count = state.world.teams[teamId]!.roster.length;
    expect(view.roster.length).toBe(count);
    // Only the 15-man max is shown; the 8-man minimum is not surfaced.
    expect(tickerValue(summary, "Roster")).toBe(`${count} / 15`);
    const bounds = rosterBoundsForPhase(phase);
    expect(count).toBeGreaterThanOrEqual(bounds.min);
    expect(count).toBeLessThanOrEqual(bounds.max);
  });

  // Regression: in the offseason both surfaces showed payroll and cap space
  // for the season just played, while free agency and extensions are judged
  // against the coming one (e.g. free agency: shown $49.0M, next season
  // $56.4M). They now show the season contracts are signed for.
  for (const phase of phases) {
    it(`${phase}: payroll and cap space match the cap system on both surfaces`, () => {
      const state = stateAt(phase);
      const teamId = getActiveOwnerTeamId(state);
      const year = getContractSigningYear(state);
      const payroll = formatMoney(getTeamPayroll(teamId, year, state));
      const capSpace = formatMoney(getTeamCapSpace(teamId, year, state));

      const roster = render(
        withDrawer(<RosterPage view={toRosterPageView(state)} />),
      );
      const summary = screen.getByLabelText("Roster summary", {
        selector: "dl",
      });
      expect(tickerValue(summary, "Payroll"), "roster payroll").toBe(payroll);
      expect(tickerValue(summary, "Cap Space"), "roster cap").toBe(capSpace);
      roster.unmount();

      const header = render(
        withDrawer(<ContractHubHeader view={toContractHubView(state)} />),
      );
      const ticker = header.container.querySelector("dl") as HTMLElement;
      expect(tickerValue(ticker, "Payroll"), "contracts payroll").toBe(payroll);
      expect(tickerValue(ticker, "Cap space"), "contracts cap").toBe(capSpace);
    });
  }

  it.each(phases)("%s: both surfaces agree with each other", (phase) => {
    const state = stateAt(phase);
    const roster = toRosterPageView(state);
    const hub = toContractHubView(state);
    expect(roster.summary.payroll).toBe(hub.playerPayroll);
    expect(roster.summary.capSpace).toBe(hub.capSpace);
  });

  // The contracts page counts every player under contract, Development
  // League players included; the roster page counts the top-league roster.
  it.each(phases)(
    "%s: extra contract rows are Development League players",
    (phase) => {
      const state = stateAt(phase);
      const teamId = getActiveOwnerTeamId(state);
      const hub = toContractHubView(state);
      const count = state.world.teams[teamId]!.roster.length;
      const dlRows = hub.rows.filter((r) =>
        isPlayerDlAssigned(state.world.players[r.playerId]),
      ).length;
      expect(hub.overview.playerCount).toBe(count + dlRows);
      if (phase === "preseason.preparation" || phase === "regular") {
        expect(dlRows).toBeGreaterThan(0);
      }
    },
  );
});
