import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamLeaguePlacement } from "@/components/owner/TeamLeaguePlacement";
import { listTeamsForSelection } from "@/state/selectors";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";

describe("TeamLeaguePlacement", () => {
  it("renders conference and division on separate lines by default", () => {
    const { container, unmount } = render(
      <TeamLeaguePlacement
        conferenceName="Coastal"
        divisionName="Gulf"
      />,
    );
    expect(container.textContent).toContain("Coastal Conference");
    expect(container.textContent).toContain("Gulf Division");
    expect(container.textContent).not.toContain("·");
    unmount();
  });

  it("renders compact single line with separator", () => {
    const { container, unmount } = render(
      <TeamLeaguePlacement
        conferenceName="Coastal"
        divisionName="Gulf"
        compact
      />,
    );
    expect(container.textContent).toBe("Coastal Conference · Gulf Division");
    unmount();
  });

  it("hides division when showDivision is false", () => {
    const { container, unmount } = render(
      <TeamLeaguePlacement
        conferenceName="Eastern"
        divisionName="Atlantic"
        showDivision={false}
      />,
    );
    expect(container.textContent).toBe("Eastern Conference");
    expect(container.textContent).not.toContain("Division");
    unmount();
  });

  it("hides division in compact mode when showDivision is false", () => {
    const { container, unmount } = render(
      <TeamLeaguePlacement
        conferenceName="Eastern"
        divisionName="Atlantic"
        showDivision={false}
        compact
      />,
    );
    expect(container.textContent).toBe("Eastern Conference");
    unmount();
  });
});

describe("listTeamsForSelection conference/division ids", () => {
  it("exposes conferenceId and divisionId from world teams", () => {
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.ownership = { controlledTeamCount: 2 };
    const state = createInitialGameState({
      saveId: "franchise_pick_ids",
      rngSeed: 7,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings,
    });
    const entries = listTeamsForSelection(state);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const team = state.world.teams[entry.id]!;
      expect(entry.conferenceId).toBe(team.conferenceId);
      expect(entry.divisionId).toBe(team.divisionId);
      expect(entry.conferenceName).toBe(
        state.world.conferences[team.conferenceId]!.name,
      );
      expect(entry.divisionName).toBe(
        state.world.divisions[team.divisionId]!.name,
      );
    }
  });
});
