import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  restrictedFreeAgencyAction: vi.fn(),
}));

import { IncomingOfferSheets } from "@/components/rfa/IncomingOfferSheets";
import { QualifyingOffers } from "@/components/rfa/QualifyingOffers";
import { RfaBadge } from "@/components/rfa/RfaBadge";
import { RfaOfferSheetAction } from "@/components/rfa/RfaOfferSheetAction";
import type {
  IncomingOfferSheetRow,
  QualifyingOfferRow,
  RfaTag,
} from "@/state/rfa-selectors";

afterEach(cleanup);

const sheet: IncomingOfferSheetRow = {
  playerId: "p1",
  playerName: "Ada Hill",
  offeringTeamId: "t2",
  offeringTeamName: "Boston Owls",
  salary: 9_000_000,
  years: 3,
  matchDeadlineDate: "2026-07-10",
  payrollIfMatched: 120_000_000,
  salaryCap: 100_000_000,
  matchBlockedReason: null,
};

const qo: QualifyingOfferRow = {
  playerId: "p2",
  playerName: "Bo Jones",
  position: "PG",
  age: 24,
  overall: 70,
  qualifyingOfferSalary: 4_000_000,
  issued: false,
  blockedReason: null,
};

const tag: RfaTag = {
  originalTeamId: "t3",
  originalTeamName: "Denver Peaks",
  qualifyingOfferSalary: 4_000_000,
  pendingMatch: false,
};

describe("IncomingOfferSheets", () => {
  it("renders terms and Match / Let him go intents", () => {
    const { container } = render(
      <IncomingOfferSheets sheets={[sheet]} saveId="s1" returnPath="/r" />,
    );
    expect(
      screen.getByText(/Ada Hill signed an offer sheet with Boston Owls/),
    ).toBeTruthy();
    expect(screen.getByText(/Match by Jul 10 or he joins them/)).toBeTruthy();
    expect(screen.getByText(/Matching may go over the cap/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Match" }).getAttribute("value"),
    ).toBe("match");
    expect(
      screen.getByRole("button", { name: "Let him go" }).getAttribute("value"),
    ).toBe("decline");
    expect(container.querySelector('input[name="playerId"]')).toHaveProperty(
      "value",
      "p1",
    );
  });

  it("disables Match and shows the reason when blocked", () => {
    render(
      <IncomingOfferSheets
        sheets={[{ ...sheet, matchBlockedReason: "Roster is full" }]}
        saveId="s1"
        returnPath="/r"
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Match" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText("Roster is full")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Let him go" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe("QualifyingOffers", () => {
  it("shows the issue button, or Offer issued", () => {
    render(
      <QualifyingOffers
        rows={[
          qo,
          { ...qo, playerId: "p3", playerName: "Cy Lee", issued: true },
        ]}
        saveId="s1"
        returnPath="/r"
      />,
    );
    expect(
      screen.getAllByRole("button", { name: "Issue qualifying offer" }),
    ).toHaveLength(1);
    expect(screen.getByText("Offer issued")).toBeTruthy();
  });

  it("disables the button with the blocked reason", () => {
    render(
      <QualifyingOffers
        rows={[{ ...qo, blockedReason: "Not during roster decisions" }]}
        saveId="s1"
        returnPath="/r"
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Issue qualifying offer",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Not during roster decisions")).toBeTruthy();
  });
});

describe("RFA market tag", () => {
  it("badge explains who can match", () => {
    render(<RfaBadge tag={tag} />);
    expect(screen.getByText("RFA").getAttribute("title")).toBe(
      "Restricted: Denver Peaks can match",
    );
  });

  it("opens an offer sheet dialog that submits intent offer_sheet", () => {
    render(
      <RfaOfferSheetAction
        saveId="s1"
        playerId="p9"
        playerName="Di Fox"
        returnPath="/r"
        tag={tag}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Offer sheet" }));
    const dialog = screen.getByRole("dialog");
    expect(
      dialog.querySelector<HTMLInputElement>('input[name="intent"]')?.value,
    ).toBe("offer_sheet");
    expect(
      dialog.querySelector<HTMLInputElement>('input[name="years"]')?.value,
    ).toBe("2");
    expect(
      dialog.querySelector<HTMLInputElement>('input[name="salary"]')?.value,
    ).toBe("4000000");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows waiting text instead of the button when a match is pending", () => {
    render(
      <RfaOfferSheetAction
        saveId="s1"
        playerId="p9"
        playerName="Di Fox"
        returnPath="/r"
        tag={{ ...tag, pendingMatch: true }}
      />,
    );
    expect(screen.getByText("Waiting on Denver Peaks")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Offer sheet" })).toBeNull();
  });
});
