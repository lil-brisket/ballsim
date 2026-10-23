import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("@/application/actions", () => ({
  releasePlayerAction: vi.fn(),
  exerciseTeamOptionAction: vi.fn(),
  declineTeamOptionAction: vi.fn(),
}));

import { ContractRow } from "@/components/contracts/ContractRow";
import { ReleasePlayerDialog } from "@/components/contracts/ReleasePlayerDialog";
import type { ContractHubRow } from "@/state/contract-hub-selectors";
import type { PlayerReleaseView } from "@/state/player-release-selectors";

const release: PlayerReleaseView = {
  playerId: "p1",
  remainingSalary: 20_000_000,
  blockedReason: null,
  waive: {
    mode: "waive",
    cashNow: 0,
    buyoutRate: null,
    totalDeadMoney: 20_000_000,
    seasons: [
      { seasonYear: 2027, capHit: 10_000_000, cashDue: 10_000_000 },
      { seasonYear: 2028, capHit: 10_000_000, cashDue: 10_000_000 },
    ],
    capSpaceAfter: 5_000_000,
  },
  buyout: {
    mode: "buyout",
    cashNow: 17_600_000,
    buyoutRate: 0.88,
    totalDeadMoney: 17_600_000,
    seasons: [{ seasonYear: 2027, capHit: 17_600_000, cashDue: 0 }],
    capSpaceAfter: -2_000_000,
  },
};

function renderDialog(overrides: Partial<PlayerReleaseView> = {}) {
  render(
    <ReleasePlayerDialog
      saveId="s1"
      playerId="p1"
      playerName="Test Player"
      returnPath="/x"
      release={{ ...release, ...overrides }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Release" }));
}

afterEach(cleanup);

describe("ReleasePlayerDialog", () => {
  it("hides the Release button when release is null", () => {
    const row = {
      contractId: "c1",
      playerId: "p1",
      playerName: "Test Player",
      position: "PG",
      age: 25,
      salary: 10_000_000,
      yearsRemaining: 2,
      expirationYear: 2028,
      optionLabel: "—",
      contractState: "active",
      hasPendingTeamOption: false,
      hasPendingPlayerOption: false,
      isExpiring: false,
      isLargeCommitment: false,
      release: null,
    } as unknown as ContractHubRow;
    render(
      <table>
        <tbody>
          <ContractRow saveId="s1" row={row} returnPath="/x" />
        </tbody>
      </table>,
    );
    expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
  });

  it("shows waive dead money by default", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Release Test Player?")).toBeTruthy();
    expect(
      (screen.getByRole("radio", { name: /Waive/ }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getAllByText("$20.0M").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Waive player" })).toBeTruthy();
  });

  it("shows cash now and percent for a buyout", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /Buyout/ }));
    expect(screen.getByText(/88% of the remaining salary/)).toBeTruthy();
    expect(screen.getAllByText("$17.6M").length).toBeGreaterThan(0);
    expect(screen.getByText("Paid now", { selector: "td span" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buy out player" })).toBeTruthy();
  });

  it("disables confirm when blocked", () => {
    renderDialog({ blockedReason: "Roster is locked." });
    expect(screen.getByText("Roster is locked.")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Waive player",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe("ReleasePlayerDialog deep link", () => {
  it("opens on arrival when defaultOpen is set", () => {
    render(
      <ReleasePlayerDialog
        saveId="s1"
        playerId="p1"
        playerName="Test Player"
        returnPath="/x"
        release={release}
        defaultOpen
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Release Test Player?")).toBeTruthy();
  });

  it("stays closed by default", () => {
    render(
      <ReleasePlayerDialog
        saveId="s1"
        playerId="p1"
        playerName="Test Player"
        returnPath="/x"
        release={release}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
