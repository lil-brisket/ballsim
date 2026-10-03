import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
}));

import { ActionCard } from "@/components/ui/ActionCard";
import { GameRow } from "@/components/basketball/GameRow";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";

describe("mobile tap targets", () => {
  it("does not nest a secondary link inside an ActionCard link", () => {
    const { container, unmount } = render(
      <ActionCard
        href="/primary"
        title="Review rotation"
        secondaryHref="/secondary"
        secondaryLabel="Open Calendar"
      />,
    );
    expect(container.querySelector("a a")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Review rotation/i }).getAttribute("href"),
    ).toBe("/primary");
    expect(
      screen.getByRole("link", { name: "Open Calendar" }).getAttribute("href"),
    ).toBe("/secondary");
    unmount();
  });

  it("does not nest team buttons inside a GameRow result link", () => {
    const { container, unmount } = render(
      <EntityDrawerProvider saveId="save_test">
        <GameRow
          saveId="save_test"
          gameId="game_1"
          date="2026-11-01"
          home
          opponentAbbreviation="RIV"
          opponentName="Rivermen"
          opponentTeamId="team_2"
          teamScore={110}
          opponentScore={102}
          won
          canOpenResult
        />
      </EntityDrawerProvider>,
    );
    expect(container.querySelector("a button")).toBeNull();
    expect(container.querySelector("a a")).toBeNull();
    expect(
      screen.getByRole("link", { name: /W 110–102/ }).getAttribute("href"),
    ).toBe("/dashboard/save_test/games/game_1");
    unmount();
  });
});
