import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { AiTeamManagementSection } from "@/components/owner/ai-management/AiTeamManagementSection";
import {
  DEFAULT_DELEGATED_ASSISTANCE,
  MANAGEMENT_PHASE_METADATA,
  PLAYER_VISIBLE_DELEGATION_PHASES,
} from "@/domain/ai-management-delegation";
import type { AiAssistancePhases } from "@/domain/ai-management-presets";

vi.mock("@/application/actions", () => ({
  createSaveAction: vi.fn(),
}));

function Harness({
  initial = DEFAULT_DELEGATED_ASSISTANCE,
}: {
  initial?: AiAssistancePhases;
}) {
  const [assistance, setAssistance] = useState(initial);
  return (
    <AiTeamManagementSection
      assistance={assistance}
      onAssistanceChange={setAssistance}
    />
  );
}

describe("AiTeamManagementSection", () => {
  it("renders visible responsibilities and help panel", () => {
    const { unmount } = render(<Harness />);

    expect(
      screen.getByText("What would you like the AI to handle for you?"),
    ).toBeTruthy();
    expect(screen.queryByText("How AI assistance works")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "About AI Team Management" }),
    );
    expect(screen.getByText("How AI assistance works")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: /Injuries & Emergency Roster/,
      }),
    ).toBeTruthy();

    expect(screen.queryByText("Trades")).toBeNull();
    expect(screen.queryByText("Waivers & Releases")).toBeNull();
    expect(screen.queryByText("Contracts")).toBeNull();
    expect(screen.queryByText(/Custom — configure/)).toBeNull();

    unmount();
  });

  it("toggles a responsibility card", () => {
    const { unmount } = render(<Harness />);

    const faCard = screen.getByRole("checkbox", { name: /Free Agency:/ });
    expect(faCard.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(faCard);
    expect(faCard.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(faCard);
    expect(faCard.getAttribute("aria-checked")).toBe("false");

    unmount();
  });

  it("Select All delegates all visible phases and Clear All clears them", () => {
    const { unmount } = render(<Harness />);

    fireEvent.click(screen.getAllByRole("button", { name: "Select All" })[0]!);

    for (const phase of PLAYER_VISIBLE_DELEGATION_PHASES) {
      const label = MANAGEMENT_PHASE_METADATA[phase].label;
      const card = screen.getByRole("checkbox", {
        name: new RegExp(label),
      });
      expect(card.getAttribute("aria-checked")).toBe("true");
    }

    expect(
      screen.getByText(
        `${PLAYER_VISIBLE_DELEGATION_PHASES.length} of ${PLAYER_VISIBLE_DELEGATION_PHASES.length} delegated`,
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    for (const phase of PLAYER_VISIBLE_DELEGATION_PHASES) {
      const label = MANAGEMENT_PHASE_METADATA[phase].label;
      const card = screen.getByRole("checkbox", {
        name: new RegExp(label),
      });
      expect(card.getAttribute("aria-checked")).toBe("false");
    }

    unmount();
  });

  it("category Select All only affects that category", () => {
    const { unmount } = render(
      <Harness
        initial={{
          ...DEFAULT_DELEGATED_ASSISTANCE,
          injuriesEmergencyRoster: "off",
          rotationsDepthChart: "off",
        }}
      />,
    );

    const rosterHeading = screen
      .getAllByText("Roster Management")
      .find((el) => el.tagName === "H3");
    expect(rosterHeading).toBeTruthy();
    const rosterSection = rosterHeading!.closest("section");
    expect(rosterSection).toBeTruthy();
    const selectAll = within(rosterSection as HTMLElement).getByRole("button", {
      name: "Select All",
    });
    fireEvent.click(selectAll);

    expect(
      screen
        .getByRole("checkbox", { name: /Injuries & Emergency Roster/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("checkbox", { name: /Free Agency:/ })
        .getAttribute("aria-checked"),
    ).toBe("false");

    unmount();
  });

  it("? toggles a responsibility description without toggling it", () => {
    const { unmount } = render(<Harness />);

    const description = MANAGEMENT_PHASE_METADATA.freeAgency.description;
    const faCard = screen.getByRole("checkbox", { name: /Free Agency:/ });
    const tip = within(faCard.parentElement!).getByRole("button", {
      name: "About Free Agency",
    });
    expect(screen.queryByText(description)).toBeNull();

    fireEvent.click(tip);
    expect(screen.getByRole("tooltip").textContent).toBe(description);
    expect(faCard.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(tip);
    expect(screen.queryByText(description)).toBeNull();

    fireEvent.click(tip);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    unmount();
  });
});
