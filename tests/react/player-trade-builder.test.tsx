import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  proposePlayerTradeAction: vi.fn(),
  declineOwnerDecisionAction: vi.fn(),
}));

import { PlayerTradeBuilder } from "@/components/trades/PlayerTradeBuilder";

const player = (id: string, name: string) => ({
  id,
  name,
  position: "PG",
  overall: 70,
  age: 25,
});

function renderBuilder(extra: { error?: string } = {}) {
  return render(
    <PlayerTradeBuilder
      saveId="s1"
      returnPath="/dashboard/s1/trades/propose"
      myTeamId="t1"
      myTeam={{
        id: "t1",
        players: [player("p1", "Ann Mine")],
        picks: [{ id: "k1", label: "2027 Round 1" }],
      }}
      targets={[
        {
          id: "t2",
          label: "Bob — Austin Owls",
          players: [player("p2", "Bo Theirs")],
          picks: [],
        },
        {
          id: "t3",
          label: "Cy — Boston Bats",
          players: [player("p3", "Cy Other")],
          picks: [],
        },
      ]}
      sentOffers={[
        {
          id: "d1",
          toLabel: "Bob — Austin Owls",
          sends: ["Ann Mine"],
          receives: ["Bo Theirs"],
        },
      ]}
      {...extra}
    />,
  );
}

function payload(container: HTMLElement) {
  const input = container.querySelector(
    'input[name="proposalJson"]',
  ) as HTMLInputElement;
  return JSON.parse(input.value);
}

describe("PlayerTradeBuilder", () => {
  afterEach(() => cleanup());

  it("disables submit until both sides have an asset", () => {
    renderBuilder();
    const submit = screen.getByRole("button", {
      name: "Propose trade",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Send Ann Mine"));
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Ask for Bo Theirs"));
    expect(submit.disabled).toBe(false);
  });

  it("builds the proposal payload with correct sides", () => {
    const { container } = renderBuilder();
    fireEvent.click(screen.getByLabelText("Send 2027 Round 1"));
    fireEvent.click(screen.getByLabelText("Send Ann Mine"));
    fireEvent.click(screen.getByLabelText("Ask for Bo Theirs"));
    expect(payload(container)).toEqual({
      sideA: { teamId: "t1", playerIds: ["p1"], draftPickIds: ["k1"] },
      sideB: { teamId: "t2", playerIds: ["p2"], draftPickIds: [] },
    });
  });

  it("clears the receive selection when the target team changes", () => {
    const { container } = renderBuilder();
    fireEvent.click(screen.getByLabelText("Send Ann Mine"));
    fireEvent.click(screen.getByLabelText("Ask for Bo Theirs"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "t3" } });
    const submit = screen.getByRole("button", {
      name: "Propose trade",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(payload(container).sideB).toEqual({
      teamId: "t3",
      playerIds: [],
      draftPickIds: [],
    });
    expect(
      (screen.getByLabelText("Ask for Cy Other") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("shows errors and sent offers with a withdraw button", () => {
    renderBuilder({ error: "Roster full" });
    expect(screen.getByRole("alert").textContent).toBe("Roster full");
    expect(screen.getByText("Sent offers")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
  });
});
