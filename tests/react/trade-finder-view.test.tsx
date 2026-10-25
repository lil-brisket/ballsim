import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

const findTradeOffersAction = vi.fn();

vi.mock("@/application/actions", () => ({
  findTradeOffersAction: (...args: unknown[]) => findTradeOffersAction(...args),
  executeTradeOfferAction: vi.fn(),
}));

import { TradeFinderView } from "@/components/roster/TradeFinderView";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";
import type { TradeOfferView } from "@/state/trade-offer-selectors";

const player = (id: string, first: string, overall: number) =>
  ({
    playerId: id,
    firstName: first,
    lastName: "Test",
    position: "PG",
    overall,
    age: 25,
    contractSalary: 5_000_000,
    onTradeBlock: id === "p2",
  }) as unknown as RosterPagePlayerView;

const roster = [
  player("p1", "Ann", 70),
  player("p2", "Bob", 80),
  player("p3", "Cy", 60),
  player("p4", "Di", 50),
];

const picks = [
  {
    kind: "draftPick" as const,
    id: "k1",
    name: "2027 1st",
    viaAbbreviation: "BOS",
  },
];

const offer = (
  abbr: string,
  name: string,
  interest: number,
  interestLevel: TradeOfferView["interestLevel"],
): TradeOfferView =>
  ({
    counterpartyTeamId: `t-${abbr}`,
    counterpartyName: name,
    counterpartyAbbreviation: abbr,
    counterpartyBranding: null,
    interest,
    interestLevel,
    send: [
      {
        kind: "player",
        id: "p1",
        name: "Ann Test",
        position: "PG",
        overall: 70,
        age: 25,
        salary: 5_000_000,
        href: "/dashboard/s1/players/p1",
      },
    ],
    receive: [
      { kind: "draftPick", id: "k9", name: "2028 2nd", viaAbbreviation: null },
    ],
    proposal: {},
  }) as unknown as TradeOfferView;

const offers = [
  offer("AUS", "Austin Owls", 80, "very_interested"),
  offer("BOS", "Boston Bats", 62, "interested"),
  offer("CHI", "Chicago Cubs", 40, "lukewarm"),
];

function renderView(suggested: string | null = null) {
  return render(
    <TradeFinderView
      saveId="s1"
      roster={roster}
      picks={picks}
      suggestedOutgoingPlayerId={suggested}
    />,
  );
}

async function findOffers() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Find offers" }));
  });
}

const item = (name: RegExp) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

describe("TradeFinderView", () => {
  beforeEach(() => findTradeOffersAction.mockReset());
  afterEach(() => cleanup());

  it("caps selection at 3 assets and lets slots be cleared", () => {
    renderView();
    fireEvent.click(item(/^Ann Test/));
    fireEvent.click(item(/^Bob Test/));
    fireEvent.click(item(/^2027 1st/));
    expect(item(/^Cy Test/).disabled).toBe(true);
    expect(item(/^Ann Test/).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Remove Bob Test" }));
    expect(item(/^Cy Test/).disabled).toBe(false);
    expect(item(/^Bob Test/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByText("Empty slot")).toHaveLength(1);
  });

  it("preselects the suggested player", () => {
    renderView("p3");
    expect(item(/^Cy Test/).getAttribute("aria-pressed")).toBe("true");
  });

  it("disables Find offers with nothing selected", () => {
    renderView();
    expect(
      (screen.getByRole("button", { name: "Find offers" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("searches with the selected assets and shows the first offer", async () => {
    findTradeOffersAction.mockResolvedValue({ ok: true, offers });
    renderView();
    fireEvent.click(item(/^Ann Test/));
    fireEvent.click(item(/^2027 1st/));
    await findOffers();

    expect(findTradeOffersAction).toHaveBeenCalledWith("s1", [
      { kind: "player", id: "p1" },
      { kind: "draftPick", id: "k1" },
    ]);
    expect(screen.getByText("3 teams interested")).toBeTruthy();
    expect(screen.getByText("Austin Owls")).toBeTruthy();
    expect(screen.getByText("Very interested")).toBeTruthy();
    expect(screen.getByLabelText("Interest 80 of 100")).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept trade" })).toBeTruthy();
  });

  it("rotates teams with wraparound and returns to the picker", async () => {
    findTradeOffersAction.mockResolvedValue({ ok: true, offers });
    renderView("p1");
    await findOffers();

    fireEvent.click(screen.getByRole("button", { name: "Previous team" }));
    expect(screen.getByText("Chicago Cubs")).toBeTruthy();
    expect(screen.getByText("Lukewarm")).toBeTruthy();
    expect(screen.getByText("3 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next team" }));
    expect(screen.getByText("Austin Owls")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Boston Bats/ }));
    expect(screen.getByText("2 of 3")).toBeTruthy();
    expect(screen.getByText("Interested")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Change assets" }));
    expect(item(/^Ann Test/).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows an empty state when no team is interested", async () => {
    findTradeOffersAction.mockResolvedValue({ ok: true, offers: [] });
    renderView("p1");
    await findOffers();
    expect(
      screen.getByText(
        "No teams are interested in this package. Try different assets.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change assets" })).toBeTruthy();
  });

  it("shows errors from the search", async () => {
    findTradeOffersAction.mockResolvedValue({ ok: false, error: "Nope" });
    renderView("p1");
    await findOffers();
    expect(screen.getByRole("alert").textContent).toBe("Nope");
    expect(screen.getByRole("button", { name: "Find offers" })).toBeTruthy();
  });
});
