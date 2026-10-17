import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StartingFiveEditor } from "@/components/team-management/StartingFiveEditor";
import { ClosingLineupEditor } from "@/components/team-management/ClosingLineupEditor";
import type { PlayerCardLike } from "@/state/lineup-rotation-editor";

afterEach(cleanup);

function card(
  id: string,
  last: string,
  position: string,
  overall: number,
  available = true,
): PlayerCardLike {
  return {
    playerId: id,
    firstName: "Test",
    lastName: last,
    position,
    overall,
    plannedMinutes: 20,
    availabilityLabel: available ? "Available" : "Out",
    available,
    role: "starter",
  };
}

const players = [
  card("p1", "Alpha", "PG", 80),
  card("p2", "Bravo", "SG", 78),
  card("p3", "Charlie", "SF", 77),
  card("p4", "Delta", "PF", 76),
  card("p5", "Echo", "C", 75),
  card("p6", "Foxtrot", "PG", 70),
  card("p7", "Golf", "SG", 69, false),
];

const starters = [
  { slot: "PG", playerId: "p1" },
  { slot: "SG", playerId: "p2" },
  { slot: "SF", playerId: "p3" },
  { slot: "PF", playerId: "p4" },
  { slot: "C", playerId: "p5" },
];

describe("StartingFiveEditor court", () => {
  it("renders five chips and changes a starter through the picker", async () => {
    const onChange = vi.fn();
    render(
      <StartingFiveEditor
        starters={starters}
        allPlayers={players}
        rowsById={new Map()}
        onChangeStarter={onChange}
      />,
    );
    expect(screen.getByTestId("lineup-court")).toBeTruthy();
    expect(document.querySelectorAll("select").length).toBe(0);

    const chip = screen.getByRole("button", { name: /^PG: Test Alpha/ });
    expect(chip.getAttribute("aria-haspopup")).toBe("dialog");
    chip.focus();
    fireEvent.click(chip);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
    // Only unassigned available players plus the current one are eligible.
    expect(within(dialog).queryByText(/Golf/)).toBeNull();
    expect(within(dialog).queryByText(/Bravo/)).toBeNull();
    expect(within(dialog).getByText(/Foxtrot/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: /Foxtrot/ }));
    expect(onChange).toHaveBeenCalledWith("PG", "p6");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(chip);
  });

  it("closes the picker on Escape and supports arrow keys in the list", async () => {
    render(
      <StartingFiveEditor
        starters={starters}
        allPlayers={players}
        rowsById={new Map()}
        onChangeStarter={vi.fn()}
      />,
    );
    const chip = screen.getByRole("button", { name: /^C: Test Echo/ });
    chip.focus();
    fireEvent.click(chip);
    const dialog = await screen.findByRole("dialog");
    const items = within(dialog)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label") !== "Close");
    items[0]!.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(chip);
  });
});

describe("ClosingLineupEditor chips", () => {
  it("toggles players with pressed chips in custom mode", () => {
    const onToggle = vi.fn();
    render(
      <ClosingLineupEditor
        closingPolicy="custom"
        closingIds={["p1"]}
        editableRows={
          players.slice(0, 2).map((p) => ({
            ...p,
            targetMinutes: 20,
            groupRole: "starter",
          })) as never
        }
        onPolicyChange={vi.fn()}
        onTogglePlayer={onToggle}
      />,
    );
    const alpha = screen.getByRole("button", { name: /Test Alpha/ });
    expect(alpha.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Test Bravo/ }));
    expect(onToggle).toHaveBeenCalledWith("p2");
  });
});
