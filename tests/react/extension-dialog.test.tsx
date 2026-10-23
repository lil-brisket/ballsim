import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("@/application/actions", () => ({
  releasePlayerAction: vi.fn(),
  offerContractExtensionAction: vi.fn(),
  exerciseTeamOptionAction: vi.fn(),
  declineTeamOptionAction: vi.fn(),
}));

import { ContractRow } from "@/components/contracts/ContractRow";
import { ExpiringDeals } from "@/components/contracts/ExpiringDeals";
import { ExtendContractDialog } from "@/components/contracts/ExtendContractDialog";
import type { ContractHubRow } from "@/state/contract-hub-selectors";
import type { ContractExtensionView } from "@/state/contract-extension-selectors";

const extension: ContractExtensionView = {
  playerId: "p1",
  seasonsLeft: 0,
  currentSalary: 8_000_000,
  firstNewSeason: 2028,
  askSalary: 12_000_000,
  askMinYears: 3,
  maxYears: 5,
  minSalary: 1_000_000,
  maxSalary: 50_000_000,
  salaryCap: 100_000_000,
  salaryCapEnabled: true,
  seasons: [2028, 2029, 2030, 2031, 2032].map((seasonYear) => ({
    seasonYear,
    currentSalary: 0,
    payrollWithoutPlayer: 95_000_000,
  })),
  lastResponse: null,
  refusals: 0,
  testingMarket: false,
  blockedReason: null,
};

function makeRow(
  id: string,
  ext: ContractExtensionView | null,
): ContractHubRow {
  return {
    contractId: `c-${id}`,
    playerId: id,
    playerName: `Player ${id}`,
    position: "PG",
    age: 25,
    salary: 8_000_000,
    yearsRemaining: 1,
    expirationYear: 2027,
    optionLabel: "—",
    contractState: "active",
    hasPendingTeamOption: false,
    hasPendingPlayerOption: false,
    isExpiring: false,
    isLargeCommitment: false,
    release: null,
    extension: ext,
  } as unknown as ContractHubRow;
}

function renderDialog(overrides: Partial<ContractExtensionView> = {}) {
  render(
    <ExtendContractDialog
      saveId="s1"
      playerId="p1"
      playerName="Test Player"
      returnPath="/x"
      extension={{ ...extension, ...overrides }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Extend" }));
}

afterEach(cleanup);

describe("ExtendContractDialog", () => {
  it("hides Extend when extension is null", () => {
    render(
      <table>
        <tbody>
          <ContractRow saveId="s1" row={makeRow("p1", null)} returnPath="/x" />
        </tbody>
      </table>,
    );
    expect(screen.queryByRole("button", { name: "Extend" })).toBeNull();
  });

  it("defaults to the ask salary and shows cap impact", () => {
    renderDialog();
    expect(screen.getByText("Extend Test Player")).toBeTruthy();
    expect(
      (screen.getByRole("spinbutton", { name: /Salary/ }) as HTMLInputElement)
        .value,
    ).toBe("12000000");
    expect(
      (screen.getByRole("spinbutton", { name: /seasons/i }) as HTMLInputElement)
        .value,
    ).toBe("3");
    expect(screen.getByText("Cap room")).toBeTruthy();
    expect(screen.getAllByText("$-7.0M").length).toBe(3);
    expect(
      screen.getByRole("button", { name: "Offer extension" }),
    ).toBeTruthy();
  });

  it("hides cap room when the cap is off", () => {
    renderDialog({ salaryCapEnabled: false });
    expect(screen.queryByText("Cap room")).toBeNull();
  });

  it("applies his terms after a counter", () => {
    renderDialog({
      lastResponse: {
        kind: "counter",
        offeredSalary: 9_000_000,
        offeredYears: 2,
        askSalary: 15_000_000,
        askYears: 4,
        on: "2027-07-01",
      } as unknown as ContractExtensionView["lastResponse"],
    });
    expect(screen.getByText(/He countered/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use his terms" }));
    expect(
      (screen.getByRole("spinbutton", { name: /Salary/ }) as HTMLInputElement)
        .value,
    ).toBe("15000000");
  });

  it("disables submit when blocked", () => {
    renderDialog({ blockedReason: "Roster is locked." });
    expect(screen.getByRole("alert").textContent).toBe("Roster is locked.");
    expect(
      (
        screen.getByRole("button", {
          name: "Offer extension",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe("ExpiringDeals", () => {
  it("lists only rows with an extension", () => {
    render(
      <ExpiringDeals
        saveId="s1"
        returnPath="/x"
        rows={[makeRow("a", extension), makeRow("b", null)]}
      />,
    );
    expect(screen.getByText("Expiring deals")).toBeTruthy();
    expect(screen.getByText("Player a")).toBeTruthy();
    expect(screen.queryByText("Player b")).toBeNull();
    expect(screen.getByText(/Ends this offseason/)).toBeTruthy();
  });

  it("renders nothing when no row is extendable", () => {
    const { container } = render(
      <ExpiringDeals saveId="s1" returnPath="/x" rows={[makeRow("b", null)]} />,
    );
    expect(container.textContent).toBe("");
  });
});
